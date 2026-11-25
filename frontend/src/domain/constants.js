// Hằng số nghiệp vụ bám theo báo cáo Tuần 6 (Bảng 6, Hình 4, Hình 5) và openapi.yaml.

import { SLOTS, SLOT_META } from '../../../shared/doseTimes.js';
export { SLOTS, SLOT_META };

// DoseStatus — Hình 4: Biểu đồ chuyển trạng thái của cữ thuốc
export const DOSE_STATUS = {
  SCHEDULED: {
    label: 'Đã lên lịch',
    tone: 'neutral',
    desc: 'Chưa đến giờ nhắc.'
  },
  PENDING: {
    label: 'Đang chờ',
    tone: 'info',
    desc: 'Đã đến giờ, đã gửi nhắc nhở, đang chờ xác nhận trong thời hạn.'
  },
  TAKEN: {
    label: 'Đã uống',
    tone: 'success',
    desc: 'Bệnh nhân tự xác nhận trong thời hạn.'
  },
  TAKEN_BY_DELEGATE: {
    label: 'Đã uống (hộ)',
    tone: 'delegate',
    desc: 'Người chăm sóc hoặc người nhà được ủy quyền xác nhận hộ trong thời hạn.'
  },
  LATE_CONFIRMED: {
    label: 'Xác nhận muộn',
    tone: 'warning',
    desc: 'Xác nhận sau thời hạn, ghi mốc giờ thực tế.'
  },
  MISSED: {
    label: 'Bỏ lỡ',
    tone: 'danger',
    desc: 'Hết thời hạn mà chưa có xác nhận; đã cảnh báo người chăm sóc và người nhà.'
  },
  CANCELLED: {
    label: 'Đã hủy',
    tone: 'muted',
    desc: 'Cữ bị hủy khi đơn thuốc được thay thế hoặc xóa.'
  }
};

export const CONFIRMED_STATUSES = ['TAKEN', 'TAKEN_BY_DELEGATE', 'LATE_CONFIRMED'];
export const DUE_STATUSES = ['TAKEN', 'TAKEN_BY_DELEGATE', 'LATE_CONFIRMED', 'MISSED'];

// PrescriptionStatus — Hình 5: Biểu đồ chuyển trạng thái của đơn thuốc
export const RX_STATUS = {
  DRAFT: { label: 'Nháp', tone: 'warning', desc: 'Đang nhập, còn sửa được; chưa sinh cữ thuốc.' },
  ACTIVE: { label: 'Hiệu lực', tone: 'success', desc: 'Đơn đang áp dụng; mỗi bệnh nhân chỉ có tối đa một đơn Hiệu lực.' },
  SUPERSEDED: { label: 'Bị thay thế', tone: 'neutral', desc: 'Đã có đơn mới được xác nhận; các cữ tương lai đã hủy.' },
  EXPIRED: { label: 'Hết hạn', tone: 'neutral', desc: 'Đã qua ngày tái khám.' },
  CANCELLED: { label: 'Đã hủy', tone: 'muted', desc: 'Đơn nháp bị hủy, không sinh cữ.' }
};

export const LAB_TYPES = {
  HBA1C: { label: 'HbA1c', long: 'HbA1c (đường huyết trung bình 2–3 tháng)', unit: '%', step: 0.1 },
  FASTING_GLUCOSE: { label: 'Đường huyết lúc đói', long: 'Đường huyết lúc đói', unit: 'mmol/L', step: 0.1 },
  POSTPRANDIAL_GLUCOSE: { label: 'Đường huyết sau ăn', long: 'Đường huyết sau ăn 2 giờ', unit: 'mmol/L', step: 0.1 },
  OTHER: { label: 'Chỉ số khác', long: 'Chỉ số khác (ghi rõ trong ghi chú)', unit: '', step: 0.01 }
};

export const ROLE_META = {
  CAREGIVER: { label: 'Người chăm sóc' },
  PATIENT: { label: 'Bệnh nhân' },
  DELEGATE: { label: 'Người nhà' },
  SYSTEM: { label: 'Hệ thống' }
};

// Mã lỗi của Backend hay gặp trong nhật ký (cột chi tiết của dòng Thất bại)
export const ERROR_CODES = {
  DOSE_ALREADY_CONFIRMED: 'Cữ đã được xác nhận trước đó',
  DOSE_CANCELLED: 'Cữ đã bị hủy',
  INVALID_TAKEN_AT: 'Giờ uống không hợp lệ',
  CONFIRMATION_OUTSIDE_DOSE_DAY: 'Giờ uống khác ngày của cữ',
  CONFIRMATION_TOO_OLD: 'Xác nhận ngoại tuyến quá 72 giờ',
  INVALID_CORRECTION: 'Đính chính không hợp lệ',
  PAIRING_CODE_GONE: 'Mã ghép nối hết hạn hoặc đã dùng',
  PRESCRIPTION_NOT_DRAFT: 'Đơn không còn ở trạng thái Nháp',
  PRESCRIPTION_ALREADY_EXPIRED: 'Ngày tái khám đã qua',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ',
  FORBIDDEN: 'Không có quyền',
  AUDIT_LOG_IMMUTABLE: 'Nhật ký không được sửa/xóa'
};

