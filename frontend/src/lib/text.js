/** Bỏ dấu tiếng Việt và chuẩn hóa chữ thường để tìm kiếm ("Đường" -> "duong"). */
export function foldVN(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function plural(n, unit) {
  return `${n} ${unit}`;
}

export function percent(rate) {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  return `${Math.round(rate * 100)}%`;
}

export function fmtNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function shortId(id) {
  return String(id || '').slice(0, 8);
}
