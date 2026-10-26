// Bộ nhớ đệm thông tin thuốc đã tra từ danh mục (GET /drugs, GET /drugs/{id}) để hiển thị
// hoạt chất và kiểm tra trùng hoạt chất ngay khi nhập đơn (FR-05, FR-08).

import { useEffect, useReducer } from 'react';
import { request } from './http.js';

const cache = new Map();
const pending = new Map();
const listeners = new Set();

export function rememberDrugs(list) {
  let changed = false;
  for (const drug of list || []) {
    if (drug?.id && !cache.has(drug.id)) {
      cache.set(drug.id, drug);
      changed = true;
    }
  }
  if (changed) listeners.forEach((fn) => fn());
}

export function cachedDrug(drugId) {
  return (drugId && cache.get(drugId)) || null;
}

export function cachedDrugs() {
  return [...cache.values()];
}

function load(drugId) {
  if (cache.has(drugId) || pending.has(drugId)) return;
  pending.set(
    drugId,
    request(`/drugs/${drugId}`)
      .then((drug) => rememberDrugs([drug]))
      .catch(() => {})
      .finally(() => pending.delete(drugId))
  );
}

/** Đảm bảo đã có thông tin các thuốc được liên kết; render lại khi tải xong. */
export function useDrugInfo(drugIds) {
  const [, force] = useReducer((x) => x + 1, 0);
  const key = [...new Set((drugIds || []).filter(Boolean))].sort().join(',');
  useEffect(() => {
    listeners.add(force);
    if (key) key.split(',').forEach(load);
    return () => listeners.delete(force);
  }, [key]);
  return cachedDrugs();
}

export function ingredientText(drug) {
  if (!drug) return '';
  return (drug.activeIngredients || []).map((i) => `${i.name} ${i.strength}`.trim()).join(' + ');
}
