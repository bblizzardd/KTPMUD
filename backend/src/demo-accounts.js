import { DEFAULT_REMINDERS, DOSE_WINDOW_MINUTES, localDate, newId, shiftDate } from './common.js';
import { ensurePrescriptionVisit, generateDoses } from './medication.js';
import { hashPassword } from './security.js';

const caregiverEmail = 'nguoithan@antam.test';
const patientEmail = 'benhnhan@antam.test';
const delegateEmail = 'uyquyen@antam.test';

export async function ensureTestAccounts(ctx) {
  const { db } = ctx;
  const seeded = () => db.list('caregivers', { email: caregiverEmail })[0]?.testAccount === true;
  if (seeded()) {
    db.transaction(() => {
      const patient = db.list('patientAccounts', { email: patientEmail, testAccount: true })[0];
      if (!patient) return;
      const rx = db.list('prescriptions', { patientId: patient.patientId, sourceNote: 'Đơn giả lập để kiểm thử', status: 'ACTIVE' })[0];
      if (rx && !db.list('appointments', { patientId: rx.patientId, visitDate: rx.nextVisitDate }).length) ensurePrescriptionVisit(ctx, rx);
    });
    return;
  }
  const [caregiverHash, patientHash, delegateHash] = await Promise.all(
    [caregiverEmail, patientEmail, delegateEmail].map(() => hashPassword('123456'))
  );
  db.transaction(() => {
    if (seeded()) return;
    if (db.list('caregivers', { email: caregiverEmail }).length ||
        [patientEmail, delegateEmail].some(email => db.list('patientAccounts', { email }).length)) {
      throw new Error('Email kiểm thử đã thuộc về một tài khoản khác. Hãy dùng cơ sở dữ liệu riêng cho bản test.');
    }
    const now = ctx.now();
    const createdAt = now.toISOString();
    const account = { testAccount: true, createdAt };
    const caregiver = db.insert('caregivers', { ...account, id: newId(), displayName: 'Con (mẫu)', email: caregiverEmail, passwordHash: caregiverHash });
    const patient = db.insert('patients', { id: newId(), caregiverId: caregiver.id, alias: 'Bố (mẫu)', birthYear: 1954,
      reminderTimes: DEFAULT_REMINDERS, missedThresholdMinutes: DOSE_WINDOW_MINUTES, createdAt });
    const linked = { ...account, patientId: patient.id, active: true };
    db.insert('patientAccounts', { ...linked, id: newId(), email: patientEmail, displayName: patient.alias, passwordHash: patientHash });
    const delegate = db.insert('delegates', { id: newId(), patientId: patient.id, alias: 'Mẹ (mẫu)', relation: 'Vợ', active: true, createdAt });
    db.insert('patientAccounts', { ...linked, id: newId(), email: delegateEmail, displayName: delegate.alias, passwordHash: delegateHash, delegateId: delegate.id });

    const today = localDate(now);
    const rx = db.insert('prescriptions', { id: newId(), patientId: patient.id, issuedDate: today, startDate: today,
      nextVisitDate: shiftDate(today, 30), sourceNote: 'Đơn giả lập để kiểm thử', status: 'ACTIVE',
      items: [{ id: newId(), drugNameRaw: 'Thuốc mẫu', unitsPerDose: 1, unit: 'viên', slots: ['MORNING', 'EVENING'] }],
      warnings: [], confirmedAt: createdAt, createdAt, updatedAt: createdAt });
    generateDoses(ctx, rx, patient, now);
    ensurePrescriptionVisit(ctx, rx);
    ctx.audit({ actionType: 'DEMO_DATA_SEEDED', targetType: 'Patient', targetId: patient.id, patientId: patient.id, detail: 'Tạo gia đình kiểm thử ba vai trò' });
  });
}
