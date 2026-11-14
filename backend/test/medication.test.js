import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import express from 'express';
import { openDatabase } from '../src/db.js';
import { newId } from '../src/common.js';
import { registerMedicationRoutes, tickMedication, applyMedicationTimingPolicy } from '../src/medication.js';
import { createApp } from '../src/app.js';
import { createTokenPair } from '../src/security.js';

async function fullFixture(t) {
  const runtime = await createApp({
    databasePath: ':memory:', now: () => new Date('2026-10-22T00:00:00.000Z'), config: { logErrors: false },
  });
  const caregiver = runtime.ctx.db.insert('caregivers', { id: newId(), email: `${newId()}@example.test`, displayName: 'Owner' });
  const token = (await createTokenPair(runtime.ctx, caregiver.id)).response.accessToken;
  const server = await new Promise((resolve) => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    runtime.close();
  });
  const request = async (method, path, body, accessToken = token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  return { ...runtime, request, caregiver };
}

async function fixture(t, initialTime = '2026-10-22T00:00:00.000Z') {
  let current = new Date(initialTime);
  const db = openDatabase(':memory:');
  const caregiver = db.insert('caregivers', { id: newId(), email: `${newId()}@example.test` });
  const patient = db.insert('patients', { id: newId(), caregiverId: caregiver.id, alias: 'Bố', birthYear: 1955 });
  const ctx = {
    db, now: () => new Date(current), events: new EventEmitter(),
    config: { offlineMaxAgeHours: 72, includeLateInRate: false },
    audit: (record) => db.insert('auditLogs', { id: newId(), timestamp: current.toISOString(), status: 'SUCCESS', ...record }),
    caregiver: (req, res, next) => { req.actor = { id: caregiver.id, role: 'CAREGIVER' }; next(); },
    device: (req, res, next) => { req.actor = { id: newId(), role: 'PATIENT', patientId: patient.id }; next(); },
    patientAccess: (req, id) => db.get('patients', id),
  };
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerMedicationRoutes(router, ctx);
  app.use('/api/v1', router);
  app.use((error, req, res, next) => res.status(error.status ?? 500).json({ code: error.code, message: error.message }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    db.close();
  });
  const request = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  return { ctx, db, patient, request, time: (value) => { current = new Date(value); } };
}

function input(overrides = {}) {
  return {
    issuedDate: '2026-10-22', startDate: '2026-10-22', nextVisitDate: '2026-10-22',
    items: [{ drugNameRaw: 'Thuốc ghi trên đơn', unitsPerDose: 1, slots: ['EVENING'] }],
    ...overrides,
  };
}

test('custom medication times round-trip through edits and generate independent 60-minute windows', async t => {
  const f = await fixture(t);
  const items = [
    { drugNameRaw: 'A', unitsPerDose: 1, slots: ['MORNING'], times: { MORNING: '08:25' } },
    { drugNameRaw: 'B', unitsPerDose: 1, slots: ['MORNING'], times: { MORNING: '09:45' } },
  ];
  const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({ items }));
  assert.equal(draft.status, 201);
  assert.deepEqual(draft.body.items[0].times, items[0].times);
  items[0].times.MORNING = '08:40';
  const updated = await f.request('PUT', `/prescriptions/${draft.body.id}`, input({ items }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.items[0].times.MORNING, '08:40');
  assert.equal((await f.request('POST', `/prescriptions/${draft.body.id}/confirm`)).status, 202);
  const doses = f.db.list('doses').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  assert.deepEqual(doses.map(d => d.scheduledAt), ['2026-10-22T01:40:00.000Z', '2026-10-22T02:45:00.000Z']);
  assert.ok(doses.every(d => Date.parse(d.deadlineAt) - Date.parse(d.scheduledAt) === 3600000));
  for (const times of [{ MORNING: '25:00' }, {}, { MORNING: '08:00', EVENING: '20:00' }]) {
    assert.equal((await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({ items: [{ ...items[0], times }] }))).status, 400);
  }
  assert.equal((await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({ items: [{ ...items[0], slots: ['MORNING', 'NOON'], times: { MORNING: '08:00', NOON: '08:00' } }] }))).status, 400);
});

