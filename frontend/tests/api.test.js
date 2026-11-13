// Kiểm thử lớp gọi API (src/api/http.js) với fetch giả lập. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSession, getSession, request, setTokens } from '../src/api/http.js';
import { fieldError, isNetworkError } from '../src/api/errors.js';
import { login, toPrescriptionInput } from '../src/api/caregiver.js';
import { ACCOUNT_SESSION, listTodayDoses } from '../src/api/device.js';
import { href, ROUTES } from '../src/app/router.js';

test('giữ giao diện app khi chuyển màn hình và cho phép chuyển về web', () => {
  const previous = globalThis.window;
  globalThis.window = { location: { hash: '#/tong-quan?surface=app' } };
  try {
    assert.equal(href(ROUTES.family), '#/ho-so?surface=app');
    assert.equal(href(ROUTES.patient, { surface: 'web' }), '#/benh-nhan?surface=web');
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test('dữ liệu bệnh nhân lưu riêng trong phiên và xóa khi đăng xuất, giữ thiết bị mô phỏng', async () => {
  const storage = () => {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  };
  const previousLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage() });
  try {
    const phones = await import('../src/device/phones.js');
    const patient = phones.ensureAccountPhone({ id: 'patient-account', displayName: 'Bệnh nhân' });
    phones.updatePhone(patient.id, { cache: { private: true }, queue: [{ id: 'unsent' }] });
    assert.equal(JSON.parse(localStorage.getItem('antam.v1.phones')).some(p => p.accountId), false);
    assert.equal(JSON.parse(sessionStorage.getItem('antam.v1.accountPhones'))[0].queue.length, 1);
    const simulatorCount = phones.listPhones().filter(p => !p.accountId).length;
    phones.clearAccountPhones();
    assert.equal(phones.getPhone(patient.id), null);
    assert.deepEqual(JSON.parse(sessionStorage.getItem('antam.v1.accountPhones')), []);
    assert.equal(phones.listPhones().length, simulatorCount);
  } finally {
    if (previousLocal) Object.defineProperty(globalThis, 'localStorage', previousLocal);
    else delete globalThis.localStorage;
    if (previousSession) Object.defineProperty(globalThis, 'sessionStorage', previousSession);
    else delete globalThis.sessionStorage;
  }
});

const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : undefined });
    return handler(url, init, calls.length);
  };
  return calls;
}

test('access token hết hạn: tự đổi bằng refresh token một lần rồi gửi lại yêu cầu', async () => {
  setTokens({ accessToken: 'old-access', refreshToken: 'refresh-1' });
  const calls = mockFetch((url, init) => {
    if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'new-access', refreshToken: 'refresh-2', expiresIn: 900 });
    return init.headers.Authorization === 'Bearer new-access' ? json(200, [{ id: 'p1' }]) : json(401, { code: 'UNAUTHORIZED', message: 'hết hạn' });
  });
  const [p1, p2] = await Promise.all([request('/patients'), request('/patients')]);
  assert.deepEqual(p1, [{ id: 'p1' }]);
  assert.deepEqual(p2, [{ id: 'p1' }]);
  assert.equal(calls.filter((c) => c.url.endsWith('/auth/refresh')).length, 1, 'hai yêu cầu cùng lúc chỉ đổi token một lần');
  assert.deepEqual(calls.find((c) => c.url.endsWith('/auth/refresh')).body, { refreshToken: 'refresh-1' });
  assert.equal(getSession().refreshToken, 'refresh-2');
  clearSession();
});

test('refresh token bị từ chối thì xóa phiên để quay về màn hình đăng nhập', async () => {
  setTokens({ accessToken: 'a', refreshToken: 'used' });
  mockFetch((url) => (url.endsWith('/auth/refresh') ? json(401, { code: 'INVALID_REFRESH_TOKEN', message: 'đã dùng' }) : json(401, { code: 'UNAUTHORIZED', message: 'x' })));
  await assert.rejects(request('/auth/me'), (err) => err.status === 401);
  assert.equal(getSession(), null);
});

test('lỗi theo schema Error: giữ mã, đổi tên trường và thông điệp sang tiếng Việt', async () => {
  setTokens({ accessToken: 'a', refreshToken: 'r' });
  mockFetch(() =>
    json(400, {
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu đầu vào không hợp lệ',
      details: [
        { field: 'items.0.unitsPerDose', issue: 'Too small: expected number to be >=0.25' },
        { field: 'nextVisitDate', issue: 'Ngày tái khám phải từ ngày bắt đầu trở đi' }
      ]
    })
  );
  const err = await request('/patients/x/prescriptions', { method: 'POST', body: {} }).catch((e) => e);
  assert.equal(err.status, 400);
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.equal(fieldError(err, 'items[0].unitsPerDose'), 'Giá trị nhỏ hơn mức cho phép.');
  assert.equal(fieldError(err, 'nextVisitDate'), 'Ngày tái khám phải từ ngày bắt đầu trở đi');
  clearSession();
});

