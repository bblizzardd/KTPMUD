// Giờ hiển thị trên giao diện bám theo giờ máy chủ (GET /health). Khi Backend bật công cụ
// kiểm thử và tua nhanh đồng hồ, giao diện và điện thoại mô phỏng cùng thấy giờ mới.

import { fetchHealth } from '../api/http.js';
import { invalidateAll } from './query.js';

let offsetMs = 0;
let devTools = false;
let reachable = true;
const listeners = new Set();
const CLOCK_SIGNAL = 'antam.v1.clockChanged';
let lastRequest = 0;

export function notifyClockAdvance() {
  try { localStorage.setItem(CLOCK_SIGNAL, String(Date.now())); } catch { /* polling still refreshes the clock */ }
}

export const clock = {
  now: () => Date.now() + offsetMs,
  offsetMs: () => offsetMs,
  devTools: () => devTools,
  reachable: () => reachable
};

export function subscribeClock(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function syncClock() {
  const requestId = ++lastRequest;
  try {
    const sentAt = Date.now();
    const health = await fetchHealth();
    if (requestId !== lastRequest) return;
    const receivedAt = Date.now();
    const next = Date.parse(health.time) - (sentAt + receivedAt) / 2;
    // Bỏ qua dao động mạng nhỏ để giao diện không nhảy giờ liên tục.
    if (Math.abs(next - offsetMs) > 1500 || devTools !== Boolean(health.devTools) || !reachable) {
      offsetMs = Math.abs(next) < 1500 ? 0 : next;
      devTools = Boolean(health.devTools);
      reachable = true;
      listeners.forEach((fn) => fn());
    }
  } catch {
    if (requestId === lastRequest && reachable) {
      reachable = false;
      listeners.forEach((fn) => fn());
    }
  }
}

let started = false;
export function startClockSync() {
  if (started) return;
  started = true;
  window.addEventListener('storage', async event => {
    if (event.key !== CLOCK_SIGNAL) return;
    await syncClock();
    invalidateAll();
  });
  syncClock();
  setInterval(syncClock, 30_000);
}
