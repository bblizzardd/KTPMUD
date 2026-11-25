// Local 24-hour times, at minute precision. Midnight starts the next calendar day.
export const SLOT_META = {
  MORNING: { label: 'Sáng', long: 'Cữ sáng', defaultTime: '07:00', min: '00:00', max: '09:59' },
  NOON: { label: 'Trưa', long: 'Cữ trưa', defaultTime: '11:30', min: '10:00', max: '14:59' },
  AFTERNOON: { label: 'Chiều', long: 'Cữ chiều', defaultTime: '15:00', min: '15:00', max: '17:59' },
  EVENING: { label: 'Tối', long: 'Cữ tối', defaultTime: '19:00', min: '18:00', max: '23:59' },
};

export const SLOTS = Object.keys(SLOT_META);

export function slotTimeError(slot, time) {
  const { long, min, max } = SLOT_META[slot];
  if (/^\d\d:[0-5]\d$/.test(time) && time >= min && time <= max) return '';
  return `${long} cần giờ từ ${min} đến ${max}, theo dạng HH:mm.`;
}

export function reminderTimeOf(patient, slot) {
  return patient?.reminderTimes?.find(reminder => reminder.slot === slot)?.time ?? SLOT_META[slot].defaultTime;
}