test('không gọi được máy chủ: báo lỗi mạng rõ ràng thay vì lỗi kỹ thuật', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  const err = await request('/device/doses/today', { auth: 'device', deviceToken: 't' }).catch((e) => e);
  assert.equal(err.status, 0);
  assert.ok(isNetworkError(err));
  assert.match(err.message, /máy chủ An Tâm/);
});

test('token thiết bị gửi kèm Bearer; không dùng token người chăm sóc', async () => {
  setTokens({ accessToken: 'caregiver', refreshToken: 'r' });
  const calls = mockFetch(() => json(201, { id: 'c1' }));
  await request('/doses/d1/confirmations', { method: 'POST', auth: 'device', deviceToken: 'device-token', body: { takenAt: '2026-10-22T00:05:00.000Z' } });
  assert.equal(calls[0].auth, 'Bearer device-token');
  assert.deepEqual(calls[0].body, { takenAt: '2026-10-22T00:05:00.000Z' });
  clearSession();
});

test('đơn thuốc gửi lên chỉ gồm đúng các trường của PrescriptionInput', () => {
  const payload = toPrescriptionInput({
    issuedDate: '2026-10-20',
    startDate: '2026-10-20',
    nextVisitDate: '2026-11-20',
    sourceNote: '  ',
    items: [{ id: 'tmp-1', drugId: null, drugNameRaw: ' Panfor SR 500mg ', unitsPerDose: '1', unit: 'viên', slots: ['MORNING'], instruction: '', status: 'x' }]
  });
  assert.deepEqual(payload, {
    issuedDate: '2026-10-20',
    startDate: '2026-10-20',
    nextVisitDate: '2026-11-20',
    items: [{ drugId: null, drugNameRaw: 'Panfor SR 500mg', unitsPerDose: 1, unit: 'viên', slots: ['MORNING'] }]
  });
});

test('giữ giờ uống tự chọn và chỉ gửi giờ của các buổi còn được chọn', () => {
  const payload = toPrescriptionInput({
    issuedDate: '2026-10-22', startDate: '2026-10-22', nextVisitDate: '2026-11-22',
    items: [{ drugNameRaw: 'A', unitsPerDose: 1, slots: ['MORNING'], times: { MORNING: '08:25', EVENING: '20:00' } }],
  });
  assert.deepEqual(payload.items[0].times, { MORNING: '08:25' });
});

test('đăng nhập bệnh nhân giữ vai trò và dùng phiên tài khoản để đọc lịch, kể cả sau refresh', async () => {
  const calls = mockFetch(url => url.endsWith('/auth/login')
    ? json(200, { accessToken: 'patient-access', refreshToken: 'patient-refresh', role: 'PATIENT', accountId: 'patient-account' })
    : url.endsWith('/auth/refresh')
      ? json(200, { accessToken: 'patient-new', refreshToken: 'refresh-new', role: 'PATIENT', accountId: 'patient-account' })
      : getSession()?.accessToken === 'patient-new' ? json(200, [{ id: 'own-dose' }]) : json(401, { code: 'UNAUTHORIZED' }));
  await login({ email: 'patient@example.test', password: 'password', role: 'PATIENT' });
  assert.equal(calls[0].body.role, 'PATIENT');
  assert.deepEqual(await listTodayDoses(ACCOUNT_SESSION), [{ id: 'own-dose' }]);
  assert.equal(getSession().role, 'PATIENT');
  assert.equal(getSession().accountId, 'patient-account');
  assert.equal(calls.at(-1).auth, 'Bearer patient-new');
  clearSession();
});

test('yêu cầu của phiên cũ không được gửi lại bằng tài khoản vừa đăng nhập', async () => {
  setTokens({ accessToken: 'patient', refreshToken: 'r-patient', role: 'PATIENT', accountId: 'p' });
  let finish;
  const calls = mockFetch(() => new Promise(resolve => { finish = resolve; }));
  const pending = request('/device/doses/today');
  clearSession();
  setTokens({ accessToken: 'caregiver', refreshToken: 'r-caregiver', role: 'CAREGIVER', accountId: 'c' });
  finish(json(401, { code: 'UNAUTHORIZED' }));
  await assert.rejects(pending, error => error.code === 'SESSION_CHANGED');
  assert.equal(calls.length, 1);
  assert.equal(getSession().accountId, 'c');
  clearSession();
});
