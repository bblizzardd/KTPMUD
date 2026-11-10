// Tiện ích ngày giờ. Ngày nghiệp vụ tính theo giờ Việt Nam (UTC+07) giống Backend,
// không phụ thuộc múi giờ của máy đang mở trình duyệt. Khóa ngày dạng 'YYYY-MM-DD';
// mốc thời gian dạng ISO 8601 (UTC) như trong OpenAPI.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const VN_OFFSET = 7 * HOUR;

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

function toMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}

/** Đồng hồ treo tường ở Việt Nam: đọc bằng getUTC*. */
function vn(value) {
  return new Date(toMs(value) + VN_OFFSET);
}

function parseKey(dateKey) {
  const [y, m, d] = String(dateKey).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

export function toDateKey(value = Date.now()) {
  const d = vn(value);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function todayKey(now = Date.now()) {
  return toDateKey(now);
}

export function addDays(dateKey, n) {
  const { y, m, d } = parseKey(dateKey);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Số ngày từ a tới b (b - a). */
export function diffDays(a, b) {
  const p = parseKey(a);
  const q = parseKey(b);
  return Math.round((Date.UTC(q.y, q.m - 1, q.d) - Date.UTC(p.y, p.m - 1, p.d)) / DAY);
}

/** ISO của mốc giờ 'HH:mm' trong ngày dateKey (giờ Việt Nam). */
export function atTime(dateKey, hhmm, seconds = 0, ms = 0) {
  const { y, m, d } = parseKey(dateKey);
  const [hh, mm] = String(hhmm).split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, seconds, ms) - VN_OFFSET).toISOString();
}

export function startOfDayIso(dateKey) {
  return atTime(dateKey, '00:00');
}

export function endOfDayIso(dateKey) {
  return atTime(dateKey, '23:59', 59, 999);
}

export function addMinutes(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * MINUTE).toISOString();
}

export function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const { y, m, d } = parseKey(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidHHmm(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

// ---------- Hiển thị (vi-VN) ----------

export function fmtTime(iso) {
  if (!iso) return '—';
  const ms = toMs(iso);
  if (Number.isNaN(ms)) return '—';
  const d = vn(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function fmtTimeSec(iso) {
  if (!iso) return '—';
  const d = vn(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export function fmtDate(value) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const { y, m, d } = parseKey(value);
    return `${pad2(d)}/${pad2(m)}/${y}`;
  }
  const ms = toMs(value);
  if (Number.isNaN(ms)) return '—';
  return fmtDate(toDateKey(ms));
}

export function fmtDateShort(dateKey) {
  const { m, d } = parseKey(dateKey);
  return `${pad2(d)}/${pad2(m)}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return `${fmtTime(iso)} · ${fmtDate(iso)}`;
}

export function weekdayOf(dateKey) {
  const { y, m, d } = parseKey(dateKey);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function weekdayShort(dateKey) {
  const { y, m, d } = parseKey(dateKey);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 'CN' : `T${day + 1}`;
}

/** 'Hôm nay', 'Hôm qua', 'Ngày mai' hoặc 'Thứ Hai, 20/10'. */
export function dayLabel(dateKey, now = Date.now()) {
  const delta = diffDays(todayKey(now), dateKey);
  if (delta === 0) return 'Hôm nay';
  if (delta === -1) return 'Hôm qua';
  if (delta === 1) return 'Ngày mai';
  return `${weekdayOf(dateKey)}, ${fmtDateShort(dateKey)}`;
}

export function fmtRelative(iso, now = Date.now()) {
  const ms = now - Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  if (ms < 0) {
    const ahead = -ms;
    if (ahead < HOUR) return `${Math.max(1, Math.round(ahead / MINUTE))} phút nữa`;
    if (ahead < DAY) return `${Math.round(ahead / HOUR)} giờ nữa`;
    return fmtDate(iso);
  }
  if (ms < MINUTE) return 'vừa xong';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} phút trước`;
  if (ms < DAY && toDateKey(iso) === todayKey(now)) return `${Math.floor(ms / HOUR)} giờ trước`;
  const days = diffDays(toDateKey(iso), todayKey(now));
  if (days === 1) return `hôm qua, ${fmtTime(iso)}`;
  if (days < 7) return `${days} ngày trước`;
  return fmtDate(iso);
}

export function fmtDuration(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} phút`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} giờ ${r} phút` : `${h} giờ`;
  }
  const days = Math.floor(m / (24 * 60));
  const h = Math.round((m % (24 * 60)) / 60);
  return h ? `${days} ngày ${h} giờ` : `${days} ngày`;
}

export function ageFromBirthYear(birthYear, now = Date.now()) {
  return vn(now).getUTCFullYear() - Number(birthYear);
}
