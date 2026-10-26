// Luật nghiệp vụ thuần dùng ở giao diện (xem trước, kiểm tra form, gom cữ theo buổi) và
// kiểm thử. Nguồn sự thật là Backend; các hàm ở đây bám đúng quy ước của Backend.

import {
  SLOTS,
  SLOT_META,
  CONFIRMED_STATUSES,
  DUE_STATUSES,
  DEFAULT_MISSED_THRESHOLD
} from './constants.js';
import {
  addDays,
  addMinutes,
  atTime,
  fmtTime,
  isValidDateKey,
  toDateKey
} from '../lib/time.js';
import { foldVN } from '../lib/text.js';

// ---------------------------------------------------------------------------
// Bảng 6. Bảng quyết định cập nhật trạng thái cữ thuốc
// ---------------------------------------------------------------------------

export const DECISION_TABLE = [
  { rule: 'R1', hasConfirmation: 'Có', byPatient: 'Có', inTime: 'Có', overdue: '–', result: 'TAKEN', action: 'Ghi nhật ký' },
  { rule: 'R2', hasConfirmation: 'Có', byPatient: 'Không', inTime: 'Có', overdue: '–', result: 'TAKEN_BY_DELEGATE', action: 'Ghi người thực hiện' },
  { rule: 'R3', hasConfirmation: 'Có', byPatient: '–', inTime: 'Không', overdue: '–', result: 'LATE_CONFIRMED', action: 'Ghi mốc giờ thực tế' },
  { rule: 'R4', hasConfirmation: 'Không', byPatient: '–', inTime: '–', overdue: 'Không', result: 'PENDING', action: 'Không' },
  { rule: 'R5', hasConfirmation: 'Không', byPatient: '–', inTime: '–', overdue: 'Có', result: 'MISSED', action: 'Cảnh báo người chăm sóc, người nhà' }
];

/**
 * R1–R3: trạng thái mới khi có xác nhận. "Trong thời hạn" xét theo takenAt
 * (thời điểm bấm), nên xác nhận lưu tạm khi mất mạng (UC-07, 3c) không bị tính muộn.
 */
export function decideConfirmedStatus({ actorRole, takenAt, deadlineAt }) {
  if (Date.parse(takenAt) > Date.parse(deadlineAt)) return 'LATE_CONFIRMED'; // R3
  return actorRole === 'PATIENT' ? 'TAKEN' : 'TAKEN_BY_DELEGATE'; // R1 / R2
}

/** R4–R5: trạng thái khi chưa có xác nhận. */
export function decideUnconfirmedStatus(dose, nowMs) {
  if (dose.status !== 'PENDING') return dose.status;
  return nowMs > Date.parse(dose.deadlineAt) ? 'MISSED' : 'PENDING';
}

function reject(status, code, message) {
  return { ok: false, status, code, message };
}

/**
 * Điều kiện ghi một xác nhận, giống Backend (UC-07, UC-08): thời điểm uống từ giờ nhắc
 * tới hiện tại và trong cùng ngày của cữ; cữ đã có xác nhận chỉ nhận bản đính chính.
 * Trả về { ok: true } hoặc mô tả lỗi theo mã HTTP.
 */
