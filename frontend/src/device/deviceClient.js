// Logic phía ứng dụng điện thoại (Mobile App): gọi API bằng token thiết bị (deviceAuth),
// lưu tạm khi mất mạng và gửi lại khi có mạng, giữ nguyên thời điểm bấm (UC-07, 3c).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as deviceApi from '../api/device.js';
import { isNetworkError } from '../api/errors.js';
import { clock } from '../app/clock.js';
import { onRefreshAll } from '../app/query.js';
import { getPhone, updatePhone } from './phones.js';

const POLL_MS = 10_000;

async function fetchSnapshot(token) {
  const [profile, doses, last] = await Promise.all([
    deviceApi.getDeviceProfile(token),
    deviceApi.listTodayDoses(token),
    deviceApi.getLastConfirmed(token)
  ]);
  // Cữ đã hủy do thay đơn không còn hiện trên máy (BR-03).
  return { profile, doses: doses.filter((d) => d.status !== 'CANCELLED'), last, savedAt: new Date(clock.now()).toISOString() };
}

/**
 * Dữ liệu hiển thị của một điện thoại. Có mạng: tải từ máy chủ mỗi 10 giây và lưu bản sao;
 * mất mạng: hiển thị bản sao gần nhất. Token bị thu hồi: máy chủ trả 401.
 */
export function usePhoneData(phone) {
  const [state, setState] = useState(() => initialState(phone));
  const seq = useRef(0);
  const token = phone?.token;
  const online = phone?.online;

  const load = useCallback(async () => {
    const current = phone?.id ? getPhone(phone.id) : null;
    if (!current?.token) {
      setState({ state: 'UNPAIRED' });
      return;
    }
    if (!current.online) {
      setState(fromCache(current));
      return;
    }
    const mine = ++seq.current;
    try {
      const snapshot = await fetchSnapshot(current.token);
      if (mine !== seq.current) return;
      updatePhone(current.id, (p) => (p.token === current.token ? { cache: snapshot } : {}));
      setState({ state: 'READY', ...snapshot, fromCache: false });
    } catch (error) {
      if (mine !== seq.current) return;
      if (error?.status === 401) {
        updatePhone(current.id, (p) => (p.token === current.token ? { cache: { revoked: true } } : {}));
        setState({ state: 'REVOKED' });
      } else if (isNetworkError(error) && current.cache && !current.cache.revoked) {
        setState({ ...fromCache(current), serverDown: true });
      } else {
        setState({ state: 'ERROR', error });
      }
    }
  }, [phone?.id]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const off = onRefreshAll(load);
    return () => {
      clearInterval(id);
      off();
    };
  }, [load, token, online]);

  return { ...state, reload: load };
}

function initialState(phone) {
  if (!phone?.token) return { state: 'UNPAIRED' };
  if (phone.cache && !phone.cache.revoked) return { state: 'READY', ...phone.cache, fromCache: true };
  return { state: 'LOADING' };
}

function fromCache(phone) {
  if (!phone.cache) return { state: 'OFFLINE_NO_CACHE' };
  if (phone.cache.revoked) return { state: 'REVOKED', fromCache: true };
  return { state: 'READY', ...phone.cache, fromCache: true };
}

export async function pairPhone(phone, code) {
  const result = await deviceApi.pairDevice({
    code,
    pushToken: `sim-${phone.id}-${Date.now().toString(36)}`,
    platform: phone.platform || 'ANDROID',
    deviceName: `${phone.model} (${phone.name})`
  });
  updatePhone(phone.id, { token: result.deviceToken, cache: null, queue: [], acked: [] });
  return result;
}

/** Xóa ghép nối trên máy (như gỡ ứng dụng); thiết bị phía máy chủ vẫn cần người chăm sóc thu hồi. */
export function forgetPairing(phone) {
  updatePhone(phone.id, { token: null, cache: null, queue: [], acked: [] });
}

/** Gửi lại các xác nhận lưu tạm theo đúng thứ tự bấm; lỗi mạng thì giữ phần chưa gửi. */
export async function syncQueue(phoneId) {
  const phone = getPhone(phoneId);
  if (!phone?.queue?.length || !phone.online || !phone.token) return null;
  const summary = { sent: 0, already: 0, rejected: [], revoked: false, pending: 0 };
  const remaining = [];
  for (let i = 0; i < phone.queue.length; i++) {
    const item = phone.queue[i];
    try {
      await deviceApi.confirmDose(phone.token, item.doseId, { takenAt: item.takenAt, correctsConfirmationId: item.correctsConfirmationId || undefined });
      summary.sent++;
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(...phone.queue.slice(i));
        summary.pending = remaining.length;
        break;
      }
      if (err?.status === 401) {
        summary.revoked = true;
        break;
      }
      if (err?.code === 'DOSE_ALREADY_CONFIRMED') summary.already++;
      else summary.rejected.push(err?.message || 'Không gửi được');
    }
  }
  updatePhone(phoneId, { queue: remaining });
  return summary;
}

export async function setOnline(phone, online) {
  updatePhone(phone.id, { online });
  return online ? syncQueue(phone.id) : null;
}

/**
 * Bấm "Đã uống"/"Xác nhận hộ" cho một cữ (gồm nhiều thuốc cùng buổi): một thao tác,
 * ứng dụng gửi một xác nhận cho từng thuốc và báo lỗi riêng từng thuốc nếu có.
 */
export async function confirmDoses(phone, doses) {
  const takenAt = new Date(clock.now()).toISOString();
  if (!phone.online) {
    updatePhone(phone.id, (p) => ({
      queue: [
        ...p.queue,
        ...doses.filter((d) => !p.queue.some((q) => q.doseId === d.id && !q.correctsConfirmationId)).map((d) => ({ doseId: d.id, takenAt, queuedAt: takenAt }))
      ]
    }));
    return { queued: true, takenAt, results: [] };
  }
  const results = await Promise.all(
    doses.map((d) =>
      deviceApi.confirmDose(phone.token, d.id, { takenAt }).then(
        (confirmation) => ({ ok: true, dose: d, confirmation }),
        (error) => ({ ok: false, dose: d, error })
      )
    )
  );
  return { queued: false, takenAt, results };
}

let audioCtx = null;

/** Âm báo nhắc thuốc (FR-10). Trình duyệt có thể chặn âm thanh cho tới khi người dùng chạm. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  } catch {
    // bỏ qua: không có âm thanh vẫn hiển thị nhắc nhở
  }
}
