// Kiểm thử các luật nghiệp vụ dùng ở giao diện (NFR-08). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkConfirmable,
  decideConfirmedStatus,
  decideUnconfirmedStatus,
  detectDuplicateIngredients,
  dosesToCancelOnSupersede,
  groupDoses,
  isVisitReminderDue,
  planDoses,
  summarizeAdherence,
  validatePatientInput,
  validatePrescriptionInput
} from '../src/domain/rules.js';
import { addDays, addMinutes, atTime, fmtTime, toDateKey, weekdayOf } from '../src/lib/time.js';

// Thuốc như GET /drugs trả về (trích danh mục minh họa của Backend).
const drug = (id, brandName, ingredients) => ({ id, brandName, activeIngredients: ingredients.map(([name, strength]) => ({ name, strength })) });
const DRUGS = [
  drug('g500', 'Glucophage 500mg', [['metformin', '500 mg']]),
  drug('p500', 'Panfor SR 500mg', [['metformin', '500 mg']]),
  drug('j50', 'Januvia 50mg', [['sitagliptin', '50 mg']]),
  drug('jm', 'Janumet 50mg/850mg', [['sitagliptin', '50 mg'], ['Metformin', '850 mg']]),
  drug('m500', 'Metformin 500mg', [['metformin', '500 mg']])
];

test('Bảng 6 — R1, R2, R3: trạng thái khi có xác nhận', () => {
  const deadlineAt = '2026-10-22T02:00:00.000Z';
  assert.equal(decideConfirmedStatus({ actorRole: 'PATIENT', takenAt: '2026-10-22T01:00:00.000Z', deadlineAt }), 'TAKEN');
  assert.equal(decideConfirmedStatus({ actorRole: 'DELEGATE', takenAt: '2026-10-22T01:59:59.000Z', deadlineAt }), 'TAKEN_BY_DELEGATE');
  assert.equal(decideConfirmedStatus({ actorRole: 'PATIENT', takenAt: '2026-10-22T02:00:01.000Z', deadlineAt }), 'LATE_CONFIRMED');
  assert.equal(decideConfirmedStatus({ actorRole: 'DELEGATE', takenAt: '2026-10-22T03:00:00.000Z', deadlineAt }), 'LATE_CONFIRMED');
});

test('Bảng 6 — R4, R5: chưa xác nhận thì giữ Đang chờ hoặc chuyển Bỏ lỡ', () => {
  const dose = { status: 'PENDING', deadlineAt: '2026-10-22T02:00:00.000Z' };
  assert.equal(decideUnconfirmedStatus(dose, Date.parse('2026-10-22T01:59:00.000Z')), 'PENDING');
  assert.equal(decideUnconfirmedStatus(dose, Date.parse('2026-10-22T02:01:00.000Z')), 'MISSED');
  assert.equal(decideUnconfirmedStatus({ ...dose, status: 'SCHEDULED' }, Date.parse('2026-10-23T00:00:00.000Z')), 'SCHEDULED');
});

test('UC-07: điều kiện ghi xác nhận giống Backend (409, 422, cùng ngày của cữ)', () => {
  const base = {
    date: '2026-10-22',
    scheduledAt: atTime('2026-10-22', '07:00'),
    deadlineAt: atTime('2026-10-22', '09:00'),
    lastConfirmation: null
  };
  const nowMs = Date.parse(atTime('2026-10-22', '10:00'));
  const takenAt = new Date(nowMs).toISOString();
  assert.equal(checkConfirmable({ ...base, status: 'PENDING' }, { takenAt, nowMs }).ok, true);
  assert.equal(checkConfirmable({ ...base, status: 'MISSED' }, { takenAt, nowMs }).ok, true);
  const confirmed = { ...base, status: 'TAKEN', lastConfirmation: { id: 'c1', takenAt: atTime('2026-10-22', '07:04') } };
  const dup = checkConfirmable(confirmed, { takenAt, nowMs });
  assert.equal(dup.status, 409);
  assert.equal(dup.code, 'DOSE_ALREADY_CONFIRMED');
  assert.match(dup.message, /07:04/);
  assert.equal(checkConfirmable({ ...base, status: 'CANCELLED' }, { takenAt, nowMs }).code, 'DOSE_CANCELLED');
  // Trước giờ nhắc, ở tương lai hoặc khác ngày của cữ đều bị từ chối (422).
  assert.equal(checkConfirmable({ ...base, status: 'SCHEDULED' }, { takenAt: atTime('2026-10-22', '06:30'), nowMs }).code, 'INVALID_TAKEN_AT');
  assert.equal(checkConfirmable({ ...base, status: 'PENDING' }, { takenAt: addMinutes(takenAt, 30), nowMs }).status, 422);
  const nextDay = Date.parse(atTime('2026-10-23', '08:00'));
  assert.equal(
    checkConfirmable({ ...base, status: 'MISSED' }, { takenAt: new Date(nextDay).toISOString(), nowMs: nextDay }).code,
    'CONFIRMATION_OUTSIDE_DOSE_DAY'
  );
  // Đính chính (BR-05): chỉ khi đã có xác nhận, giờ mới vẫn phải hợp lệ.
  assert.equal(checkConfirmable(confirmed, { takenAt: atTime('2026-10-22', '07:15'), nowMs, correction: true }).ok, true);
  assert.equal(checkConfirmable(confirmed, { takenAt: atTime('2026-10-22', '06:50'), nowMs, correction: true }).status, 422);
  assert.equal(checkConfirmable({ ...base, status: 'PENDING' }, { takenAt, nowMs, correction: true }).status, 409);
});

