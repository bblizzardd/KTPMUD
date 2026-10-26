// Giờ hiển thị trên giao diện bám theo giờ máy chủ (GET /health). Khi Backend bật công cụ
// kiểm thử và tua nhanh đồng hồ, giao diện và điện thoại mô phỏng cùng thấy giờ mới.

import { fetchHealth } from '../api/http.js';

let offsetMs = 0;
let devTools = false;
let reachable = true;
const listeners = new Set();

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
  try {
    const sentAt = Date.now();
    const health = await fetchHealth();
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
    if (reachable) {
      reachable = false;
      listeners.forEach((fn) => fn());
    }
  }
}

let started = false;
export function startClockSync() {
  if (started) return;
  started = true;
  syncClock();
  setInterval(syncClock, 30_000);
}
