/** Lỗi theo schema Error của OpenAPI: { code, message, details[] } kèm mã HTTP. */
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(err) {
  return err instanceof ApiError || (err && typeof err.status === 'number' && typeof err.code === 'string');
}

/** Backend báo trường lỗi dạng "items.0.drugNameRaw"; giao diện dùng "items[0].drugNameRaw". */
export function normalizeField(field) {
  return String(field || '').replace(/\.(\d+)(?=\.|$)/g, '[$1]');
}

/** Thông điệp mặc định của thư viện kiểm tra dữ liệu ở Backend là tiếng Anh: đổi sang tiếng Việt. */
export function localizeIssue(issue) {
  const text = String(issue || '');
  if (/[À-ỹđĐ]/.test(text)) return text;
  if (/email/i.test(text)) return 'Email không hợp lệ.';
  if (/uuid/i.test(text)) return 'Mã tham chiếu không hợp lệ.';
  if (/too small|>=|at least/i.test(text)) return 'Giá trị nhỏ hơn mức cho phép.';
  if (/too big|<=|at most/i.test(text)) return 'Giá trị vượt mức cho phép.';
  if (/required|received undefined/i.test(text)) return 'Bắt buộc nhập.';
  if (/unrecognized key/i.test(text)) return 'Có trường không được hỗ trợ.';
  return 'Giá trị không hợp lệ.';
}

/** Lấy thông báo lỗi cho một trường cụ thể từ details. */
export function fieldError(err, field) {
  return err?.details?.find((d) => d.field === field)?.issue || '';
}

export const NETWORK_ERROR = 'NETWORK_ERROR';

export function isNetworkError(err) {
  return err?.code === NETWORK_ERROR;
}