test('FR-08: phát hiện trùng hoạt chất giữa các biệt dược, kể cả thuốc phối hợp', () => {
  const warnings = detectDuplicateIngredients(
    [
      { drugId: 'g500', drugNameRaw: 'Glucophage 500mg' },
      { drugId: 'p500', drugNameRaw: 'Panfor SR 500mg' },
      { drugId: 'j50', drugNameRaw: 'Januvia 50mg' }
    ],
    DRUGS
  );
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].ingredient, 'metformin');
  assert.deepEqual(warnings[0].itemIndexes, [0, 1]);
  assert.match(warnings[0].message, /không tự sửa đơn/);

  const combo = detectDuplicateIngredients(
    [
      { drugId: 'jm', drugNameRaw: 'Janumet 50mg/850mg' },
      { drugId: 'j50', drugNameRaw: 'Januvia 50mg' },
      { drugId: 'm500', drugNameRaw: 'Metformin 500mg' }
    ],
    DRUGS
  );
  assert.deepEqual(combo.map((w) => w.ingredient.toLowerCase()).sort(), ['metformin', 'sitagliptin']);

  // Như Backend: chỉ thuốc đã liên kết danh mục mới có bằng chứng; tên tự do không bị suy đoán hoạt chất.
  assert.equal(detectDuplicateIngredients([{ drugNameRaw: 'glucophage 500MG' }, { drugId: 'p500' }], DRUGS).length, 0);
  // Thuốc đã liên kết nhưng chưa tải xong thông tin thì chưa kết luận.
  assert.equal(detectDuplicateIngredients([{ drugId: 'g500' }, { drugId: 'p500' }], []).length, 0);
});

test('UC-05 5a: kiểm tra trường bắt buộc và thứ tự ngày', () => {
  const ok = {
    issuedDate: '2026-10-20',
    startDate: '2026-10-20',
    nextVisitDate: '2026-11-20',
    items: [{ drugNameRaw: 'Panfor SR 500mg', unitsPerDose: 1, slots: ['MORNING'] }]
  };
  assert.deepEqual(validatePrescriptionInput(ok, { today: '2026-10-22' }), []);
  const fields = (input, opts) => validatePrescriptionInput(input, { today: '2026-10-22', ...opts }).map((d) => d.field);
  assert.deepEqual(fields({ ...ok, issuedDate: '' }), ['issuedDate']);
  assert.ok(fields({ ...ok, nextVisitDate: '2026-10-01' }).includes('nextVisitDate'));
  assert.ok(fields({ ...ok, startDate: '2026-10-19' }).includes('startDate'));
  assert.deepEqual(fields({ ...ok, items: [] }), ['items']);
  assert.deepEqual(
    fields({ ...ok, items: [{ drugNameRaw: ' ', unitsPerDose: 0, slots: [] }] }),
    ['items[0].drugNameRaw', 'items[0].unitsPerDose', 'items[0].slots']
  );
  assert.deepEqual(fields({ ...ok, startDate: '2026-10-20', nextVisitDate: '2026-10-21' }, { forConfirm: true }), ['nextVisitDate']);
});

test('FR-09: sinh cữ theo cặp (thuốc, buổi) từ ngày bắt đầu tới hết ngày tái khám', () => {
  const patient = {
    missedThresholdMinutes: 90,
    reminderTimes: [
      { slot: 'MORNING', time: '07:00' },
      { slot: 'NOON', time: '11:30' },
      { slot: 'AFTERNOON', time: '15:00' },
      { slot: 'EVENING', time: '19:00' }
    ]
  };
  const prescription = {
    id: 'rx',
    patientId: 'p',
    startDate: '2026-10-22',
    nextVisitDate: '2026-10-24',
    items: [
      { id: 'a', drugNameRaw: 'Panfor SR 500mg', unitsPerDose: 1, slots: ['MORNING', 'EVENING'] },
      { id: 'b', drugNameRaw: 'Januvia 50mg', unitsPerDose: 1, slots: ['NOON'] }
    ]
  };
  // Giống Backend: mỗi ngày đủ 3 cữ, kể cả buổi đã qua giờ của ngày bắt đầu.
  const doses = planDoses({ prescription, patient });
  assert.equal(doses.length, 3 * 3);
  assert.equal(doses[0].slot, 'MORNING');
  assert.equal(doses[0].scheduledAt, '2026-10-22T00:00:00.000Z', '07:00 giờ Việt Nam');
  assert.equal(doses.at(-1).date, '2026-10-24');
  assert.equal(Date.parse(doses[0].deadlineAt) - Date.parse(doses[0].scheduledAt), 90 * 60_000);
  assert.ok(doses.every((d) => d.status === 'SCHEDULED'));

  const existing = new Set(doses.map((d) => `${d.prescriptionItemId}|${d.date}|${d.slot}`));
  assert.equal(planDoses({ prescription, patient, existingKeys: existing }).length, 0);
  assert.equal(planDoses({ prescription: { ...prescription, startDate: '2026-10-24' }, patient }).length, 3);
});

