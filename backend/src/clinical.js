import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { ApiError, parse, dateSchema, idSchema, localDate, shiftDate, newId } from './common.js';
import { adherenceSummary, serializeConfirmation } from './medication.js';
import { drawClinicalReport } from './report-pdf.js';

const labInput = z.object({
  testType: z.enum(['FASTING_GLUCOSE', 'HBA1C', 'POSTPRANDIAL_GLUCOSE', 'OTHER']),
  value: z.number().finite().min(0),
  unit: z.string().trim().min(1).max(30),
  testedDate: dateSchema,
  note: z.string().trim().max(200).default(''),
}).strict();
const appointmentInput = z.object({
  visitDate: dateSchema,
  remindDaysBefore: z.number().int().min(0).max(14).default(2),
  note: z.string().trim().max(200).default(''),
}).strict();
const reportInput = z.object({ periodDays: z.union([z.literal(30), z.literal(60), z.literal(90)]) }).strict();
const workers = new WeakSet();
const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';

function publicReport(report) {
  const { id, patientId, status, periodDays, fromDate, toDate, downloadUrl = null, createdAt, completedAt, errorCode } = report;
  return { id, patientId, status, periodDays, ...(fromDate ? { fromDate, toDate } : {}), downloadUrl, createdAt, ...(completedAt ? { completedAt } : {}), ...(errorCode ? { errorCode } : {}) };
}

/** Who performed an audited action, resolved for display (caregiver, device owner or scheduler). */
function auditActor(ctx, log, cache) {
  if (cache.has(log.userId)) return cache.get(log.userId);
  let actor = { actorRole: 'SYSTEM', actorLabel: 'Hệ thống' };
  if (log.userId && log.userId !== SYSTEM_ID) {
    const caregiver = ctx.db.get('caregivers', log.userId);
    const device = caregiver ? null : ctx.db.get('devices', log.userId);
    const account = caregiver || device ? null : ctx.db.get('patientAccounts', log.userId);
    if (caregiver) actor = { actorRole: 'CAREGIVER', actorLabel: caregiver.displayName };
    else if (device) actor = { actorRole: device.role, actorLabel: device.ownerAlias };
    else if (account) actor = { actorRole: 'PATIENT', actorLabel: account.displayName };
    else actor = { actorRole: 'UNKNOWN', actorLabel: 'Không xác định' };
  }
  cache.set(log.userId, actor);
  return actor;
}

function owned(ctx, req, table, id, code) {
  const item = ctx.db.get(table, parse(idSchema, id));
  if (!item) throw new ApiError(404, code, 'Không tìm thấy bản ghi.');
  ctx.patientAccess(req, item.patientId);
  const targetTypes = { reports: 'Report', appointments: 'Appointment', alerts: 'Alert' };
  req.auditContext = { patientId: item.patientId, userId: req.actor.id, targetType: targetTypes[table] || table, targetId: item.id };
  return item;
}

function patientId(ctx, req) {
  const id = parse(idSchema, req.params.patientId);
  ctx.patientAccess(req, id);
  return id;
}

function newest(items, key) {
  return [...items].sort((a, b) => String(b[key]).localeCompare(String(a[key])));
}

function reportFile(ctx, id, temporary = false) {
  // File names are generated UUIDs, never user-provided paths or report metadata.
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid report identifier');
  const root = path.resolve(ctx.config.reportDir || 'data/reports');
  return path.join(root, `${id}.pdf${temporary ? '.tmp' : ''}`);
}