test('confirmation includes both 60-minute boundaries, supports offline and correction, rejects too early', async t => {
  for (const [offset, expected] of [[-3600001, 422], [-3600000, 'TAKEN'], [3600000, 'TAKEN'], [3600001, 'LATE_CONFIRMED']]) {
    await t.test(`offset ${offset} ms`, async t => {
      const f = await fixture(t);
      const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({ items: [{ drugNameRaw: 'A', unitsPerDose: 1, slots: ['MORNING'], times: { MORNING: '08:00' } }] }));
      await f.request('POST', `/prescriptions/${draft.body.id}/confirm`);
      const dose = f.db.list('doses')[0];
      const takenAt = new Date(Date.parse(dose.scheduledAt) + offset).toISOString();
      f.time(takenAt);
      const result = await f.request('POST', `/doses/${dose.id}/confirmations`, { takenAt });
      if (expected === 422) {
        assert.equal(result.status, 422);
        assert.equal(result.body.code, 'INVALID_TAKEN_AT');
      } else {
        assert.equal(result.status, 201);
        assert.equal(result.body.resultingStatus, expected);
      }
    });
  }
  const f = await fixture(t);
  const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input());
  await f.request('POST', `/prescriptions/${draft.body.id}/confirm`);
  const dose = f.db.list('doses')[0];
  f.time('2026-10-23T12:00:00.000Z');
  const early = '2026-10-22T11:00:00.000Z';
  const confirmed = await f.request('POST', `/doses/${dose.id}/confirmations`, { takenAt: early });
  assert.equal(confirmed.status, 201);
  assert.equal(confirmed.body.resultingStatus, 'TAKEN', 'Offline upload keeps the actual early takenAt');
  const corrected = await f.request('POST', `/doses/${dose.id}/corrections`, { takenAt: '2026-10-22T13:00:00.001Z', correctsConfirmationId: confirmed.body.id });
  assert.equal(corrected.status, 201);
  assert.equal(corrected.body.resultingStatus, 'LATE_CONFIRMED');
  assert.deepEqual(f.db.get('confirmations', confirmed.body.id), confirmed.body, 'Original confirmation is immutable');
});

test('near-midnight doses remain visible and confirmable across both calendar boundaries', async t => {
  for (const [time, now] of [['00:30', '2026-10-21T16:30:00.000Z'], ['23:30', '2026-10-22T17:30:00.000Z']]) {
    await t.test(time, async t => {
      const f = await fixture(t, '2026-10-21T16:00:00.000Z');
      const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({ items: [{ drugNameRaw: 'A', unitsPerDose: 1, slots: ['MORNING'], times: { MORNING: time } }] }));
      await f.request('POST', `/prescriptions/${draft.body.id}/confirm`);
      f.time(now);
      const today = await f.request('GET', '/device/doses/today');
      assert.equal(today.body.length, 1, 'Adjacent-date dose is visible inside its on-time window');
      const confirmed = await f.request('POST', `/doses/${today.body[0].id}/confirmations`, {});
      assert.equal(confirmed.status, 201);
      assert.equal(confirmed.body.resultingStatus, 'TAKEN');
    });
  }
});

test('existing outstanding doses adopt 60 minutes idempotently without rewriting history', async t => {
  const f = await fixture(t);
  f.db.update('patients', f.patient.id, { missedThresholdMinutes: 120 });
  const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input());
  await f.request('POST', `/prescriptions/${draft.body.id}/confirm`);
  const dose = f.db.list('doses')[0];
  const oldDeadline = new Date(Date.parse(dose.scheduledAt) + 7200000).toISOString();
  f.db.update('doses', dose.id, { deadlineAt: oldDeadline });
  const historical = f.db.insert('doses', { ...dose, id: newId(), prescriptionItemId: newId(), status: 'TAKEN', lastConfirmationId: newId(), deadlineAt: oldDeadline });
  applyMedicationTimingPolicy(f.ctx);
  assert.equal(f.db.get('patients', f.patient.id).missedThresholdMinutes, 60);
  assert.equal(f.db.get('doses', dose.id).deadlineAt, '2026-10-22T13:00:00.000Z');
  assert.deepEqual(f.db.get('doses', historical.id), historical);
  const audits = f.db.list('auditLogs');
  applyMedicationTimingPolicy(f.ctx);
  assert.deepEqual(f.db.list('auditLogs'), audits);
});