export const ALERT_TYPES = {
  DOSE_UNCONFIRMED: { label: 'Chưa xác nhận sau 30 phút', tone: 'warning' },
  DOSE_MISSED: { label: 'Cữ bỏ lỡ', tone: 'danger' },
  VISIT_UPCOMING: { label: 'Sắp tái khám', tone: 'info' },
  DUPLICATE_INGREDIENT: { label: 'Trùng hoạt chất', tone: 'warning' }
};

export const APPOINTMENT_STATUS = {
  UPCOMING: 'Sắp tới',
  DONE: 'Đã khám',
  MISSED: 'Không đi khám'
};

export const REPORT_STATUS = {
  QUEUED: { label: 'Đang xếp hàng', tone: 'neutral' },
  PROCESSING: { label: 'Đang dựng', tone: 'info' },
  READY: { label: 'Sẵn sàng', tone: 'success' },
  FAILED: { label: 'Lỗi', tone: 'danger' }
};

export const DOSE_QUANTITY_STEP = 0.5;

// Nhãn tiếng Việt cho Action Type mà Backend ghi vào nhật ký
export const AUDIT_ACTIONS = {
  ACCOUNT_REGISTERED: 'Đăng ký tài khoản',
  LOGIN: 'Đăng nhập',
  TOKEN_REFRESHED: 'Gia hạn phiên đăng nhập',
  PATIENT_CREATED: 'Tạo hồ sơ bệnh nhân',
  PATIENT_UPDATED: 'Cập nhật hồ sơ',
  PAIRING_CODE_CREATED: 'Sinh mã ghép nối',
  DEVICE_PAIRED: 'Ghép nối thiết bị',
  DEVICE_REVOKED: 'Thu hồi thiết bị',
  DELEGATE_CREATED: 'Ủy quyền người nhà',
  DELEGATE_REVOKED: 'Thu hồi ủy quyền',
  PRESCRIPTION_CREATED: 'Tạo đơn nháp',
  PRESCRIPTION_UPDATED: 'Sửa đơn nháp',
  PRESCRIPTION_EXTENDED: 'Tiếp tục đơn sau tái khám',
  PRESCRIPTION_CONFIRMED: 'Xác nhận đơn',
  PRESCRIPTION_SUPERSEDED: 'Đơn bị thay thế',
  PRESCRIPTION_CANCELLED: 'Hủy đơn nháp',
  PRESCRIPTION_DELETED: 'Xóa đơn thuốc',
  PRESCRIPTION_EXPIRED: 'Đơn hết hạn',
  DOSES_GENERATED: 'Sinh lịch cữ thuốc',
  DOSE_CANCELLED: 'Hủy cữ của đơn cũ',
  DOSE_PENDING: 'Đến giờ nhắc',
  DOSE_CONFIRMED: 'Xác nhận cữ thuốc',
  DOSE_CONFIRMATION_CORRECTED: 'Đính chính xác nhận',
  DOSE_MISSED: 'Cữ bỏ lỡ',
  ALERT_CREATED: 'Tạo cảnh báo',
  ALERT_READ: 'Đọc cảnh báo',
  ALERTS_READ: 'Đánh dấu đã đọc cảnh báo',
  LAB_RESULT_CREATED: 'Ghi chỉ số xét nghiệm',
  APPOINTMENT_CREATED: 'Thêm lịch tái khám',
  APPOINTMENT_UPDATED: 'Cập nhật lịch tái khám',
  APPOINTMENT_MARKED_MISSED: 'Lịch hẹn đã qua',
  VISIT_REMINDER_CREATED: 'Nhắc lịch tái khám',
  REPORT_REQUESTED: 'Yêu cầu báo cáo PDF',
  REPORT_PROCESSING: 'Đang dựng báo cáo',
  REPORT_PDF_GENERATED: 'Báo cáo PDF sẵn sàng',
  REPORT_GENERATION_FAILED: 'Dựng báo cáo lỗi',
  REPORT_DOWNLOADED: 'Tải báo cáo PDF',
  AUDIT_LOG_MUTATION_BLOCKED: 'Chặn sửa/xóa nhật ký',
  POST_FAILED: 'Yêu cầu ghi bị từ chối',
  PUT_FAILED: 'Sửa bị từ chối',
  PATCH_FAILED: 'Cập nhật bị từ chối',
  DELETE_FAILED: 'Xóa bị từ chối',
  DEMO_DATA_SEEDED: 'Tạo dữ liệu mẫu'
};

export const DEFAULT_REMINDER_TIMES = SLOTS.map((slot) => ({ slot, time: SLOT_META[slot].defaultTime }));
// Quy tắc đã chốt: đúng giờ trong ±60 phút, bỏ lỡ sau giờ hẹn 60 phút.
export const DEFAULT_MISSED_THRESHOLD = 60;
export const PAIRING_CODE_TTL_MINUTES = 5;
export const ADHERENCE_PERIODS = [7, 30, 90];
export const REPORT_PERIODS = [30, 60, 90];
// Backend nhận xác nhận ngoại tuyến gửi lại trong tối đa 72 giờ, cùng ngày của cữ.
export const OFFLINE_MAX_AGE_HOURS = 72;
