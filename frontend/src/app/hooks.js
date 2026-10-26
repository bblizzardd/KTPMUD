import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { clock, subscribeClock } from './clock.js';

/** Thời điểm hiện tại theo giờ máy chủ (có tính độ lệch khi tua đồng hồ kiểm thử). */
export function useNow(intervalMs = 15_000) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(force, intervalMs);
    const unsubscribe = subscribeClock(force);
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, [intervalMs]);
  return clock.now();
}

function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Tùy chọn giao diện lưu trên trình duyệt này (không phải dữ liệu nghiệp vụ). */
export function usePref(key, fallback) {
  const [value, setValue] = useState(() => readPref(key, fallback));
  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // bỏ qua
        }
        return resolved;
      });
    },
    [key]
  );
  return [value, update];
}

export function useOnClickOutside(ref, handler, active = true) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      saved.current(event);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') saved.current(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active]);
}

export function useDebounced(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
