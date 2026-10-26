// Bộ đệm dữ liệu đọc từ Backend. Mỗi khóa (ví dụ "p:<patientId>:rx") giữ kết quả gần nhất;
// trang hiển thị ngay dữ liệu cũ trong lúc tải lại. Sau mỗi thao tác ghi, gọi invalidate()
// với tiền tố khóa để các trang đang mở tự tải lại.

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const entries = new Map();
const refreshListeners = new Set();
const EMPTY = Object.freeze({ data: undefined, error: null, loading: false, updatedAt: 0 });

function entryFor(key, fetcher) {
  let entry = entries.get(key);
  if (!entry) {
    entry = { key, fetcher, subs: new Set(), snap: EMPTY, promise: null, stale: true };
    entries.set(key, entry);
  }
  if (fetcher) entry.fetcher = fetcher;
  return entry;
}

function setSnap(entry, patch) {
  entry.snap = { ...entry.snap, ...patch };
  entry.subs.forEach((fn) => fn());
}

function load(entry) {
  if (entry.promise) {
    // Đang tải mà có yêu cầu làm mới: tải lại thêm một lần sau khi xong để không lỡ thay đổi.
    entry.again = true;
    return entry.promise;
  }
  entry.stale = false;
  setSnap(entry, { loading: true });
  entry.promise = Promise.resolve()
    .then(() => entry.fetcher())
    .then(
      (data) => setSnap(entry, { data, error: null, loading: false, updatedAt: Date.now() }),
      (error) => setSnap(entry, { error, loading: false })
    )
    .finally(() => {
      entry.promise = null;
      if (entry.again) {
        entry.again = false;
        if (entry.subs.size) load(entry);
        else entry.stale = true;
      }
    });
  return entry.promise;
}

/**
 * Đọc dữ liệu theo khóa. Trả về { data, error, loading, refreshing, reload }.
 * loading chỉ đúng khi chưa có dữ liệu nào để hiển thị.
 */
export function useQuery(key, fetcher, { enabled = true, refreshMs } = {}) {
  const entry = enabled && key ? entryFor(key, fetcher) : null;
  const subscribe = useCallback(
    (cb) => {
      if (!entry) return () => {};
      entry.subs.add(cb);
      return () => entry.subs.delete(cb);
    },
    [entry]
  );
  const snap = useSyncExternalStore(subscribe, () => (entry ? entry.snap : EMPTY));

  useEffect(() => {
    if (entry && (entry.stale || (!entry.snap.updatedAt && !entry.promise))) load(entry);
  }, [entry]);

  useEffect(() => {
    if (!entry || !refreshMs) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) load(entry);
    }, refreshMs);
    return () => clearInterval(id);
  }, [entry, refreshMs]);

  const reload = useCallback(() => (entry ? load(entry) : Promise.resolve()), [entry]);
  return {
    data: snap.data,
    error: snap.error,
    loading: Boolean(entry) && snap.data === undefined && !snap.error,
    refreshing: snap.loading,
    reload
  };
}

/** Đánh dấu cũ mọi khóa bắt đầu bằng một trong các tiền tố; khóa đang hiển thị được tải lại ngay. */
export function invalidate(...prefixes) {
  for (const entry of entries.values()) {
    if (!prefixes.some((p) => entry.key.startsWith(p))) continue;
    if (entry.subs.size) load(entry);
    else entry.stale = true;
  }
}

/** Làm mới toàn bộ (sau khi tua đồng hồ, có cảnh báo mới...). Điện thoại mô phỏng cũng nghe tín hiệu này. */
export function invalidateAll() {
  invalidate('');
  refreshListeners.forEach((fn) => fn());
}

export function onRefreshAll(fn) {
  refreshListeners.add(fn);
  return () => refreshListeners.delete(fn);
}

export function clearQueries() {
  entries.clear();
}

/** Gộp trạng thái nhiều truy vấn: sẵn sàng khi tất cả đã có dữ liệu. */
export function combine(...queries) {
  return {
    ready: queries.every((q) => q.data !== undefined),
    error: queries.find((q) => q.error && q.data === undefined)?.error || null,
    reload: () => Promise.all(queries.map((q) => q.reload()))
  };
}
