// Copy this standalone ES module into the frontend when connecting the real API.
// Keep credentials in application memory; this helper does not use localStorage.
export function createApiClient({ baseUrl = 'http://127.0.0.1:8080/api/v1', fetchImpl = fetch } = {}) {
  let caregiverToken = null;
  let refreshToken = null;
  let deviceToken = null;
  const base = baseUrl.replace(/\/$/, '');

  async function request(route, { method = 'GET', body, auth = 'caregiver', blob = false } = {}) {
    const token = auth === 'device' ? deviceToken : auth === 'caregiver' ? caregiverToken : null;
    const response = await fetchImpl(`${base}${route}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ code: 'HTTP_ERROR', message: `HTTP ${response.status}` }));
      throw Object.assign(new Error(payload.message), payload, { status: response.status });
    }
    if (response.status === 204) return null;
    return blob ? response.blob() : response.json();
  }

  const query = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined)).toString();
  return {
    request,
    register: (body) => request('/auth/register', { method: 'POST', body, auth: 'none' }),
    async login(email, password) {
      const tokens = await request('/auth/login', { method: 'POST', body: { email, password }, auth: 'none' });
      caregiverToken = tokens.accessToken; refreshToken = tokens.refreshToken;
      return tokens;
    },
    async refresh() {
      if (!refreshToken) throw new Error('Chưa có refresh token.');
      const tokens = await request('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: 'none' });
      caregiverToken = tokens.accessToken; refreshToken = tokens.refreshToken;
      return tokens;
    },
    clearCredentials() { caregiverToken = null; refreshToken = null; deviceToken = null; },
    me: () => request('/auth/me'),
    subscribeAlerts(onAlert, { onReady, onError, onClose, WebSocketImpl = globalThis.WebSocket } = {}) {
      if (!caregiverToken) throw new Error('Đăng nhập người chăm sóc trước khi nhận cảnh báo.');
      const socketUrl = new URL(base);
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      socketUrl.pathname = '/ws/alerts';
      socketUrl.search = '';
      const socket = new WebSocketImpl(socketUrl);
      socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'authenticate', token: caregiverToken })));
      socket.addEventListener('message', (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { onError?.(new Error('Thông điệp WebSocket không hợp lệ.')); return; }
        if (message.type === 'authenticated') onReady?.();
        else if (message.type === 'alert') onAlert(message.alert);
      });
      socket.addEventListener('error', (event) => onError?.(event));
      socket.addEventListener('close', (event) => onClose?.(event));
      return socket; // Call socket.close() in the React effect cleanup.
    },
    listPatients: () => request('/patients'),
    createPatient: (body) => request('/patients', { method: 'POST', body }),
    updatePatient: (id, body) => request(`/patients/${id}`, { method: 'PATCH', body }),
    searchDrugs: (q, limit = 10) => request(`/drugs?${query({ q, limit })}`),
    listPrescriptions: (id) => request(`/patients/${id}/prescriptions`),
    saveDraft: (patientId, body, id) => request(id ? `/prescriptions/${id}` : `/patients/${patientId}/prescriptions`, { method: id ? 'PUT' : 'POST', body }),
    confirmPrescription: (id) => request(`/prescriptions/${id}/confirm`, { method: 'POST', body: {} }),
    cancelDraft: (id) => request(`/prescriptions/${id}/cancel`, { method: 'POST', body: {} }),
    listDoses: (id, from, to, status) => request(`/patients/${id}/doses?${query({ from, to, status })}`),
    adherence: (id, days = 30) => request(`/patients/${id}/adherence/summary?${query({ days })}`),
    pairingCode: (id, role = 'PATIENT', delegateId) => request(`/patients/${id}/pairing-codes`, { method: 'POST', body: { role, ...(delegateId ? { delegateId } : {}) } }),
    async pairDevice({ code, pushToken, platform = 'ANDROID', deviceName }) {
      const result = await request('/devices/pair', { method: 'POST', auth: 'none', body: { code, pushToken, platform, ...(deviceName ? { deviceName } : {}) } });
      deviceToken = result.deviceToken;
      return result;
    },
    deviceDosesToday: () => request('/device/doses/today', { auth: 'device' }),
    // actorRole/actorId come from the device token, never from the browser payload.
    confirmDose: (id, { takenAt, correctsConfirmationId } = {}) => request(`/doses/${id}/confirmations`, { method: 'POST', auth: 'device', body: { ...(takenAt ? { takenAt } : {}), ...(correctsConfirmationId ? { correctsConfirmationId } : {}) } }),
    listDelegates: (id) => request(`/patients/${id}/delegates`),
    addDelegate: (id, body) => request(`/patients/${id}/delegates`, { method: 'POST', body }),
    revokeDelegate: (patientId, id) => request(`/patients/${patientId}/delegates/${id}`, { method: 'DELETE' }),
    listDevices: (id) => request(`/patients/${id}/devices`),
    revokeDevice: (patientId, id) => request(`/patients/${patientId}/devices/${id}`, { method: 'DELETE' }),
    labs: (id) => request(`/patients/${id}/lab-results`),
    addLab: (id, body) => request(`/patients/${id}/lab-results`, { method: 'POST', body }),
    appointments: (id) => request(`/patients/${id}/appointments`),
    addAppointment: (id, body) => request(`/patients/${id}/appointments`, { method: 'POST', body }),
    updateAppointmentStatus: (id, status) => request(`/appointments/${id}`, { method: 'PATCH', body: { status } }),
    alerts: (id, unreadOnly = false) => request(`/patients/${id}/alerts?${query({ unreadOnly })}`),
    readAlert: (id) => request(`/alerts/${id}/read`, { method: 'PATCH', body: {} }),
    requestReport: (id, periodDays = 30) => request(`/patients/${id}/reports`, { method: 'POST', body: { periodDays } }),
    report: (id) => request(`/reports/${id}`),
    downloadReport: (id) => request(`/reports/${id}/download`, { blob: true }),
    auditLogs: (id, page = 1, size = 20) => request(`/patients/${id}/audit-logs?${query({ page, size })}`),
  };
}
