// API cho ứng dụng điện thoại (deviceAuth): không đăng nhập, chỉ dùng token thiết bị
// nhận được khi ghép nối bằng mã 6 số (UC-03, UC-07, UC-08).

import { request } from './http.js';

const device = (token) => ({ auth: 'device', deviceToken: token });

export const pairDevice = ({ code, pushToken, platform = 'ANDROID', deviceName }) =>
  request('/devices/pair', { method: 'POST', auth: 'none', body: { code, pushToken, platform, ...(deviceName ? { deviceName } : {}) } });
export const getDeviceProfile = (token) => request('/device/me', device(token));
export const listTodayDoses = (token) => request('/device/doses/today', device(token));
export const getLastConfirmed = (token) => request('/device/doses/last-confirmed', device(token));
export const confirmDose = (token, doseId, { takenAt, correctsConfirmationId } = {}) =>
  request(`/doses/${doseId}/confirmations`, {
    method: 'POST',
    ...device(token),
    body: { ...(takenAt ? { takenAt } : {}), ...(correctsConfirmationId ? { correctsConfirmationId } : {}) }
  });
