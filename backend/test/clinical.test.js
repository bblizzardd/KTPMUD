import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db.js';
import { newId } from '../src/common.js';
import { tickClinical } from '../src/clinical.js';

function fixture(t, config = {}) {
  const db = openDatabase(':memory:');
  const caregiverId = newId();
  const patientId = newId();
  const reportDir = mkdtempSync(path.join(tmpdir(), 'antam-clinical-'));
  db.insert('caregivers', { id: caregiverId, email: 'clinical@example.test' });
  db.insert('patients', { id: patientId, caregiverId, alias: 'Bố (Dữ liệu kiểm thử)', birthYear: 1954 });
  const ctx = {
    db, now: () => new Date('2026-10-22T05:00:00Z'), events: new EventEmitter(),
    config: { reportDir, baseUrl: 'http://127.0.0.1:8080', includeLateInRate: false, ...config },
    audit: (entry) => db.insert('auditLogs', { id: newId(), timestamp: '2026-10-22T05:00:00Z', status: 'SUCCESS', ...entry }),
  };
  t.after(() => {
    db.close();
    const resolved = path.resolve(reportDir);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('antam-clinical-'));
    rmSync(resolved, { recursive: true, force: true });
  });
  return { ctx, patientId, caregiverId };
}

test('appointment reminders emit once and expired appointments become MISSED', async (t) => {
  const { ctx, patientId } = fixture(t);
  const soon = { id: newId(), patientId, visitDate: '2026-10-24', remindDaysBefore: 2, status: 'UPCOMING', note: 'Mang theo báo cáo.' };
  const old = { ...soon, id: newId(), visitDate: '2026-10-21' };
  ctx.db.insert('appointments', soon);
  ctx.db.insert('appointments', old);
  const events = [];
  ctx.events.on('alert', (alert) => events.push(alert));
  await tickClinical(ctx);
  await tickClinical(ctx);
  assert.equal(events.length, 1);
  assert.equal(ctx.db.list('alerts').length, 1);
  assert.equal(events[0].relatedAppointmentId, soon.id);
  assert.equal(ctx.db.get('appointments', old.id).status, 'MISSED');
});

test('report worker recovers PROCESSING jobs and creates a Vietnamese PDF', async (t) => {
  const { ctx, patientId, caregiverId } = fixture(t);
  const report = { id: newId(), patientId, periodDays: 30, status: 'PROCESSING', createdAt: ctx.now().toISOString(), requestedBy: caregiverId };
  ctx.db.insert('reports', report);
  await tickClinical(ctx);
  const done = ctx.db.get('reports', report.id);
  assert.equal(done.status, 'READY');
  assert.equal(done.downloadUrl, `http://127.0.0.1:8080/api/v1/reports/${report.id}/download`);
  const pdf = readFileSync(path.join(ctx.config.reportDir, `${report.id}.pdf`));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 10000, 'Unicode font is embedded');
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1, 'Footers must not create blank pages');
  await tickClinical(ctx);
  assert.equal(ctx.db.list('auditLogs').filter((log) => log.actionType === 'REPORT_PDF_GENERATED').length, 1);
});

test('report failures expose stable code without filesystem or internal errors', async (t) => {
  const { ctx, patientId } = fixture(t, { fontPath: '/missing/private/font.ttf' });
  const report = { id: newId(), patientId, periodDays: 30, status: 'QUEUED', createdAt: ctx.now().toISOString() };
  ctx.db.insert('reports', report);
  await tickClinical(ctx);
  const failed = ctx.db.get('reports', report.id);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.errorCode, 'REPORT_GENERATION_FAILED');
  assert.equal(failed.downloadUrl, null);
  assert.equal(JSON.stringify(failed).includes('/missing/private'), false);
  assert.equal(ctx.db.list('auditLogs').find((log) => log.actionType === 'REPORT_GENERATION_FAILED').status, 'FAILURE');
});
