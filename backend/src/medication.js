import { z } from 'zod';
import {
  ApiError, parse, dateSchema, idSchema, localDate, shiftDate, newId,
  TIME_SLOTS, DOSE_STATUSES, PRESCRIPTION_STATUSES,
} from './common.js';

const DEFAULT_TIMES = { MORNING: '07:00', NOON: '11:30', AFTERNOON: '15:00', EVENING: '19:00' };
const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const FINISHED = new Set(['TAKEN', 'TAKEN_BY_DELEGATE', 'LATE_CONFIRMED', 'MISSED']);
const MAX_GENERATED_DOSES = 50_000;
const itemSchema = z.object({
  drugId: idSchema.nullable().optional(),
  drugNameRaw: z.string().trim().min(1).max(200),
  unitsPerDose: z.number().finite().min(0.25),
  unit: z.string().trim().min(1).max(50).optional(),
  slots: z.array(z.enum(TIME_SLOTS)).min(1).max(4)
    .refine((slots) => new Set(slots).size === slots.length, 'Không được lặp buổi uống'),
  instruction: z.string().trim().max(200).optional(),
}).strict();
const prescriptionSchema = z.object({
  issuedDate: dateSchema,
  startDate: dateSchema,
  nextVisitDate: dateSchema,
  sourceNote: z.string().trim().max(200).optional(),
  items: z.array(itemSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (value.startDate < value.issuedDate) {
    context.addIssue({ code: 'custom', path: ['startDate'], message: 'Ngày bắt đầu phải từ ngày kê đơn trở đi' });
  }
  if (value.nextVisitDate < value.startDate) {
    context.addIssue({ code: 'custom', path: ['nextVisitDate'], message: 'Ngày tái khám phải từ ngày bắt đầu trở đi' });
  }
});
const confirmationSchema = z.object({
  takenAt: z.string().datetime({ offset: true }).optional(),
  correctsConfirmationId: idSchema.nullable().optional(),
}).strict();

function getPrescription(ctx, req, id) {
  const prescriptionId = parse(idSchema, id);
  const prescription = ctx.db.get('prescriptions', prescriptionId);
  if (!prescription) throw new ApiError(404, 'PRESCRIPTION_NOT_FOUND', 'Không tìm thấy đơn thuốc');
  ctx.patientAccess(req, prescription.patientId);
  req.auditContext = { patientId: prescription.patientId, targetType: 'Prescription', targetId: prescription.id };
  return prescription;
}

function serializePrescription(prescription) {
  return {
    id: prescription.id,
    patientId: prescription.patientId,
    issuedDate: prescription.issuedDate,
    startDate: prescription.startDate,
    nextVisitDate: prescription.nextVisitDate,
    sourceNote: prescription.sourceNote,
    items: prescription.items,
    status: prescription.status,
    confirmedAt: prescription.confirmedAt ?? null,
    warnings: prescription.warnings ?? [],
    supersededBy: prescription.supersededBy ?? null,
    createdAt: prescription.createdAt ?? null,
    updatedAt: prescription.updatedAt ?? prescription.createdAt ?? null,
  };
}

function medicationWarnings(ctx, items) {
  const seen = new Map();
  const duplicate = new Set();
  for (const item of items) {
    if (!item.drugId) continue;
    const drug = ctx.db.get('drugs', item.drugId);
    if (!drug) throw new ApiError(422, 'DRUG_NOT_FOUND', 'Thuốc được chọn không có trong danh mục');
    // Only catalogue-backed ingredients can be checked. Raw names remain unchanged.
    for (const ingredient of drug.activeIngredients ?? []) {
      const name = ingredient.name?.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase('vi');
      if (seen.has(key)) duplicate.add(seen.get(key));
      else seen.set(key, name);
    }
  }
  return [...duplicate].sort().map((name) => `Trùng hoạt chất: ${name}`);
}

function withItemIds(input) {
  return { ...input, items: input.items.map((item) => ({ ...item, id: newId() })) };
}

function audit(ctx, req, patientId, actionType, targetType, targetId, detail) {
  ctx.audit({ patientId, userId: req.actor.id, actionType, targetType, targetId, ...(detail ? { detail } : {}) });
}

function systemAudit(ctx, patientId, actionType, targetType, targetId, detail) {
  ctx.audit({
    patientId, userId: SYSTEM_ID,
    actionType, targetType, targetId, ...(detail ? { detail } : {}),
  });
}

const SLOT_LABELS = { MORNING: 'sáng', NOON: 'trưa', AFTERNOON: 'chiều', EVENING: 'tối' };
const vnTime = (iso) => {
  const [date, time] = new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().split('T');
  return `${time.slice(0, 5)} ngày ${date.slice(8, 10)}/${date.slice(5, 7)}`;
};

function emitAlert(ctx, alert) {
  ctx.events?.emit?.('alert', alert);
}

function createAlert(ctx, data, now) {
  if (ctx.db.list('alerts', { dedupKey: data.dedupKey }).length) return null;
  const alert = ctx.db.insert('alerts', {
    id: newId(), ...data, relatedDoseId: data.relatedDoseId ?? null,
    read: false, createdAt: now.toISOString(),
  });
  systemAudit(ctx, data.patientId, 'ALERT_CREATED', 'Alert', alert.id);
  return alert;
}

/** Advance time-based state and emit each missed-dose alert at most once. */
export function tickMedication(ctx) {
  const aliases = new Map();
  const patientAlias = (id) => {
    if (!aliases.has(id)) aliases.set(id, ctx.db.get('patients', id)?.alias || 'Bệnh nhân');
    return aliases.get(id);
  };
  const now = ctx.now();
  const nowMs = now.getTime();
  const today = localDate(now);
  const pendingAlerts = [];
  ctx.db.transaction(() => {
    for (const prescription of ctx.db.list('prescriptions', { status: 'ACTIVE' })) {
      if (prescription.nextVisitDate < today) {
        ctx.db.update('prescriptions', prescription.id, { status: 'EXPIRED', updatedAt: now.toISOString() });
        systemAudit(ctx, prescription.patientId, 'PRESCRIPTION_EXPIRED', 'Prescription', prescription.id);
      }
    }
    for (const dose of ctx.db.list('doses')) {
      if (!['SCHEDULED', 'PENDING'].includes(dose.status)) continue;
      if (nowMs < Date.parse(dose.scheduledAt)) continue;
      if (dose.status === 'SCHEDULED') {
        ctx.db.update('doses', dose.id, { status: 'PENDING' });
        systemAudit(ctx, dose.patientId, 'DOSE_PENDING', 'Dose', dose.id);
      }
      if (nowMs > Date.parse(dose.deadlineAt)) {
        ctx.db.update('doses', dose.id, { status: 'MISSED', missedAt: now.toISOString() });
        systemAudit(ctx, dose.patientId, 'DOSE_MISSED', 'Dose', dose.id);
        const alert = createAlert(ctx, {
          patientId: dose.patientId, type: 'DOSE_MISSED', relatedDoseId: dose.id,
          dedupKey: `dose-missed:${dose.id}`,
          message: `${patientAlias(dose.patientId)}: chưa có xác nhận cữ ${SLOT_LABELS[dose.slot] || ''} ${vnTime(dose.scheduledAt)} (${dose.drugDisplayName})`.replace(/\s+/g, ' '),
        }, now);
        if (alert) pendingAlerts.push(alert);
      }
    }
  });
  pendingAlerts.forEach((alert) => emitAlert(ctx, alert));
}

/** Confirmation plus a display label of who confirmed (device owner alias). */
export function serializeConfirmation(ctx, confirmation) {
  if (!confirmation) return null;
  const device = ctx.db.get('devices', confirmation.actorId);
  const fallback = confirmation.actorRole === 'PATIENT' ? ctx.db.get('patients', confirmation.patientId)?.alias : 'Người nhà';
  return { ...confirmation, actorLabel: device?.ownerAlias || fallback || '' };
}

export function serializeDose(ctx, dose) {
  const confirmation = dose.lastConfirmationId
    ? serializeConfirmation(ctx, ctx.db.get('confirmations', dose.lastConfirmationId))
    : null;
  return {
    id: dose.id,
    patientId: dose.patientId,
    prescriptionId: dose.prescriptionId,
    prescriptionItemId: dose.prescriptionItemId,
    drugDisplayName: dose.drugDisplayName,
    unitsPerDose: dose.unitsPerDose,
    unit: dose.unit,
    instruction: dose.instruction,
    slot: dose.slot,
    date: dose.date,
    scheduledAt: dose.scheduledAt,
    deadlineAt: dose.deadlineAt,
    status: dose.status,
    lastConfirmation: confirmation ?? null,
  };
}

/** Only assessed outcomes enter the denominator; pending/future/cancelled doses do not. */
export function adherence(ctx, patientId, days, includeLate = false) {
  const toDate = localDate(ctx.now());
  const fromDate = shiftDate(toDate, 1 - days);
  const doses = ctx.db.list('doses', { patientId }).filter((dose) => (
    dose.date >= fromDate && dose.date <= toDate && FINISHED.has(dose.status)
  ));
  const count = (status) => doses.filter((dose) => dose.status === status).length;
  const taken = count('TAKEN');
  const takenByDelegate = count('TAKEN_BY_DELEGATE');
  const lateConfirmed = count('LATE_CONFIRMED');
  return {
    fromDate, toDate, totalDoses: doses.length, taken, takenByDelegate,
    lateConfirmed, missed: count('MISSED'),
    adherenceRate: doses.length ? (taken + takenByDelegate + (includeLate ? lateConfirmed : 0)) / doses.length : 0,
  };
}

function generateDoses(ctx, prescription, patient, now) {
  const firstDateMs = Date.parse(`${prescription.startDate}T00:00:00Z`);
  const lastDateMs = Date.parse(`${prescription.nextVisitDate}T00:00:00Z`);
  const days = Math.round((lastDateMs - firstDateMs) / 86_400_000) + 1;
  const perDay = prescription.items.reduce((total, item) => total + item.slots.length, 0);
  if (days * perDay > MAX_GENERATED_DOSES) {
    throw new ApiError(422, 'PRESCRIPTION_TOO_LARGE', 'Đơn thuốc vượt giới hạn 50.000 cữ; hãy rút ngắn khoảng ngày');
  }
  const times = { ...DEFAULT_TIMES };
  for (const reminder of patient.reminderTimes ?? []) times[reminder.slot] = reminder.time;
  const threshold = patient.missedThresholdMinutes ?? 120;
  const existing = new Set(ctx.db.list('doses', { prescriptionId: prescription.id })
    .map((dose) => `${dose.prescriptionItemId}:${dose.date}:${dose.slot}`));
  let count = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftDate(prescription.startDate, offset);
    for (const item of prescription.items) {
      for (const slot of item.slots) {
        const key = `${item.id}:${date}:${slot}`;
        if (existing.has(key)) continue;
        const scheduledAt = new Date(`${date}T${times[slot]}:00+07:00`);
        ctx.db.insert('doses', {
          id: newId(), patientId: patient.id, prescriptionId: prescription.id,
          prescriptionItemId: item.id, drugDisplayName: item.drugNameRaw,
          unitsPerDose: item.unitsPerDose, unit: item.unit ?? 'viên', instruction: item.instruction ?? '',
          date, slot, scheduledAt: scheduledAt.toISOString(),
          deadlineAt: new Date(scheduledAt.getTime() + threshold * 60_000).toISOString(),
          status: 'SCHEDULED', lastConfirmationId: null, createdAt: now.toISOString(),
        });
        existing.add(key);
        count += 1;
      }
    }
  }
  return count;
}

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function registerMedicationRoutes(router, ctx) {
  router.get('/drugs', ctx.caregiver, (req, res) => {
    const query = parse(z.object({
      q: z.string().trim().min(2).max(200),
      limit: z.coerce.number().int().min(1).max(20).default(10),
    }).strict(), req.query);
    const term = normalizeSearch(query.q);
    const matches = ctx.db.list('drugs').map((drug) => {
      const brand = normalizeSearch(drug.brandName ?? '');
      const ingredients = (drug.activeIngredients ?? []).map((item) => normalizeSearch(item.name ?? '')).join(' ');
      return { drug, score: brand === term ? 0 : brand.startsWith(term) ? 1 : brand.includes(term) ? 2 : ingredients.includes(term) ? 3 : 4 };
    }).filter((item) => item.score < 4)
      .sort((a, b) => a.score - b.score || a.drug.brandName.localeCompare(b.drug.brandName, 'vi'));
    res.json(matches.slice(0, query.limit).map((item) => item.drug));
  });

  router.get('/drugs/:drugId', ctx.caregiver, (req, res) => {
    const drug = ctx.db.get('drugs', parse(idSchema, req.params.drugId));
    if (!drug) throw new ApiError(404, 'DRUG_NOT_FOUND', 'Không tìm thấy thuốc trong danh mục');
    res.json(drug);
  });

  router.get('/patients/:patientId/prescriptions', ctx.caregiver, (req, res) => {
    const patientId = parse(idSchema, req.params.patientId);
    ctx.patientAccess(req, patientId);
    const query = parse(z.object({ status: z.enum(PRESCRIPTION_STATUSES).optional() }).strict(), req.query);
    tickMedication(ctx);
    const prescriptions = ctx.db.list('prescriptions', { patientId })
      .filter((item) => !query.status || item.status === query.status)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    res.json(prescriptions.map(serializePrescription));
  });

  router.post('/patients/:patientId/prescriptions', ctx.caregiver, (req, res) => {
    const patientId = parse(idSchema, req.params.patientId);
    ctx.patientAccess(req, patientId);
    const input = parse(prescriptionSchema, req.body);
    const warnings = medicationWarnings(ctx, input.items);
    const prescription = ctx.db.transaction(() => {
      const created = ctx.db.insert('prescriptions', {
        ...withItemIds(input), id: newId(), patientId, status: 'DRAFT',
        confirmedAt: null, warnings, createdAt: ctx.now().toISOString(),
      });
      audit(ctx, req, patientId, 'PRESCRIPTION_CREATED', 'Prescription', created.id);
      return created;
    });
    res.status(201).json(serializePrescription(prescription));
  });

  router.get('/prescriptions/:prescriptionId', ctx.caregiver, (req, res) => {
    getPrescription(ctx, req, req.params.prescriptionId);
    tickMedication(ctx);
    res.json(serializePrescription(getPrescription(ctx, req, req.params.prescriptionId)));
  });

  router.put('/prescriptions/:prescriptionId', ctx.caregiver, (req, res) => {
    const prescription = getPrescription(ctx, req, req.params.prescriptionId);
    if (prescription.status !== 'DRAFT') throw new ApiError(409, 'PRESCRIPTION_NOT_DRAFT', 'Chỉ được sửa đơn thuốc nháp');
    const input = parse(prescriptionSchema, req.body);
    const warnings = medicationWarnings(ctx, input.items);
    const updated = ctx.db.transaction(() => {
      const record = ctx.db.update('prescriptions', prescription.id, {
        ...withItemIds(input), warnings, updatedAt: ctx.now().toISOString(),
      });
      audit(ctx, req, prescription.patientId, 'PRESCRIPTION_UPDATED', 'Prescription', prescription.id);
      return record;
    });
    res.json(serializePrescription(updated));
  });

  router.post('/prescriptions/:prescriptionId/cancel', ctx.caregiver, (req, res) => {
    const prescription = getPrescription(ctx, req, req.params.prescriptionId);
    parse(z.object({}).strict(), req.body ?? {});
    if (prescription.status !== 'DRAFT') throw new ApiError(409, 'PRESCRIPTION_NOT_DRAFT', 'Chỉ được hủy đơn thuốc nháp');
    const cancelled = ctx.db.transaction(() => {
      const record = ctx.db.update('prescriptions', prescription.id, { status: 'CANCELLED', updatedAt: ctx.now().toISOString() });
      audit(ctx, req, prescription.patientId, 'PRESCRIPTION_CANCELLED', 'Prescription', prescription.id);
      return record;
    });
    res.json(serializePrescription(cancelled));
  });

  router.post('/prescriptions/:prescriptionId/confirm', ctx.caregiver, (req, res) => {
    const prescription = getPrescription(ctx, req, req.params.prescriptionId);
    parse(z.object({}).strict(), req.body ?? {});
    if (prescription.status !== 'DRAFT') throw new ApiError(409, 'PRESCRIPTION_NOT_DRAFT', 'Chỉ được xác nhận đơn thuốc nháp');
    const now = ctx.now();
    if (prescription.nextVisitDate < localDate(now)) {
      throw new ApiError(422, 'PRESCRIPTION_ALREADY_EXPIRED', 'Ngày tái khám đã qua; không thể kích hoạt đơn thuốc');
    }
    const patient = ctx.patientAccess(req, prescription.patientId);
    const alerts = [];
    const confirmed = ctx.db.transaction(() => {
      for (const previous of ctx.db.list('prescriptions', { patientId: prescription.patientId, status: 'ACTIVE' })) {
        ctx.db.update('prescriptions', previous.id, { status: 'SUPERSEDED', supersededBy: prescription.id, updatedAt: now.toISOString() });
        audit(ctx, req, patient.id, 'PRESCRIPTION_SUPERSEDED', 'Prescription', previous.id);
        for (const dose of ctx.db.list('doses', { prescriptionId: previous.id, status: 'SCHEDULED' })) {
          if (Date.parse(dose.scheduledAt) > now.getTime()) {
            ctx.db.update('doses', dose.id, { status: 'CANCELLED' });
            audit(ctx, req, patient.id, 'DOSE_CANCELLED', 'Dose', dose.id);
          }
        }
      }
      const warnings = medicationWarnings(ctx, prescription.items);
      const record = ctx.db.update('prescriptions', prescription.id, {
        status: 'ACTIVE', confirmedAt: now.toISOString(), warnings, updatedAt: now.toISOString(),
      });
      const count = generateDoses(ctx, record, patient, now);
      audit(ctx, req, patient.id, 'PRESCRIPTION_CONFIRMED', 'Prescription', prescription.id);
      audit(ctx, req, patient.id, 'DOSES_GENERATED', 'Prescription', prescription.id, { count });
      if (warnings.length) {
        const alert = createAlert(ctx, {
          patientId: patient.id, type: 'DUPLICATE_INGREDIENT',
          dedupKey: `duplicate-ingredient:${prescription.id}`, message: warnings.join('; '),
        }, now);
        if (alert) alerts.push(alert);
      }
      return record;
    });
    alerts.forEach((alert) => emitAlert(ctx, alert));
    tickMedication(ctx);
    res.status(202).json(serializePrescription(confirmed));
  });

  router.get('/patients/:patientId/doses', ctx.caregiver, (req, res) => {
    const patientId = parse(idSchema, req.params.patientId);
    ctx.patientAccess(req, patientId);
    const query = parse(z.object({
      from: dateSchema, to: dateSchema, status: z.enum(DOSE_STATUSES).optional(),
    }).strict().refine((value) => value.to >= value.from, { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' }), req.query);
    tickMedication(ctx);
    const doses = ctx.db.list('doses', { patientId }).filter((dose) => (
      dose.date >= query.from && dose.date <= query.to && (!query.status || dose.status === query.status)
    )).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
    res.json(doses.map((dose) => serializeDose(ctx, dose)));
  });

  router.get('/device/doses/today', ctx.device, (req, res) => {
    tickMedication(ctx);
    const today = localDate(ctx.now());
    const doses = ctx.db.list('doses', { patientId: req.actor.patientId, date: today })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
    res.json(doses.map((dose) => serializeDose(ctx, dose)));
  });

  router.post('/doses/:doseId/confirmations', ctx.device, (req, res) => {
    const doseId = parse(idSchema, req.params.doseId);
    const input = parse(confirmationSchema, req.body ?? {});
    const existing = ctx.db.get('doses', doseId);
    if (!existing) throw new ApiError(404, 'DOSE_NOT_FOUND', 'Không tìm thấy cữ thuốc');
    if (existing.patientId !== req.actor.patientId) throw new ApiError(403, 'FORBIDDEN', 'Thiết bị không có quyền trên cữ thuốc này');
    req.auditContext = { patientId: existing.patientId, targetType: 'Dose', targetId: existing.id };
    tickMedication(ctx);
    const now = ctx.now();
    const takenAt = input.takenAt ? new Date(input.takenAt) : now;
    const dose = ctx.db.get('doses', doseId);
    if (dose.status === 'CANCELLED') throw new ApiError(409, 'DOSE_CANCELLED', 'Cữ thuốc đã bị hủy');
    if (takenAt.getTime() < Date.parse(dose.scheduledAt) || takenAt.getTime() > now.getTime()) {
      throw new ApiError(422, 'INVALID_TAKEN_AT', 'Thời điểm uống phải từ giờ cữ thuốc đến thời điểm hiện tại');
    }
    if (localDate(takenAt) !== dose.date) {
      throw new ApiError(422, 'CONFIRMATION_OUTSIDE_DOSE_DAY', 'Chỉ ghi nhận thời điểm uống trong ngày của cữ thuốc');
    }
    const maxAgeHours = ctx.config.offlineMaxAgeHours ?? 72;
    if (now.getTime() - takenAt.getTime() > maxAgeHours * 3_600_000) {
      throw new ApiError(422, 'CONFIRMATION_TOO_OLD', `Xác nhận ngoại tuyến phải được gửi trong ${maxAgeHours} giờ`);
    }
    if (input.correctsConfirmationId) {
      const previous = ctx.db.get('confirmations', input.correctsConfirmationId);
      if (!previous || previous.doseId !== doseId || dose.lastConfirmationId !== previous.id) {
        throw new ApiError(409, 'INVALID_CORRECTION', 'Chỉ được đính chính xác nhận mới nhất của cùng cữ thuốc');
      }
    } else if (dose.lastConfirmationId) {
      throw new ApiError(409, 'DOSE_ALREADY_CONFIRMED', 'Cữ thuốc này đã được xác nhận');
    }
    const resultingStatus = takenAt.getTime() > Date.parse(dose.deadlineAt)
      ? 'LATE_CONFIRMED'
      : req.actor.role === 'DELEGATE' ? 'TAKEN_BY_DELEGATE' : 'TAKEN';
    const confirmation = ctx.db.transaction(() => {
      const created = ctx.db.insert('confirmations', {
        id: newId(), doseId, patientId: dose.patientId, actorRole: req.actor.role, actorId: req.actor.id,
        takenAt: takenAt.toISOString(), recordedAt: now.toISOString(), resultingStatus,
        correctsConfirmationId: input.correctsConfirmationId ?? null,
      });
      ctx.db.update('doses', dose.id, { status: resultingStatus, lastConfirmationId: created.id });
      audit(ctx, req, dose.patientId, input.correctsConfirmationId ? 'DOSE_CONFIRMATION_CORRECTED' : 'DOSE_CONFIRMED', 'Dose', dose.id);
      return created;
    });
    res.status(201).json(confirmation);
  });

  // Caregiver view of the append-only chain: original record and every correction.
  router.get('/doses/:doseId/confirmations', ctx.caregiver, (req, res) => {
    const dose = ctx.db.get('doses', parse(idSchema, req.params.doseId));
    if (!dose) throw new ApiError(404, 'DOSE_NOT_FOUND', 'Không tìm thấy cữ thuốc');
    ctx.patientAccess(req, dose.patientId);
    // Follow the correction links from the original record so the order is exact even when
    // several records share a timestamp.
    const records = ctx.db.list('confirmations', { doseId: dose.id });
    const successor = new Map(records.filter((item) => item.correctsConfirmationId).map((item) => [item.correctsConfirmationId, item]));
    const chain = [];
    for (let item = records.find((r) => !r.correctsConfirmationId); item; item = successor.get(item.id)) chain.push(item);
    res.json(chain.map((item) => serializeConfirmation(ctx, item)));
  });

  // US-10: "when did I last take my medicine?" may refer to yesterday, beyond /device/doses/today.
  router.get('/device/doses/last-confirmed', ctx.device, (req, res) => {
    tickMedication(ctx);
    const confirmed = ctx.db.list('doses', { patientId: req.actor.patientId })
      .filter((dose) => dose.lastConfirmationId && ['TAKEN', 'TAKEN_BY_DELEGATE', 'LATE_CONFIRMED'].includes(dose.status))
      .map((dose) => ({ dose, confirmation: serializeConfirmation(ctx, ctx.db.get('confirmations', dose.lastConfirmationId)) }))
      .sort((a, b) => b.confirmation.takenAt.localeCompare(a.confirmation.takenAt));
    const latest = confirmed[0];
    if (!latest) return res.json(null);
    const sameSlot = confirmed.filter(({ dose }) => dose.date === latest.dose.date && dose.slot === latest.dose.slot);
    res.json({
      date: latest.dose.date, slot: latest.dose.slot, takenAt: latest.confirmation.takenAt,
      actorRole: latest.confirmation.actorRole, actorLabel: latest.confirmation.actorLabel,
      drugs: sameSlot.map(({ dose }) => dose.drugDisplayName),
    });
  });

  // These methods are explicitly refused: history can only be corrected by appending.
  const getDeviceConfirmation = (req) => {
    const confirmationId = parse(idSchema, req.params.confirmationId);
    const confirmation = ctx.db.get('confirmations', confirmationId);
    if (!confirmation) throw new ApiError(404, 'CONFIRMATION_NOT_FOUND', 'Không tìm thấy xác nhận');
    if (confirmation.patientId !== req.actor.patientId) throw new ApiError(403, 'FORBIDDEN', 'Thiết bị không có quyền trên xác nhận này');
    if (req.params.doseId && parse(idSchema, req.params.doseId) !== confirmation.doseId) {
      throw new ApiError(404, 'CONFIRMATION_NOT_FOUND', 'Không tìm thấy xác nhận trong cữ thuốc này');
    }
    req.auditContext = { patientId: confirmation.patientId, targetType: 'Confirmation', targetId: confirmation.id };
    return confirmation;
  };
  const rejectConfirmationMutation = (req, res) => {
    getDeviceConfirmation(req);
    res.set('Allow', 'GET');
    throw new ApiError(405, 'CONFIRMATION_IMMUTABLE', 'Không được sửa hoặc xóa xác nhận; hãy tạo bản ghi đính chính mới');
  };
  for (const path of ['/confirmations/:confirmationId', '/doses/:doseId/confirmations/:confirmationId']) {
    router.get(path, ctx.device, (req, res) => res.json(getDeviceConfirmation(req)));
    router.patch(path, ctx.device, rejectConfirmationMutation);
    router.delete(path, ctx.device, rejectConfirmationMutation);
  }

  router.get('/patients/:patientId/adherence/summary', ctx.caregiver, (req, res) => {
    const patientId = parse(idSchema, req.params.patientId);
    ctx.patientAccess(req, patientId);
    const query = parse(z.object({ days: z.coerce.number().refine((value) => [7, 30, 90].includes(value)).default(30) }).strict(), req.query);
    tickMedication(ctx);
    res.json(adherence(ctx, patientId, query.days, ctx.config.includeLateInRate ?? false));
  });
}