test('failed replacement rolls back prescription, future doses and audit mutations together', async (t) => {
  const f = await fixture(t);
  const original = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input());
  assert.equal(original.status, 201);
  assert.equal((await f.request('POST', `/prescriptions/${original.body.id}/confirm`)).status, 202);
  const oldDose = f.db.list('doses')[0];
  assert.equal(oldDose.status, 'SCHEDULED');
  const oversized = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({ nextVisitDate: '2226-10-22' }));
  assert.equal(oversized.status, 201);
  const auditBefore = f.db.list('auditLogs');
  const failed = await f.request('POST', `/prescriptions/${oversized.body.id}/confirm`);
  assert.equal(failed.status, 422);
  assert.equal(failed.body.code, 'PRESCRIPTION_TOO_LARGE');
  assert.equal(f.db.get('prescriptions', original.body.id).status, 'ACTIVE');
  assert.equal(f.db.get('prescriptions', oversized.body.id).status, 'DRAFT');
  assert.deepEqual(f.db.get('doses', oldDose.id), oldDose);
  assert.deepEqual(f.db.list('auditLogs'), auditBefore);
});

test('deadline is inclusive; crossing it emits one alert, and expiry follows Vietnam date', async (t) => {
  const f = await fixture(t, '2026-10-22T11:59:59.999Z');
  const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input());
  await f.request('POST', `/prescriptions/${draft.body.id}/confirm`);
  const dose = f.db.list('doses')[0];
  const alerts = [];
  f.ctx.events.on('alert', (alert) => alerts.push(alert));
  f.time('2026-10-22T12:00:00.000Z');
  tickMedication(f.ctx);
  assert.equal(f.db.get('doses', dose.id).status, 'PENDING');
  f.time('2026-10-22T13:00:00.000Z');
  tickMedication(f.ctx);
  assert.equal(f.db.get('doses', dose.id).status, 'PENDING');
  f.time('2026-10-22T13:00:00.001Z');
  tickMedication(f.ctx);
  tickMedication(f.ctx);
  assert.equal(f.db.get('doses', dose.id).status, 'MISSED');
  assert.equal(alerts.length, 1);
  assert.equal(f.db.list('alerts').length, 1);
  f.time('2026-10-22T16:59:59.999Z');
  tickMedication(f.ctx);
  assert.equal(f.db.get('prescriptions', draft.body.id).status, 'ACTIVE');
  f.time('2026-10-22T17:00:00.000Z');
  tickMedication(f.ctx);
  assert.equal(f.db.get('prescriptions', draft.body.id).status, 'EXPIRED');
  assert.equal(f.db.list('auditLogs', { actionType: 'PRESCRIPTION_EXPIRED' }).length, 1);
  assert.equal(f.db.list('auditLogs', { actionType: 'PRESCRIPTION_EXPIRED' })[0].userId, '00000000-0000-4000-8000-000000000000');
});

test('duplicate-ingredient warning requires catalogue evidence and retains raw medication labels', async (t) => {
  const f = await fixture(t);
  const drugA = f.db.insert('drugs', { id: newId(), brandName: 'Tên A', activeIngredients: [{ name: 'metformin', strength: '500 mg' }] });
  const drugB = f.db.insert('drugs', { id: newId(), brandName: 'Tên B', activeIngredients: [{ name: 'Metformin', strength: '850 mg' }] });
  const item = (drugId, label) => ({ drugId, drugNameRaw: label, unitsPerDose: 1, slots: ['MORNING'] });
  const supported = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({
    items: [item(drugA.id, 'Tên theo phiếu A'), item(drugB.id, 'Tên theo phiếu B')],
  }));
  assert.equal(supported.status, 201);
  assert.equal(supported.body.warnings.length, 1);
  assert.equal(supported.body.items[0].drugNameRaw, 'Tên theo phiếu A');
  const unknown = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({
    items: [item(drugA.id, 'Tên A'), item(null, 'Metformin ghi tay chưa đối chiếu')],
  }));
  assert.equal(unknown.status, 201);
  assert.deepEqual(unknown.body.warnings, []);
});