export function checkConfirmable(dose, { takenAt, nowMs, correction = false }) {
  const takenMs = Date.parse(takenAt);
  if (Number.isNaN(takenMs)) return reject(422, 'INVALID_TAKEN_AT', 'Thời điểm uống không hợp lệ.');
  if (dose.status === 'CANCELLED') return reject(409, 'DOSE_CANCELLED', 'Cữ thuốc này đã bị hủy vì đơn thuốc đã được thay thế.');
  if (takenMs > nowMs) return reject(422, 'INVALID_TAKEN_AT', 'Giờ uống không được muộn hơn bây giờ.');
  if (takenMs < Date.parse(dose.scheduledAt)) return reject(422, 'INVALID_TAKEN_AT', `Giờ uống phải từ giờ nhắc ${fmtTime(dose.scheduledAt)} trở đi.`);
  if (toDateKey(takenMs) !== dose.date) return reject(422, 'CONFIRMATION_OUTSIDE_DOSE_DAY', 'Chỉ ghi giờ uống trong ngày của cữ thuốc.');
  if (correction) {
    if (!dose.lastConfirmation) return reject(409, 'INVALID_CORRECTION', 'Cữ thuốc chưa có xác nhận nào để đính chính.');
    return { ok: true };
  }
  if (dose.lastConfirmation || CONFIRMED_STATUSES.includes(dose.status)) {
    return reject(409, 'DOSE_ALREADY_CONFIRMED', `Cữ thuốc này đã được xác nhận lúc ${fmtTime(dose.lastConfirmation?.takenAt)}`);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// FR-08: cảnh báo trùng hoạt chất (không tự sửa đơn)
// ---------------------------------------------------------------------------

/**
 * Chỉ thuốc đã liên kết danh mục mới có bằng chứng về hoạt chất; tên tự do giữ nguyên văn
 * và không suy đoán hoạt chất (giống Backend).
 */
export function resolveItemDrug(item, drugs = []) {
  if (item?.drugId) {
    const linked = drugs.find((d) => d.id === item.drugId);
    return linked ? { source: 'CATALOG', drug: linked } : { source: 'LINKED_LOADING', drug: null };
  }
  return { source: 'UNLINKED', drug: null };
}

export function detectDuplicateIngredients(items = [], drugs = []) {
  const byIngredient = new Map();
  items.forEach((item, index) => {
    const { drug } = resolveItemDrug(item, drugs);
    if (!drug) return;
    for (const ing of drug.activeIngredients) {
      const key = foldVN(ing.name);
      if (!byIngredient.has(key)) byIngredient.set(key, { ingredient: ing.name, entries: [] });
      byIngredient.get(key).entries.push({
        index,
        name: String(item.drugNameRaw || drug.brandName).trim(),
        strength: ing.strength
      });
    }
  });

  const warnings = [];
  for (const { ingredient, entries } of byIngredient.values()) {
    if (new Set(entries.map((e) => e.index)).size < 2) continue;
    const names = entries.map((e) => `${e.name} (${e.strength})`).join(' và ');
    warnings.push({
      ingredient,
      itemIndexes: [...new Set(entries.map((e) => e.index))],
      message: `${names} cùng chứa hoạt chất ${ingredient}. Nên hỏi lại bác sĩ trước khi xác nhận đơn; hệ thống không tự sửa đơn.`
    });
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Kiểm tra dữ liệu đơn thuốc (PrescriptionInput) — UC-05 5a
// ---------------------------------------------------------------------------

export function validatePrescriptionInput(input, { forConfirm = false, today = toDateKey() } = {}) {
  const details = [];
  const add = (field, issue) => details.push({ field, issue });
  const issued = input?.issuedDate;
  const start = input?.startDate;
  const next = input?.nextVisitDate;

  if (!isValidDateKey(issued)) add('issuedDate', 'Chưa nhập ngày kê đơn.');
  if (!isValidDateKey(start)) add('startDate', 'Chưa nhập ngày bắt đầu uống.');
  if (!isValidDateKey(next)) add('nextVisitDate', 'Chưa nhập ngày tái khám.');
  if (isValidDateKey(issued) && isValidDateKey(start) && start < issued) {
    add('startDate', 'Ngày bắt đầu không được trước ngày kê đơn.');
  }
  if (isValidDateKey(issued) && issued > today) add('issuedDate', 'Ngày kê đơn không được ở tương lai.');
  if (isValidDateKey(start) && isValidDateKey(next) && next < start) {
    add('nextVisitDate', 'Ngày tái khám phải sau hoặc bằng ngày bắt đầu.');
  }
  if (forConfirm && isValidDateKey(next) && next < today) {
    add('nextVisitDate', 'Ngày tái khám đã qua nên đơn không còn áp dụng được.');
  }
  if (String(input?.sourceNote || '').length > 200) add('sourceNote', 'Ghi chú nguồn tối đa 200 ký tự.');

  const items = Array.isArray(input?.items) ? input.items : [];
  if (items.length === 0) add('items', 'Đơn cần có ít nhất một thuốc.');
  items.forEach((item, i) => {
    const name = String(item?.drugNameRaw || '').trim();
    if (!name) add(`items[${i}].drugNameRaw`, 'Chưa nhập tên thuốc.');
    else if (name.length > 200) add(`items[${i}].drugNameRaw`, 'Tên thuốc tối đa 200 ký tự.');
    const units = Number(item?.unitsPerDose);
    if (!Number.isFinite(units) || units < 0.25) add(`items[${i}].unitsPerDose`, 'Số đơn vị mỗi lần tối thiểu là 0,25.');
    else if (units > 50) add(`items[${i}].unitsPerDose`, 'Số đơn vị mỗi lần quá lớn, hãy kiểm tra lại.');
    const slots = Array.isArray(item?.slots) ? item.slots.filter((s) => SLOTS.includes(s)) : [];
    if (slots.length === 0) add(`items[${i}].slots`, 'Chọn ít nhất một buổi uống.');
    if (String(item?.instruction || '').length > 200) add(`items[${i}].instruction`, 'Ghi chú tối đa 200 ký tự.');
  });
  return details;
}

// ---------------------------------------------------------------------------
// FR-09: sinh cữ thuốc từ đơn Hiệu lực tới ngày tái khám (Hình 6)
// ---------------------------------------------------------------------------

export function reminderTimeOf(patient, slot) {
  return patient?.reminderTimes?.find((r) => r.slot === slot)?.time || SLOT_META[slot].defaultTime;
}

export function itemDisplayName(item) {
  return String(item.drugNameRaw || '').trim();
}

/**
 * Lập danh sách cữ Backend sẽ sinh khi xác nhận đơn: mỗi cặp (dòng thuốc, buổi uống) cho mỗi
 * ngày từ ngày bắt đầu tới hết ngày tái khám, theo giờ nhắc của hồ sơ; bỏ qua cữ đã tồn tại.
 * Buổi đã qua giờ trong khoảng đó cũng được sinh (chuyển Bỏ lỡ nếu không xác nhận muộn).
 */
export function planDoses({ prescription, patient, existingKeys = new Set(), makeId }) {
  const threshold = Number(patient?.missedThresholdMinutes) || DEFAULT_MISSED_THRESHOLD;
  const planned = [];
  for (let day = prescription.startDate; day <= prescription.nextVisitDate; day = addDays(day, 1)) {
    for (const slot of SLOTS) {
      const scheduledAt = atTime(day, reminderTimeOf(patient, slot));
      for (const item of prescription.items) {
        if (!item.slots.includes(slot)) continue;
        const key = doseKey(item.id, day, slot);
        if (existingKeys.has(key)) continue;
        planned.push({
          id: makeId ? makeId() : key,
          patientId: prescription.patientId,
          prescriptionId: prescription.id,
          prescriptionItemId: item.id,
          drugDisplayName: itemDisplayName(item),
          unitsPerDose: Number(item.unitsPerDose),
          unit: item.unit || 'viên',
          instruction: item.instruction || '',
          date: day,
          slot,
          scheduledAt,
          deadlineAt: addMinutes(scheduledAt, threshold),
          status: 'SCHEDULED',
          lastConfirmation: null
        });
      }
    }
  }
  return planned;
}

export function doseKey(itemId, date, slot) {
  return `${itemId}|${date}|${slot}`;
}

/** Cữ của đơn cũ bị hủy khi đơn mới được xác nhận (BR-03, FR-07): cữ "Đã lên lịch" có giờ sau lúc xác nhận. */
export function dosesToCancelOnSupersede(doses, oldPrescriptionId, confirmMs) {
  return doses.filter(
    (d) =>
      d.prescriptionId === oldPrescriptionId &&
      d.status === 'SCHEDULED' &&
      Date.parse(d.scheduledAt) > confirmMs
  );
}

// ---------------------------------------------------------------------------
// Gom cữ theo buổi để hiển thị: một thao tác cho mỗi cữ (BIZ-04)
// ---------------------------------------------------------------------------

const GROUP_PRIORITY = ['PENDING', 'MISSED', 'SCHEDULED', 'LATE_CONFIRMED', 'TAKEN_BY_DELEGATE', 'TAKEN', 'CANCELLED'];

export function aggregateStatus(statuses) {
  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return 'CANCELLED';
  return GROUP_PRIORITY.find((s) => active.includes(s)) || active[0];
}

export function groupDoses(doses) {
  const groups = new Map();
  for (const dose of doses) {
    const key = `${dose.patientId}|${dose.date}|${dose.slot}|${dose.scheduledAt}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        patientId: dose.patientId,
        date: dose.date,
        slot: dose.slot,
        scheduledAt: dose.scheduledAt,
        deadlineAt: dose.deadlineAt,
        doses: []
      });
    }
    groups.get(key).doses.push(dose);
  }
  return [...groups.values()]
    .map((g) => {
      const status = aggregateStatus(g.doses.map((d) => d.status));
      const confirmations = g.doses.map((d) => d.lastConfirmation).filter(Boolean);
      const lastConfirmation = confirmations.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] || null;
      return { ...g, status, lastConfirmation };
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

// ---------------------------------------------------------------------------
// FR-19: tổng hợp tuân thủ. TD-02: cách tính Xác nhận muộn chưa chốt nên trả về cả
// tỷ lệ đúng hạn (không tính muộn) và tỷ lệ có ghi nhận (tính cả muộn).
// ---------------------------------------------------------------------------

export function summarizeAdherence(doses, { fromDate, toDate }) {
  const counts = { TAKEN: 0, TAKEN_BY_DELEGATE: 0, LATE_CONFIRMED: 0, MISSED: 0, PENDING: 0, SCHEDULED: 0 };
  for (const d of doses) {
    if (d.date < fromDate || d.date > toDate || d.status === 'CANCELLED') continue;
    counts[d.status] = (counts[d.status] || 0) + 1;
  }
  const totalDoses = DUE_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const onTime = counts.TAKEN + counts.TAKEN_BY_DELEGATE;
  return {
    fromDate,
    toDate,
    totalDoses,
    taken: counts.TAKEN,
    takenByDelegate: counts.TAKEN_BY_DELEGATE,
    lateConfirmed: counts.LATE_CONFIRMED,
    missed: counts.MISSED,
    pending: counts.PENDING,
    adherenceRate: totalDoses ? onTime / totalDoses : null,
    recordedRate: totalDoses ? (onTime + counts.LATE_CONFIRMED) / totalDoses : null
  };
}

export function dailyAdherence(doses, { fromDate, toDate }) {
  const days = [];
  const index = new Map();
  for (let day = fromDate; day <= toDate; day = addDays(day, 1)) {
    const row = { date: day, TAKEN: 0, TAKEN_BY_DELEGATE: 0, LATE_CONFIRMED: 0, MISSED: 0, PENDING: 0, SCHEDULED: 0 };
    index.set(day, row);
    days.push(row);
  }
  for (const d of doses) {
    const row = index.get(d.date);
    if (!row || d.status === 'CANCELLED') continue;
    row[d.status] += 1;
  }
  return days;
}

// ---------------------------------------------------------------------------
// FR-17: nhắc lịch tái khám trước ngày hẹn
// ---------------------------------------------------------------------------

export function isVisitReminderDue(appointment, today) {
  if (appointment.status !== 'UPCOMING') return false;
  const from = addDays(appointment.visitDate, -Number(appointment.remindDaysBefore || 0));
  return today >= from && today <= appointment.visitDate;
}

// ---------------------------------------------------------------------------
// Hồ sơ bệnh nhân (PatientCreate / PatientUpdate)
// ---------------------------------------------------------------------------

export function validatePatientInput(input, { partial = false, nowYear = new Date().getFullYear() } = {}) {
  const details = [];
  const add = (field, issue) => details.push({ field, issue });
  if (!partial || input.alias !== undefined) {
    const alias = String(input.alias ?? '').trim();
    if (!alias) add('alias', 'Nhập tên gọi trong gia đình, ví dụ "Bố".');
    else if (alias.length > 50) add('alias', 'Tên gọi tối đa 50 ký tự.');
  }
  if (!partial || input.birthYear !== undefined) {
    const year = Number(input.birthYear);
    if (!Number.isInteger(year) || year < 1920 || year > Math.min(2010, nowYear)) {
      add('birthYear', 'Năm sinh phải từ 1920 đến 2010.');
    }
  }
  if (input.reminderTimes !== undefined) {
    const list = Array.isArray(input.reminderTimes) ? input.reminderTimes : [];
    for (const slot of SLOTS) {
      const entry = list.find((r) => r.slot === slot);
      if (!entry || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) add(`reminderTimes.${slot}`, 'Giờ nhắc không hợp lệ.');
    }
    const times = SLOTS.map((s) => list.find((r) => r.slot === s)?.time).filter(Boolean);
    for (let i = 1; i < times.length; i++) {
      if (times[i] <= times[i - 1]) {
        add(`reminderTimes.${SLOTS[i]}`, 'Giờ nhắc các buổi phải tăng dần trong ngày.');
        break;
      }
    }
  }
  if (input.missedThresholdMinutes !== undefined) {
    const t = Number(input.missedThresholdMinutes);
    if (!Number.isInteger(t) || t < 15 || t > 360) add('missedThresholdMinutes', 'Ngưỡng bỏ lỡ từ 15 đến 360 phút.');
  }
  return details;
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

export { CONFIRMED_STATUSES, DUE_STATUSES };
