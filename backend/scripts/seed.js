import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { DEFAULT_REMINDERS, localDate, newId, shiftDate } from '../src/common.js';
import { encryptToken, hashPassword, hashToken, opaqueToken } from '../src/security.js';
import { tickMedication } from '../src/medication.js';

// Fake demo data only (Zero PII: aliases and birth years). History is written straight into
// the store because the public API intentionally refuses back-dated confirmations.
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const DRUG = {
  glucophage500: '10000000-0000-4000-8000-000000000001',
  panfor500: '10000000-0000-4000-8000-000000000002',
  diamicron30: '10000000-0000-4000-8000-000000000003',
  glucophage850: '6f1c2a10-0002-4a01-9a01-000000000002',
  januvia50: '6f1c2a10-0010-4a01-9a01-000000000010',
};

const runtime = await createApp();
const { ctx } = runtime;
const { db } = ctx;
const email = (process.env.DEMO_EMAIL || 'demo@antam.local').toLowerCase();

if (db.list('caregivers', { email }).length) {
  console.log(`Tài khoản ${email} đã tồn tại; giữ nguyên dữ liệu và mật khẩu.`);
  runtime.close();
} else {
  const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(12).toString('base64url')}`;
  const passwordHash = await hashPassword(password);
  try {
    seed(passwordHash);
    tickMedication(ctx); // bring today's doses up to the current time
    console.log(`Đã tạo dữ liệu mẫu cho ${email}`);
    console.log(`Email: ${email}\nMật khẩu demo: ${password}`);
  } finally {
    runtime.close();
  }
}

function seed(passwordHash) {
  const now = ctx.now();
  const nowMs = +now;
  const today = localDate(now);
  const day = (offset) => shiftDate(today, offset);
  const at = (date, time) => new Date(`${date}T${time}:00+07:00`).toISOString();
  const iso = (ms) => new Date(ms).toISOString();
  // Deterministic "randomness" so every seeded database tells the same story.
  const rand = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return h / 0xffffffff;
  };
  const log = (entry, timestamp) => db.insert('auditLogs', {
    id: newId(), patientId: null, userId: SYSTEM_ID, targetId: null, status: 'SUCCESS', detail: '', ...entry, timestamp,
  });

  db.transaction(() => {
    const caregiver = db.insert('caregivers', { id: newId(), email, displayName: 'Người con (demo)', passwordHash, createdAt: at(day(-95), '20:00') });
    const asCaregiver = { userId: caregiver.id };
    log({ ...asCaregiver, actionType: 'ACCOUNT_REGISTERED', targetType: 'Caregiver', targetId: caregiver.id }, caregiver.createdAt);

    const bo = db.insert('patients', {
      id: newId(), alias: 'Bố', birthYear: 1954, caregiverId: caregiver.id,
      reminderTimes: DEFAULT_REMINDERS, missedThresholdMinutes: 120, createdAt: at(day(-95), '20:10'),
    });
    const me = db.insert('patients', {
      id: newId(), alias: 'Mẹ', birthYear: 1957, caregiverId: caregiver.id,
      reminderTimes: [{ slot: 'MORNING', time: '06:30' }, { slot: 'NOON', time: '11:30' }, { slot: 'AFTERNOON', time: '15:00' }, { slot: 'EVENING', time: '18:30' }],
      missedThresholdMinutes: 120, createdAt: at(day(-2), '21:15'),
    });
    for (const patient of [bo, me]) {
      log({ ...asCaregiver, patientId: patient.id, actionType: 'PATIENT_CREATED', targetType: 'Patient', targetId: patient.id }, patient.createdAt);
    }

    // Mẹ lives with Bố and may confirm on his behalf (UC-04).
    const delegate = db.insert('delegates', { id: newId(), alias: 'Mẹ', relation: 'Vợ, sống cùng nhà', patientId: bo.id, active: true, createdAt: at(day(-93), '19:30') });
    log({ ...asCaregiver, patientId: bo.id, actionType: 'DELEGATE_CREATED', targetType: 'Delegate', targetId: delegate.id }, delegate.createdAt);

    // The phones that produced the history. Their tokens are discarded, so they are shown as
    // revoked; pair the simulated phone in the web app to continue from today.
    const device = (role, ownerAlias, delegateId, pairedAt, deviceName) => {
      const record = db.insert('devices', {
        id: newId(), patientId: bo.id, role, delegateId, ownerAlias, deviceName, platform: 'ANDROID',
        tokenHash: hashToken(opaqueToken()), pushTokenEncrypted: encryptToken(`seed-${newId()}`, ctx.config.tokenEncryptionKey),
        active: false, pairedAt, revokedAt: iso(nowMs - 60_000), expiresAt: iso(Date.parse(pairedAt) + 90 * 86_400_000),
      });
      log({ userId: record.id, patientId: bo.id, actionType: 'DEVICE_PAIRED', targetType: 'Device', targetId: record.id }, pairedAt);
      log({ ...asCaregiver, patientId: bo.id, actionType: 'DEVICE_REVOKED', targetType: 'Device', targetId: record.id, detail: 'Dữ liệu mẫu: máy cũ, hãy ghép điện thoại mô phỏng' }, record.revokedAt);
      return record;
    };
    const boPhone = device('PATIENT', 'Bố', null, at(day(-94), '08:00'), 'Máy cũ của Bố (dữ liệu mẫu)');
    const mePhone = device('DELEGATE', 'Mẹ', delegate.id, at(day(-93), '19:40'), 'Máy cũ của Mẹ (dữ liệu mẫu)');

    // Prescription A (superseded 20 days ago) and prescription B (active until the next visit).
    const item = (drugId, drugNameRaw, unitsPerDose, slots, instruction) => ({ id: newId(), drugId, drugNameRaw, unitsPerDose, unit: 'viên', slots, instruction });
    const rxA = db.insert('prescriptions', {
      id: newId(), patientId: bo.id, issuedDate: day(-46), startDate: day(-45), nextVisitDate: day(-15), sourceNote: 'Hệ thống số hóa BV Hữu Nghị',
      items: [item(DRUG.glucophage500, 'Glucophage 500mg', 1, ['MORNING', 'EVENING'], 'Uống sau ăn'), item(DRUG.diamicron30, 'Diamicron MR 30mg', 1, ['MORNING'], 'Uống trước ăn sáng')],
      status: 'SUPERSEDED', confirmedAt: at(day(-46), '20:00'), warnings: [], createdAt: at(day(-46), '19:45'), updatedAt: at(day(-20), '09:00'),
    });
    const rxB = db.insert('prescriptions', {
      id: newId(), patientId: bo.id, issuedDate: day(-20), startDate: day(-20), nextVisitDate: day(40), sourceNote: 'Hệ thống số hóa BV Hữu Nghị',
      items: [
        item(DRUG.glucophage850, 'Glucophage 850mg', 1, ['MORNING', 'EVENING'], 'Uống sau ăn'),
        item(DRUG.diamicron30, 'Diamicron MR 30mg', 1, ['MORNING'], 'Uống trước ăn sáng'),
        item(DRUG.januvia50, 'Januvia 50mg', 1, ['NOON'], ''),
      ],
      status: 'ACTIVE', confirmedAt: at(day(-20), '09:00'), warnings: [], createdAt: at(day(-20), '08:40'), updatedAt: at(day(-20), '09:00'),
    });
    db.update('prescriptions', rxA.id, { supersededBy: rxB.id });
    log({ ...asCaregiver, patientId: bo.id, actionType: 'PRESCRIPTION_CONFIRMED', targetType: 'Prescription', targetId: rxA.id }, rxA.confirmedAt);
    log({ ...asCaregiver, patientId: bo.id, actionType: 'PRESCRIPTION_SUPERSEDED', targetType: 'Prescription', targetId: rxA.id }, rxB.confirmedAt);
    log({ ...asCaregiver, patientId: bo.id, actionType: 'PRESCRIPTION_CONFIRMED', targetType: 'Prescription', targetId: rxB.id }, rxB.confirmedAt);

    const times = Object.fromEntries(bo.reminderTimes.map((r) => [r.slot, r.time]));
    const supersededAtMs = Date.parse(rxB.confirmedAt);
    let confirmed = 0;
    let corrected = false;
    const makeDoses = (rx, fromDate, toDate) => {
      for (let date = fromDate; date <= toDate; date = shiftDate(date, 1)) {
        for (const slot of ['MORNING', 'NOON', 'AFTERNOON', 'EVENING']) {
          const scheduledAt = at(date, times[slot]);
          const scheduledMs = Date.parse(scheduledAt);
          const deadlineMs = scheduledMs + 120 * 60_000;
          // Prescription B starts at its confirmation; A's doses after that moment were cancelled.
          if (rx === rxB && scheduledMs < supersededAtMs) continue;
          // One outcome per slot so that drugs taken together share a story.
          const r = rand(`${date}|${slot}`);
          const outcome = r < 0.74 ? 'TAKEN' : r < 0.85 ? 'TAKEN_BY_DELEGATE' : r < 0.92 ? 'LATE_CONFIRMED' : 'MISSED';
          for (const it of rx.items.filter((entry) => entry.slots.includes(slot))) {
            const dose = {
              id: newId(), patientId: bo.id, prescriptionId: rx.id, prescriptionItemId: it.id, drugDisplayName: it.drugNameRaw,
              unitsPerDose: it.unitsPerDose, unit: it.unit, instruction: it.instruction, date, slot, scheduledAt,
              deadlineAt: iso(deadlineMs), status: 'SCHEDULED', lastConfirmationId: null, createdAt: rx.confirmedAt,
            };
            if (rx === rxA && scheduledMs > supersededAtMs) dose.status = 'CANCELLED';
            else if (deadlineMs < nowMs) {
              if (outcome === 'MISSED') {
                dose.status = 'MISSED';
                dose.missedAt = iso(deadlineMs + 60_000);
              } else {
                const delay = outcome === 'LATE_CONFIRMED' ? 150 + Math.round(rand(`${date}${slot}late`) * 120) : 4 + Math.round(rand(`${date}${slot}m`) * 50);
                const takenMs = Math.min(scheduledMs + delay * 60_000, nowMs - 60_000);
                const role = outcome === 'TAKEN_BY_DELEGATE' ? 'DELEGATE' : outcome === 'LATE_CONFIRMED' && r > 0.9 ? 'DELEGATE' : 'PATIENT';
                const offline = rand(`${date}${slot}off`) < 0.06;
                const original = db.insert('confirmations', {
                  id: newId(), doseId: dose.id, patientId: bo.id, actorRole: role, actorId: role === 'PATIENT' ? boPhone.id : mePhone.id,
                  takenAt: iso(takenMs), recordedAt: iso(offline ? takenMs + 47 * 60_000 : takenMs), resultingStatus: outcome, correctsConfirmationId: null,
                });
                dose.status = outcome;
                dose.lastConfirmationId = original.id;
                confirmed++;
                // One correction example (BR-05): pressed at 07:58, actually taken at 07:15.
                if (!corrected && outcome === 'TAKEN' && date === day(-3) && slot === 'MORNING') {
                  const fix = db.insert('confirmations', {
                    id: newId(), doseId: dose.id, patientId: bo.id, actorRole: 'PATIENT', actorId: boPhone.id,
                    takenAt: at(date, '07:15'), recordedAt: iso(takenMs + 5 * 60_000), resultingStatus: 'TAKEN', correctsConfirmationId: original.id,
                  });
                  dose.lastConfirmationId = fix.id;
                  log({ userId: boPhone.id, patientId: bo.id, actionType: 'DOSE_CONFIRMATION_CORRECTED', targetType: 'Dose', targetId: dose.id }, fix.recordedAt);
                  corrected = true;
                }
              }
            }
            db.insert('doses', dose);
            if (dose.status === 'MISSED' && date >= day(-6)) {
              db.insert('alerts', {
                id: newId(), patientId: bo.id, type: 'DOSE_MISSED', relatedDoseId: dose.id, dedupKey: `dose-missed:${dose.id}`,
                message: `Bố: chưa có xác nhận cữ ${{ MORNING: 'sáng', NOON: 'trưa', AFTERNOON: 'chiều', EVENING: 'tối' }[slot]} ${times[slot]} ngày ${date.slice(8, 10)}/${date.slice(5, 7)} (${dose.drugDisplayName})`,
                read: date < day(-1), createdAt: dose.missedAt,
              });
            }
          }
        }
      }
    };
    makeDoses(rxA, rxA.startDate, day(-16));
    makeDoses(rxB, rxB.startDate, rxB.nextVisitDate);
    log({ patientId: bo.id, actionType: 'DEMO_DATA_SEEDED', targetType: 'Patient', targetId: bo.id, detail: `${confirmed} xác nhận lịch sử` }, iso(nowMs));

    // Clinical history (UC-11, UC-12).
    const labs = [
      ['HBA1C', 8.4, '%', -150], ['HBA1C', 7.9, '%', -88], ['HBA1C', 7.3, '%', -21],
      ['FASTING_GLUCOSE', 9.1, 'mmol/L', -88], ['FASTING_GLUCOSE', 8.2, 'mmol/L', -45], ['FASTING_GLUCOSE', 7.4, 'mmol/L', -21], ['FASTING_GLUCOSE', 7.0, 'mmol/L', -6],
      ['POSTPRANDIAL_GLUCOSE', 11.6, 'mmol/L', -21],
    ];
    for (const [testType, value, unit, offset] of labs) {
      const record = db.insert('labResults', { id: newId(), patientId: bo.id, testType, value, unit, testedDate: day(offset), note: 'Phiếu kết quả BV Hữu Nghị (dữ liệu mẫu)', createdAt: at(day(offset), '16:00') });
      log({ ...asCaregiver, patientId: bo.id, actionType: 'LAB_RESULT_CREATED', targetType: 'LabResult', targetId: record.id }, record.createdAt);
    }
    db.insert('appointments', { id: newId(), patientId: bo.id, visitDate: day(-21), remindDaysBefore: 2, note: 'Tái khám định kỳ', status: 'DONE', createdAt: at(day(-46), '20:05') });
    db.insert('appointments', { id: newId(), patientId: bo.id, visitDate: day(40), remindDaysBefore: 2, note: 'Nhịn ăn sáng để lấy máu; mang báo cáo 30 ngày', status: 'UPCOMING', createdAt: at(day(-20), '09:05') });

    // Mẹ has just been added: a draft with a duplicate-ingredient warning waits for review (FR-08).
    const draft = db.insert('prescriptions', {
      id: newId(), patientId: me.id, issuedDate: day(-1), startDate: day(0), nextVisitDate: day(30), sourceNote: 'Hệ thống số hóa BV Hữu Nghị',
      items: [item(DRUG.glucophage500, 'Glucophage 500mg', 1, ['MORNING', 'EVENING'], 'Uống sau ăn'), item(DRUG.panfor500, 'Panfor SR 500mg', 1, ['EVENING'], '')],
      status: 'DRAFT', confirmedAt: null, warnings: ['Trùng hoạt chất: metformin'], createdAt: at(day(-1), '21:20'),
    });
    log({ ...asCaregiver, patientId: me.id, actionType: 'PRESCRIPTION_CREATED', targetType: 'Prescription', targetId: draft.id }, draft.createdAt);
  });
}