test('the last representable calendar day generates exactly one day without date rollover', async (t) => {
  const f = await fixture(t, '9999-12-31T00:00:00.000Z');
  const draft = await f.request('POST', `/patients/${f.patient.id}/prescriptions`, input({
    issuedDate: '9999-12-31', startDate: '9999-12-31', nextVisitDate: '9999-12-31',
  }));
  assert.equal(draft.status, 201);
  const active = await f.request('POST', `/prescriptions/${draft.body.id}/confirm`);
  assert.equal(active.status, 202);
  assert.equal(f.db.list('doses').length, 1);
  assert.equal(f.db.list('doses')[0].date, '9999-12-31');
});

test('failed mutations retain authorized resource audit scope exactly once after router unwinding', async (t) => {
  const f = await fullFixture(t);
  const patient = (await f.request('POST', '/patients', { alias: 'Bố', birthYear: 1955 })).body;
  const draft = (await f.request('POST', `/patients/${patient.id}/prescriptions`, input())).body;
  assert.equal((await f.request('POST', `/prescriptions/${draft.id}/confirm`)).status, 202);
  assert.equal((await f.request('POST', `/prescriptions/${draft.id}/confirm`)).status, 409);
  const failures = f.ctx.db.list('auditLogs', { patientId: patient.id, status: 'FAILURE' });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].targetType, 'Prescription');
  assert.equal(failures[0].targetId, draft.id);
  assert.equal(failures[0].userId, f.caregiver.id);
  assert.equal((await f.request('PATCH', `/patients/${patient.id}`, { missedThresholdMinutes: 1 })).status, 400);
  const patientFailure = f.ctx.db.list('auditLogs', { patientId: patient.id, targetType: 'Patient', status: 'FAILURE' });
  assert.equal(patientFailure.length, 1);
  assert.equal(patientFailure[0].targetId, patient.id);

  const stranger = f.ctx.db.insert('caregivers', { id: newId(), email: `${newId()}@example.test` });
  const strangerToken = (await createTokenPair(f.ctx, stranger.id)).response.accessToken;
  assert.equal((await f.request('POST', `/prescriptions/${draft.id}/confirm`, undefined, strangerToken)).status, 403);
  assert.equal(f.ctx.db.list('auditLogs', { patientId: patient.id, status: 'FAILURE' }).length, 2);
  const forbidden = f.ctx.db.list('auditLogs', { userId: stranger.id, status: 'FAILURE' });
  assert.equal(forbidden.length, 1);
  assert.equal(forbidden[0].patientId, null);
  assert.equal(forbidden[0].targetId, null);

  assert.equal((await f.request('PATCH', `/patients/${patient.id}/audit-logs`, {})).status, 405);
  const blocked = f.ctx.db.list('auditLogs', { patientId: patient.id, status: 'FAILURE' });
  assert.equal(blocked.length, 3, 'one explicit immutable-log failure must not also produce a generic failure');
  assert.equal(blocked.filter(log => log.actionType === 'AUDIT_LOG_MUTATION_BLOCKED').length, 1);
  assert.deepEqual(f.ctx.db.get('auditLogs', failures[0].id), failures[0]);
});

test('authentication rate limits cannot be bypassed by case or trailing-slash route variants', async (t) => {
  const f = await fullFixture(t);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.equal((await f.request('POST', '/auth/login', { email: 'missing@example.test', password: 'wrong' })).status, 401);
  }
  assert.equal((await f.request('POST', '/auth/login', { email: 'missing@example.test', password: 'wrong' })).status, 429);
  assert.equal((await f.request('POST', '/AUTH/LOGIN', { email: 'missing@example.test', password: 'wrong' })).status, 429);
  assert.equal((await f.request('POST', '/auth/login/', { email: 'missing@example.test', password: 'wrong' })).status, 429);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await f.request('POST', '/devices/pair', { code: '999999', pushToken: 'test', platform: 'ANDROID' })).status, 410);
  }
  assert.equal((await f.request('POST', '/DEVICES/PAIR', { code: '999999', pushToken: 'test', platform: 'ANDROID' })).status, 429);
});