export function registerClinicalRoutes(router, ctx) {
  router.get('/patients/:patientId/lab-results', ctx.caregiver, (req, res) => {
    res.json(newest(ctx.db.list('labResults', { patientId: patientId(ctx, req) }), 'testedDate'));
  });
  router.post('/patients/:patientId/lab-results', ctx.caregiver, (req, res) => {
    const id = patientId(ctx, req);
    const input = parse(labInput, req.body);
    if (input.testedDate > localDate(ctx.now())) throw new ApiError(400, 'FUTURE_TEST_DATE', 'Ngày xét nghiệm không được ở tương lai.');
    const record = { id: newId(), patientId: id, ...input, createdAt: ctx.now().toISOString() };
    ctx.db.transaction(() => {
      ctx.db.insert('labResults', record);
      ctx.audit({ patientId: id, userId: req.actor.id, actionType: 'LAB_RESULT_CREATED', targetType: 'LabResult', targetId: record.id });
    });
    res.status(201).json(record);
  });
  router.get('/patients/:patientId/appointments', ctx.caregiver, (req, res) => {
    res.json(newest(ctx.db.list('appointments', { patientId: patientId(ctx, req) }), 'visitDate'));
  });
  router.post('/patients/:patientId/appointments', ctx.caregiver, (req, res) => {
    const id = patientId(ctx, req);
    const input = parse(appointmentInput, req.body);
    const record = { id: newId(), patientId: id, ...input, status: 'UPCOMING', createdAt: ctx.now().toISOString() };
    ctx.db.transaction(() => {
      ctx.db.insert('appointments', record);
      ctx.audit({ patientId: id, userId: req.actor.id, actionType: 'APPOINTMENT_CREATED', targetType: 'Appointment', targetId: record.id });
    });
    res.status(201).json(record);
  });
  router.patch('/appointments/:appointmentId', ctx.caregiver, (req, res) => {
    const record = owned(ctx, req, 'appointments', req.params.appointmentId, 'APPOINTMENT_NOT_FOUND');
    const patch = parse(z.object({ status: z.enum(['UPCOMING', 'DONE', 'MISSED']) }).strict(), req.body);
    const updated = ctx.db.transaction(() => {
      const result = ctx.db.update('appointments', record.id, { ...patch, updatedAt: ctx.now().toISOString() });
      ctx.audit({ patientId: record.patientId, userId: req.actor.id, actionType: 'APPOINTMENT_UPDATED', targetType: 'Appointment', targetId: record.id });
      return result;
    });
    res.json(updated);
  });
  router.get('/patients/:patientId/alerts', ctx.caregiver, (req, res) => {
    const id = patientId(ctx, req);
    const { unreadOnly } = parse(z.object({ unreadOnly: z.enum(['true', 'false']).default('false') }), req.query);
    const items = ctx.db.list('alerts', { patientId: id }).filter((alert) => unreadOnly !== 'true' || !alert.read);
    res.json(newest(items, 'createdAt'));
  });
  router.patch('/alerts/:alertId/read', ctx.caregiver, (req, res) => {
    const alert = owned(ctx, req, 'alerts', req.params.alertId, 'ALERT_NOT_FOUND');
    parse(z.object({}).strict(), req.body || {});
    const updated = ctx.db.transaction(() => {
      const result = ctx.db.update('alerts', alert.id, { read: true, readAt: ctx.now().toISOString() });
      ctx.audit({ patientId: alert.patientId, userId: req.actor.id, actionType: 'ALERT_READ', targetType: 'Alert', targetId: alert.id });
      return result;
    });
    res.json(updated);
  });
  // Bulk variant used by "mark all as read"; idempotent, one audit entry per call.
  router.post('/patients/:patientId/alerts/read', ctx.caregiver, (req, res) => {
    const id = patientId(ctx, req);
    const { alertIds } = parse(z.object({ alertIds: z.array(idSchema).max(500).optional() }).strict(), req.body || {});
    const wanted = alertIds && new Set(alertIds);
    const updated = ctx.db.transaction(() => {
      const targets = ctx.db.list('alerts', { patientId: id }).filter((alert) => !alert.read && (!wanted || wanted.has(alert.id)));
      for (const alert of targets) ctx.db.update('alerts', alert.id, { read: true, readAt: ctx.now().toISOString() });
      if (targets.length) ctx.audit({ patientId: id, userId: req.actor.id, actionType: 'ALERTS_READ', targetType: 'Alert', targetId: targets.length === 1 ? targets[0].id : null, detail: `${targets.length}` });
      return targets.length;
    });
    res.json({ updated });
  });
  router.get('/patients/:patientId/reports', ctx.caregiver, (req, res) => {
    res.json(newest(ctx.db.list('reports', { patientId: patientId(ctx, req) }), 'createdAt').map(publicReport));
  });
  router.post('/patients/:patientId/reports', ctx.caregiver, (req, res) => {
    const id = patientId(ctx, req);
    const input = parse(reportInput, req.body);
    const toDate = localDate(ctx.now());
    const report = { id: newId(), patientId: id, ...input, fromDate: shiftDate(toDate, -(input.periodDays - 1)), toDate, status: 'QUEUED', downloadUrl: null, createdAt: ctx.now().toISOString(), requestedBy: req.actor.id };
    ctx.db.transaction(() => {
      ctx.db.insert('reports', report);
      ctx.audit({ patientId: id, userId: req.actor.id, actionType: 'REPORT_REQUESTED', targetType: 'Report', targetId: report.id });
    });
    ctx.events.emit('report-requested', report.id);
    res.status(202).json(publicReport(report));
  });
  router.get('/reports/:reportId', ctx.caregiver, (req, res) => {
    res.json(publicReport(owned(ctx, req, 'reports', req.params.reportId, 'REPORT_NOT_FOUND')));
  });
  router.get('/reports/:reportId/download', ctx.caregiver, (req, res, next) => {
    const report = owned(ctx, req, 'reports', req.params.reportId, 'REPORT_NOT_FOUND');
    if (report.status !== 'READY') throw new ApiError(409, 'REPORT_NOT_READY', 'Báo cáo chưa sẵn sàng để tải.');
    const file = reportFile(ctx, report.id);
    if (!existsSync(file)) throw new ApiError(404, 'REPORT_FILE_NOT_FOUND', 'Tệp báo cáo không còn sẵn có. Hãy tạo lại báo cáo.');
    ctx.audit({ patientId: report.patientId, userId: req.actor.id, actionType: 'REPORT_DOWNLOADED', targetType: 'Report', targetId: report.id });
    res.set('Cache-Control', 'private, no-store');
    res.download(file, `AnTam_${report.periodDays}ngay_${report.id}.pdf`, (error) => {
      if (error && !res.headersSent) next(new ApiError(500, 'REPORT_DOWNLOAD_FAILED', 'Không thể tải báo cáo.'));
    });
  });
  router.get('/patients/:patientId/audit-logs', ctx.caregiver, (req, res) => {
    const id = patientId(ctx, req);
    const { page, size, actionType, actorRole, status, q } = parse(z.object({
      page: z.coerce.number().int().min(1).max(1000000).default(1),
      size: z.coerce.number().int().min(1).max(100).default(20),
      actionType: z.string().regex(/^[A-Z_]{1,64}$/).optional(),
      actorRole: z.enum(['CAREGIVER', 'PATIENT', 'DELEGATE', 'SYSTEM']).optional(),
      status: z.enum(['SUCCESS', 'FAILURE']).optional(),
      q: z.string().trim().max(100).optional(),
    }), req.query);
    const cache = new Map();
    const needle = q?.toLowerCase();
    const logs = newest(ctx.db.list('auditLogs', { patientId: id }), 'timestamp')
      .map((log) => ({ ...log, ...auditActor(ctx, log, cache) }))
      .filter((log) => (!actionType || log.actionType === actionType)
        && (!actorRole || log.actorRole === actorRole)
        && (!status || log.status === status)
        && (!needle || [log.actionType, log.targetType, log.targetId, log.detail, log.actorLabel].some((value) => String(value ?? '').toLowerCase().includes(needle))));
    res.json({ items: logs.slice((page - 1) * size, page * size), page, size, total: logs.length });
  });
  const immutable = (req, res) => {
    const id = patientId(ctx, req);
    if (req.params.logId) {
      const log = ctx.db.get('auditLogs', parse(idSchema, req.params.logId));
      if (!log || log.patientId !== id) throw new ApiError(404, 'AUDIT_LOG_NOT_FOUND', 'Không tìm thấy nhật ký.');
    }
    req.auditContext = { patientId: id, userId: req.actor.id, targetType: 'AuditLog', targetId: req.params.logId || id };
    ctx.audit({ patientId: id, userId: req.actor.id, actionType: 'AUDIT_LOG_MUTATION_BLOCKED', targetType: 'AuditLog', targetId: req.params.logId || id, status: 'FAILURE' });
    req.failureAudited = true;
    res.set('Allow', 'GET');
    throw new ApiError(405, 'AUDIT_LOG_IMMUTABLE', 'Nhật ký chỉ được bổ sung; không thể sửa hoặc xóa.');
  };
  for (const method of ['post', 'put', 'patch', 'delete']) {
    router[method]('/patients/:patientId/audit-logs', ctx.caregiver, immutable);
    router[method]('/patients/:patientId/audit-logs/:logId', ctx.caregiver, immutable);
  }
}

