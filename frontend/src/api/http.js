// Gọi REST API của Backend An Tâm (/api/v1). Token người chăm sóc giữ trong sessionStorage
// của tab: tải lại trang vẫn còn phiên, đóng tab là hết. Access token hết hạn (15 phút)
// thì tự đổi bằng refresh token một lần rồi gửi lại yêu cầu.

import { ApiError, NETWORK_ERROR, localizeIssue, normalizeField } from './errors.js';

export const API_BASE = '/api/v1';
const SESSION_KEY = 'antam.v1.session';
const listeners = new Set();

function readSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return raw?.accessToken && raw?.refreshToken ? raw : null;
  } catch {
    return null;
  }
}

let session = readSession();
let sessionGeneration = 0;

function writeSession(next, refreshed = false) {
  if (!refreshed) sessionGeneration++;
  session = next;
  try {
    if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ: phiên vẫn dùng được trong bộ nhớ.
  }
  listeners.forEach((fn) => fn(next));
}

export function getSession() {
  return session;
}

export function setTokens(tokens, refreshed = false) {
  writeSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, role: tokens.role || 'CAREGIVER', accountId: tokens.accountId || null }, refreshed);
}

export function clearSession() {
  if (session) writeSession(null);
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function errorFrom(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const details = Array.isArray(payload?.details) ? payload.details.map((d) => ({ field: normalizeField(d.field), issue: localizeIssue(d.issue) })) : [];
  return new ApiError(response.status, payload?.code || `HTTP_${response.status}`, payload?.message || `Máy chủ trả lỗi HTTP ${response.status}.`, details);
}

let refreshing = null;

/** Đổi refresh token lấy cặp token mới; nhiều yêu cầu cùng lúc chỉ đổi một lần. */
function refreshTokens() {
  if (!refreshing) {
    const current = session;
    refreshing = (async () => {
      if (!current?.refreshToken) throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.');
      const response = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } });
      if (!response.ok) {
        if (session === current) clearSession();
        throw await errorFrom(response);
      }
      const tokens = await response.json();
      if (session !== current) throw new ApiError(401, 'SESSION_CHANGED', 'Phiên đăng nhập đã thay đổi.');
      setTokens({ ...tokens, role: tokens.role || current.role, accountId: tokens.accountId || current.accountId }, true);
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function send(path, { method = 'GET', body, token } = {}) {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Không kết nối được máy chủ An Tâm. Kiểm tra máy chủ đã chạy chưa rồi thử lại.');
  }
}

async function parse(response, { blob }) {
  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return null;
  if (blob) return response.blob();
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * auth: 'caregiver' (JWT người chăm sóc), 'device' (token thiết bị truyền qua deviceToken)
 * hoặc 'none'.
 */
export async function request(path, { method = 'GET', body, auth = 'caregiver', deviceToken, blob = false } = {}) {
  if (auth === 'device') return parse(await send(path, { method, body, token: deviceToken }), { blob });
  if (auth === 'none') return parse(await send(path, { method, body }), { blob });

  if (!session) throw new ApiError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập.');
  const generation = sessionGeneration;
  const ensureSameSession = () => {
    if (generation !== sessionGeneration) throw new ApiError(401, 'SESSION_CHANGED', 'Phiên đăng nhập đã thay đổi.');
  };
  if (refreshing) await refreshing.catch(() => {});
  ensureSameSession();
  let response = await send(path, { method, body, token: session?.accessToken });
  ensureSameSession();
  if (response.status === 401 && session?.refreshToken) {
    await refreshTokens();
    ensureSameSession();
    response = await send(path, { method, body, token: session?.accessToken });
    ensureSameSession();
  }
  if (response.status === 401) clearSession();
  return parse(response, { blob });
}

/** Giờ máy chủ (có thể đang được tua nhanh khi bật công cụ kiểm thử). */
export async function fetchHealth() {
  let response;
  try {
    response = await fetch('/health', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Không kết nối được máy chủ An Tâm.');
  }
  return parse(response, { blob: false });
}
