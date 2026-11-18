import { readFileSync } from 'node:fs';

export const DEMO_DRUGS = JSON.parse(readFileSync(new URL('./drugs.json', import.meta.url), 'utf8'));

function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

const CATALOG_BY_ID = new Map(DEMO_DRUGS.map((drug) => [drug.id, drug]));
const SERIALIZED_ALL = DEMO_DRUGS.map((drug) => [drug.id, JSON.stringify(drug)]);
const SERIALIZED_FIXTURES = SERIALIZED_ALL.slice(0, 21);

const SEARCH_INDEX = [...DEMO_DRUGS]
  .sort((a, b) => (a.brandName ?? '').localeCompare(b.brandName ?? '', 'vi'))
  .map((drug) => ({
    drug,
    brand: normalizeSearch(drug.brandName),
    ingredients: (drug.activeIngredients ?? []).map((item) => normalizeSearch(item.name)).join(' '),
  }));

export function getCatalogDrug(ctx, id) {
  return ctx.db.get('drugs', id) ?? CATALOG_BY_ID.get(id);
}

export function searchCatalogDrugs(ctx, queryText, limit = 10) {
  const term = normalizeSearch(queryText);
  const buckets = [[], [], [], []];
  for (let i = 0; i < SEARCH_INDEX.length; i += 1) {
    const entry = SEARCH_INDEX[i];
    const score = entry.brand === term ? 0
      : entry.brand.startsWith(term) ? 1
      : entry.brand.includes(term) ? 2
      : entry.ingredients.includes(term) ? 3
      : 4;
    if (score < 4) buckets[score].push(entry.drug);
  }
  const results = [];
  for (const bucket of buckets) {
    for (const drug of bucket) {
      results.push(drug);
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export function seedCatalog(ctx, ephemeral = false) {
  const pairs = ephemeral ? SERIALIZED_FIXTURES : SERIALIZED_ALL;
  const added = ctx.db.seedDrugs ? ctx.db.seedDrugs(pairs) : 0;
  if (added > 0) {
    ctx.audit({
      actionType: 'DEMO_CATALOG_SEEDED',
      targetType: 'Drug',
      targetId: DEMO_DRUGS[0]?.id ?? null,
      detail: `Đã nạp ${pairs.length} thuốc vào danh mục`,
    });
  }
}