test('BR-03: khi thay đơn chỉ hủy cữ "Đã lên lịch" của đơn cũ có giờ sau lúc xác nhận', () => {
  const at = (hhmm, status, prescriptionId = 'old') => ({ prescriptionId, status, scheduledAt: atTime('2026-10-22', hhmm) });
  const doses = [at('07:00', 'TAKEN'), at('11:30', 'PENDING'), at('19:00', 'SCHEDULED'), at('19:00', 'SCHEDULED', 'other')];
  const cancelled = dosesToCancelOnSupersede(doses, 'old', Date.parse(atTime('2026-10-22', '12:00')));
  assert.deepEqual(cancelled.map((d) => d.scheduledAt), [atTime('2026-10-22', '19:00')]);
});

test('Ngày giờ theo giờ Việt Nam (UTC+07) dù máy đặt múi giờ khác', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.equal(toDateKey('2026-10-21T17:00:00.000Z'), '2026-10-22', 'nửa đêm Việt Nam đã sang ngày mới');
    assert.equal(toDateKey('2026-10-21T16:59:59.999Z'), '2026-10-21');
    assert.equal(atTime('2026-10-22', '07:00'), '2026-10-22T00:00:00.000Z');
    assert.equal(fmtTime('2026-10-22T12:05:00.000Z'), '19:05');
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(weekdayOf('2026-10-22'), 'Thứ Năm');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('Gom cữ theo buổi: một thao tác cho mỗi cữ, trạng thái ưu tiên việc cần làm', () => {
  const s = atTime('2026-10-22', '07:00');
  const groups = groupDoses([
    { patientId: 'p', date: '2026-10-22', slot: 'MORNING', scheduledAt: s, deadlineAt: s, status: 'TAKEN', lastConfirmation: { recordedAt: s } },
    { patientId: 'p', date: '2026-10-22', slot: 'MORNING', scheduledAt: s, deadlineAt: s, status: 'PENDING', lastConfirmation: null }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].status, 'PENDING');
  assert.equal(groups[0].doses.length, 2);
});

test('FR-19: tỷ lệ đúng hạn và tỷ lệ có ghi nhận (TD-02)', () => {
  const mk = (date, status) => ({ date, status });
  const summary = summarizeAdherence(
    [
      mk('2026-10-20', 'TAKEN'),
      mk('2026-10-20', 'TAKEN_BY_DELEGATE'),
      mk('2026-10-21', 'LATE_CONFIRMED'),
      mk('2026-10-21', 'MISSED'),
      mk('2026-10-22', 'PENDING'),
      mk('2026-10-22', 'CANCELLED'),
      mk('2026-10-10', 'MISSED')
    ],
    { fromDate: '2026-10-16', toDate: '2026-10-22' }
  );
  assert.equal(summary.totalDoses, 4);
  assert.equal(summary.adherenceRate, 0.5);
  assert.equal(summary.recordedRate, 0.75);
  assert.equal(summary.pending, 1);
  assert.equal(summarizeAdherence([], { fromDate: '2026-10-16', toDate: '2026-10-22' }).adherenceRate, null);
});

test('FR-17: nhắc tái khám trong khoảng nhắc trước', () => {
  const appt = { status: 'UPCOMING', visitDate: '2026-10-28', remindDaysBefore: 2 };
  assert.equal(isVisitReminderDue(appt, '2026-10-25'), false);
  assert.equal(isVisitReminderDue(appt, '2026-10-26'), true);
  assert.equal(isVisitReminderDue(appt, '2026-10-28'), true);
  assert.equal(isVisitReminderDue(appt, '2026-10-29'), false);
  assert.equal(isVisitReminderDue({ ...appt, status: 'DONE' }, '2026-10-27'), false);
});

test('UC-02: hồ sơ chỉ gồm tên gọi và năm sinh hợp lệ', () => {
  assert.deepEqual(validatePatientInput({ alias: 'Bố', birthYear: 1954 }), []);
  assert.deepEqual(validatePatientInput({ alias: '', birthYear: 1900 }).map((d) => d.field), ['alias', 'birthYear']);
  const times = [
    { slot: 'MORNING', time: '07:00' },
    { slot: 'NOON', time: '06:00' },
    { slot: 'AFTERNOON', time: '15:00' },
    { slot: 'EVENING', time: '19:00' }
  ];
  assert.deepEqual(validatePatientInput({ reminderTimes: times }, { partial: true }).map((d) => d.field), ['reminderTimes.NOON']);
  assert.deepEqual(validatePatientInput({ missedThresholdMinutes: 10 }, { partial: true }).map((d) => d.field), ['missedThresholdMinutes']);
});
