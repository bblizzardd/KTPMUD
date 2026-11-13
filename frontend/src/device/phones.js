// Các điện thoại mô phỏng (Mobile App) chạy ngay trong trình duyệt. Mỗi máy tự giữ token
// thiết bị, hàng đợi xác nhận khi mất mạng và bản lưu lịch gần nhất — giống bộ nhớ của
// một điện thoại thật. Dữ liệu nghiệp vụ vẫn nằm trên máy chủ.

import { useSyncExternalStore } from 'react';
import { ACCOUNT_SESSION } from '../api/device.js';

const KEY = 'antam.v1.phones';
const ACCOUNT_KEY = 'antam.v1.accountPhones';
const listeners = new Set();

const blank = (p) => ({ token: null, online: true, queue: [], largeText: false, cache: null, acked: [], ...p });

function defaults() {
  return [
    blank({ id: 'phone-1', name: 'Điện thoại 1', model: 'Điện thoại Android' }),
    blank({ id: 'phone-2', name: 'Điện thoại 2', model: 'Điện thoại Android' })
  ];
}

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || 'null');
    const accounts = JSON.parse(sessionStorage.getItem(ACCOUNT_KEY) || '[]');
    return [...(Array.isArray(list) && list.length ? list.filter(p => !p.accountId).map(blank) : defaults()), ...(Array.isArray(accounts) ? accounts.filter(p => p.accountId).map(blank) : [])];
  } catch {
    return defaults();
  }
}

let phones = read();

function commit(next) {
  phones = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next.filter(p => !p.accountId)));
    sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(next.filter(p => p.accountId)));
  } catch {
    // Không lưu được thì vẫn chạy trong bộ nhớ của tab.
  }
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  // Điện thoại mở ở cửa sổ riêng và ở khung bên cạnh dùng chung trạng thái.
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      phones = read();
      listeners.forEach((fn) => fn());
    }
  });
}

export function listPhones() {
  return phones;
}

export function getPhone(id) {
  return phones.find((p) => p.id === id) || null;
}

export function ensureAccountPhone(account) {
  const id = `account-${account.id}`;
  if (!getPhone(id)) commit([...phones, blank({ id, accountId: account.id, name: account.displayName, token: ACCOUNT_SESSION, online: navigator.onLine })]);
  return getPhone(id);
}

export function clearAccountPhones() {
  commit(phones.filter(p => !p.accountId));
}

export function updatePhone(id, patch) {
  commit(phones.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));
  return getPhone(id);
}

export function addPhone() {
  let n = phones.length + 1;
  while (phones.some((p) => p.id === `phone-${n}`)) n++;
  const phone = blank({ id: `phone-${n}`, name: `Điện thoại ${n}`, model: 'Điện thoại Android' });
  commit([...phones, phone]);
  return phone;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePhones() {
  return useSyncExternalStore(subscribe, listPhones, listPhones);
}
