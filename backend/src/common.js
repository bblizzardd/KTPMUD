import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ',
    result.error.issues.map(issue => ({ field: issue.path.join('.'), issue: issue.message })));
  return result.data;
}

export const idSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}, 'Ngày không tồn tại');
export const newId = () => randomUUID();
// The project is scoped to Vietnam. Calendar days are independent of host timezone.
export const localDate = date => new Date(+new Date(date) + 7 * 3600_000).toISOString().slice(0, 10);
export const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
export const TIME_SLOTS = ['MORNING', 'NOON', 'AFTERNOON', 'EVENING'];
export const DOSE_STATUSES = ['SCHEDULED', 'PENDING', 'TAKEN', 'TAKEN_BY_DELEGATE', 'MISSED', 'LATE_CONFIRMED', 'CANCELLED'];
export const PRESCRIPTION_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED', 'SUPERSEDED', 'CANCELLED'];
export const DEFAULT_REMINDERS = [
  { slot: 'MORNING', time: '07:00' }, { slot: 'NOON', time: '11:30' },
  { slot: 'AFTERNOON', time: '15:00' }, { slot: 'EVENING', time: '19:00' },
];