async function createPdf(ctx, report) {
  const patient = ctx.db.get('patients', report.patientId);
  if (!patient) throw new Error('Patient unavailable');
  const generatedAt = ctx.now();
  const toDate = report.toDate || localDate(report.createdAt || generatedAt);
  const fromDate = report.fromDate || shiftDate(toDate, -(report.periodDays - 1));
  const inPeriod = (date) => date >= fromDate && date <= toDate;
  const doses = ctx.db.list('doses', { patientId: patient.id })
    .filter((dose) => inPeriod(dose.date || localDate(dose.scheduledAt)))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))
    .map((dose) => {
      const last = dose.lastConfirmationId ? ctx.db.get('confirmations', dose.lastConfirmationId) : null;
      // A caregiver correction updates the reported intake time, but the journal identifies the original confirmer.
      let original = last;
      while (original?.correctsConfirmationId) original = ctx.db.get('confirmations', original.correctsConfirmationId);
      return { ...dose, takenAt: last?.takenAt, confirmation: serializeConfirmation(ctx, original) };
    });
  const includeLate = ctx.config.includeLateInRate === true;
  const summary = adherenceSummary(doses, includeLate);
  const [prescription] = ctx.db.list('prescriptions', { patientId: patient.id, status: 'ACTIVE' });
  const labs = ctx.db.list('labResults', { patientId: patient.id }).filter((lab) => inPeriod(lab.testedDate))
    .sort((a, b) => b.testedDate.localeCompare(a.testedDate) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const appointments = ctx.db.list('appointments', { patientId: patient.id, status: 'UPCOMING' })
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  const fontPath = ctx.config.fontPath || (process.platform === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
  if (!existsSync(fontPath)) throw new Error('Report font unavailable');
  const file = reportFile(ctx, report.id);
  const temp = reportFile(ctx, report.id, true);
  await mkdir(path.dirname(file), { recursive: true });
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 26, bufferPages: true, info: { Title: `An Tâm - Báo cáo ${report.periodDays} ngày`, Author: 'An Tâm', Subject: 'Tổng hợp dữ liệu đã ghi nhận' } });
  const out = createWriteStream(temp, { flags: 'w', mode: 0o600 });
  const finished = new Promise((resolve, reject) => {
    out.once('finish', resolve);
    out.once('error', reject);
    doc.once('error', reject);
  });
  // Attach a handler immediately, including if a font/layout error occurs before await.
  finished.catch(() => {});
  doc.pipe(out);
  try {
    doc.font(fontPath);
    drawClinicalReport(doc, { patient, prescription, appointments, labs, doses, summary, includeLate,
      fromDate, toDate, periodDays: report.periodDays, exportDate: localDate(generatedAt) });
    doc.end();
    await finished;
    await rename(temp, file);
  } catch (error) {
    doc.destroy();
    out.destroy();
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

export async function tickClinical(ctx) {
  if (workers.has(ctx)) return;
  workers.add(ctx);
  try {
    const today = localDate(ctx.now());
    const alertsToEmit = [];
    ctx.db.transaction(() => {
      for (const appointment of ctx.db.list('appointments', { status: 'UPCOMING' })) {
        if (appointment.visitDate < today) {
          ctx.db.update('appointments', appointment.id, { status: 'MISSED', updatedAt: ctx.now().toISOString() });
          ctx.audit({ patientId: appointment.patientId, userId: SYSTEM_ID, actionType: 'APPOINTMENT_MARKED_MISSED', targetType: 'Appointment', targetId: appointment.id });
          continue;
        }
        if (today < shiftDate(appointment.visitDate, -appointment.remindDaysBefore)) continue;
        const existing = ctx.db.list('alerts', { patientId: appointment.patientId }).some((alert) => alert.type === 'VISIT_UPCOMING' && alert.relatedAppointmentId === appointment.id);
        if (existing) continue;
        const alert = { id: newId(), patientId: appointment.patientId, type: 'VISIT_UPCOMING', message: `${ctx.db.get('patients', appointment.patientId)?.alias || 'Bệnh nhân'}: lịch tái khám ngày ${appointment.visitDate.split('-').reverse().join('/')}${appointment.note ? ` — ${appointment.note}` : ''}`, relatedDoseId: null, relatedAppointmentId: appointment.id, read: false, createdAt: ctx.now().toISOString() };
        ctx.db.insert('alerts', alert);
        ctx.audit({ patientId: appointment.patientId, userId: SYSTEM_ID, actionType: 'VISIT_REMINDER_CREATED', targetType: 'Appointment', targetId: appointment.id });
        alertsToEmit.push(alert);
      }
    });
    for (const alert of alertsToEmit) ctx.events.emit('alert', alert);
    // PROCESSING jobs are retried after a restart. A per-context guard prevents overlap.
    const pending = ctx.db.list('reports').filter((report) => ['QUEUED', 'PROCESSING'].includes(report.status)).slice(0, 3);
    for (const report of pending) {
      ctx.db.transaction(() => {
        ctx.db.update('reports', report.id, { status: 'PROCESSING', errorCode: null });
        ctx.audit({ patientId: report.patientId, userId: SYSTEM_ID, actionType: 'REPORT_PROCESSING', targetType: 'Report', targetId: report.id });
      });
      try {
        await createPdf(ctx, report);
        ctx.db.transaction(() => {
          ctx.db.update('reports', report.id, { status: 'READY', completedAt: ctx.now().toISOString(), downloadUrl: `${ctx.config.baseUrl.replace(/\/$/, '')}/api/v1/reports/${report.id}/download` });
          ctx.audit({ patientId: report.patientId, userId: SYSTEM_ID, actionType: 'REPORT_PDF_GENERATED', targetType: 'Report', targetId: report.id });
        });
      } catch {
        ctx.db.transaction(() => {
          ctx.db.update('reports', report.id, { status: 'FAILED', downloadUrl: null, completedAt: ctx.now().toISOString(), errorCode: 'REPORT_GENERATION_FAILED' });
          ctx.audit({ patientId: report.patientId, userId: SYSTEM_ID, actionType: 'REPORT_GENERATION_FAILED', targetType: 'Report', targetId: report.id, status: 'FAILURE' });
        });
      }
    }
  } finally {
    workers.delete(ctx);
  }
}
