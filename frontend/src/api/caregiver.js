// API cho Web App của người chăm sóc (caregiverAuth). Mỗi hàm ứng với một endpoint trong
// docs/api/openapi.yaml hoặc phần mở rộng ghi ở frontend/docs/openapi-bo-sung.yaml.

import { clearSession, request, setTokens } from './http.js';
import { rememberDrugs } from './drugs.js';

const qs = (values) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

// --- Auth (UC-01) ---
export const register = (body) => request('/auth/register', { method: 'POST', body, auth: 'none' });
export async function login({ email, password }) {
  const tokens = await request('/auth/login', { method: 'POST', body: { email, password }, auth: 'none' });
  setTokens(tokens);
  return tokens;
}
export const logout = () => clearSession();
export const getMe = () => request('/auth/me');

// --- Hồ sơ (UC-02) ---
export const listPatients = () => request('/patients');
export const createPatient = (body) => request('/patients', { method: 'POST', body });
export const updatePatient = (patientId, body) => request(`/patients/${patientId}`, { method: 'PATCH', body });

// --- Thiết bị & người nhà (UC-03, UC-04) ---
export const createPairingCode = (patientId, body) => request(`/patients/${patientId}/pairing-codes`, { method: 'POST', body });
export const listDevices = (patientId) => request(`/patients/${patientId}/devices`);
export const revokeDevice = (patientId, deviceId) => request(`/patients/${patientId}/devices/${deviceId}`, { method: 'DELETE' });
export const listDelegates = (patientId) => request(`/patients/${patientId}/delegates`);
export const createDelegate = (patientId, body) => request(`/patients/${patientId}/delegates`, { method: 'POST', body });
export const revokeDelegate = (patientId, delegateId) => request(`/patients/${patientId}/delegates/${delegateId}`, { method: 'DELETE' });

// --- Danh mục thuốc (FR-05) ---
export async function searchDrugs(q, limit = 8) {
  const list = await request(`/drugs${qs({ q, limit })}`);
  rememberDrugs(list);
  return list;
}
export async function getDrug(drugId) {
  const drug = await request(`/drugs/${drugId}`);
  rememberDrugs([drug]);
  return drug;
}

// --- Đơn thuốc (UC-05, UC-06) ---
/** Backend kiểm tra chặt tên trường: chỉ gửi đúng các trường của PrescriptionInput. */
export function toPrescriptionInput(form) {
  const text = (value) => String(value ?? '').trim();
  return {
    issuedDate: form.issuedDate,
    startDate: form.startDate,
    nextVisitDate: form.nextVisitDate,
    ...(text(form.sourceNote) ? { sourceNote: text(form.sourceNote) } : {}),
    items: form.items.map((item) => ({
      drugId: item.drugId || null,
      drugNameRaw: text(item.drugNameRaw),
      unitsPerDose: Number(item.unitsPerDose),
      unit: text(item.unit) || 'viên',
      slots: [...item.slots],
      ...(text(item.instruction) ? { instruction: text(item.instruction) } : {})
    }))
  };
}
export const listPrescriptions = (patientId, { status } = {}) => request(`/patients/${patientId}/prescriptions${qs({ status })}`);
export const getPrescription = (prescriptionId) => request(`/prescriptions/${prescriptionId}`);
export const createPrescription = (patientId, form) => request(`/patients/${patientId}/prescriptions`, { method: 'POST', body: toPrescriptionInput(form) });
export const updatePrescription = (prescriptionId, form) => request(`/prescriptions/${prescriptionId}`, { method: 'PUT', body: toPrescriptionInput(form) });
export const confirmPrescription = (prescriptionId) => request(`/prescriptions/${prescriptionId}/confirm`, { method: 'POST', body: {} });
export const cancelPrescription = (prescriptionId) => request(`/prescriptions/${prescriptionId}/cancel`, { method: 'POST', body: {} });

// --- Cữ thuốc & tuân thủ (FR-09..FR-15, FR-19) ---
export const listDoses = (patientId, { from, to, status } = {}) => request(`/patients/${patientId}/doses${qs({ from, to, status })}`);
export const listDoseConfirmations = (doseId) => request(`/doses/${doseId}/confirmations`);
export const getAdherenceSummary = (patientId, days = 30) => request(`/patients/${patientId}/adherence/summary${qs({ days })}`);

// --- Cảnh báo (FR-12) ---
export const listAlerts = (patientId, { unreadOnly = false } = {}) => request(`/patients/${patientId}/alerts${qs({ unreadOnly })}`);
export const markAlertsRead = (patientId, alertIds) => request(`/patients/${patientId}/alerts/read`, { method: 'POST', body: alertIds ? { alertIds } : {} });

// --- Lâm sàng (UC-11, UC-12) ---
export const listLabResults = (patientId) => request(`/patients/${patientId}/lab-results`);
export const createLabResult = (patientId, body) => request(`/patients/${patientId}/lab-results`, { method: 'POST', body });
export const listAppointments = (patientId) => request(`/patients/${patientId}/appointments`);
export const createAppointment = (patientId, body) => request(`/patients/${patientId}/appointments`, { method: 'POST', body });
export const updateAppointmentStatus = (appointmentId, status) => request(`/appointments/${appointmentId}`, { method: 'PATCH', body: { status } });

// --- Báo cáo PDF (UC-13) ---
export const listReports = (patientId) => request(`/patients/${patientId}/reports`);
export const requestReport = (patientId, periodDays) => request(`/patients/${patientId}/reports`, { method: 'POST', body: { periodDays } });
export const getReport = (reportId) => request(`/reports/${reportId}`);
export const downloadReport = (reportId) => request(`/reports/${reportId}/download`, { blob: true });

// --- Nhật ký (FR-18) ---
export const listAuditLogs = (patientId, { page = 1, size = 20, actionType, actorRole, status, q } = {}) =>
  request(`/patients/${patientId}/audit-logs${qs({ page, size, actionType, actorRole, status, q })}`);
/** Chỉ dùng để trình diễn TC-39: máy chủ phải từ chối bằng 405. */
export const attemptAuditDelete = (patientId, logId) => request(`/patients/${patientId}/audit-logs/${logId}`, { method: 'DELETE' });

// --- Công cụ kiểm thử (ENABLE_DEV_TOOLS=true trên Backend) ---
export const getDevClock = () => request('/dev/clock');
export const advanceDevClock = (body) => request('/dev/clock', { method: 'POST', body });
