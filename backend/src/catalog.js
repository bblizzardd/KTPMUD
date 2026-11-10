// Development fixtures, not an authoritative medication database.
export const DEMO_DRUGS = [
  { id: '10000000-0000-4000-8000-000000000001', brandName: 'Glucophage 500mg', activeIngredients: [{ name: 'metformin', strength: '500 mg' }], dosageForm: 'Viên nén' },
  { id: '10000000-0000-4000-8000-000000000002', brandName: 'Panfor SR 500mg', activeIngredients: [{ name: 'metformin', strength: '500 mg' }], dosageForm: 'Viên nén phóng thích kéo dài' },
  { id: '10000000-0000-4000-8000-000000000003', brandName: 'Diamicron MR 30mg', activeIngredients: [{ name: 'gliclazide', strength: '30 mg' }], dosageForm: 'Viên nén giải phóng có kiểm soát' },
  { id: '10000000-0000-4000-8000-000000000004', brandName: 'Jardiance 10mg', activeIngredients: [{ name: 'empagliflozin', strength: '10 mg' }], dosageForm: 'Viên nén' },
  { id: '10000000-0000-4000-8000-000000000005', brandName: 'Janumet 50mg/500mg', activeIngredients: [{ name: 'sitagliptin', strength: '50 mg' }, { name: 'metformin', strength: '500 mg' }], dosageForm: 'Viên nén phối hợp' },
  // Illustrative entries used by the web app demo (autocomplete, duplicate-ingredient checks).
  ...[
    ['0002', 'Glucophage 850mg', [['metformin', '850 mg']], 'Viên nén bao phim'],
    ['0003', 'Glucophage XR 750mg', [['metformin', '750 mg']], 'Viên giải phóng kéo dài'],
    ['0005', 'Panfor SR 1000mg', [['metformin', '1000 mg']], 'Viên giải phóng kéo dài'],
    ['0006', 'Metformin 500mg', [['metformin', '500 mg']], 'Viên nén'],
    ['0008', 'Diamicron MR 60mg', [['gliclazide', '60 mg']], 'Viên giải phóng có kiểm soát'],
    ['0009', 'Amaryl 2mg', [['glimepiride', '2 mg']], 'Viên nén'],
    ['0010', 'Januvia 50mg', [['sitagliptin', '50 mg']], 'Viên nén bao phim'],
    ['0011', 'Januvia 100mg', [['sitagliptin', '100 mg']], 'Viên nén bao phim'],
    ['0012', 'Janumet 50mg/850mg', [['sitagliptin', '50 mg'], ['metformin', '850 mg']], 'Viên nén bao phim'],
    ['0013', 'Galvus 50mg', [['vildagliptin', '50 mg']], 'Viên nén'],
    ['0014', 'Galvus Met 50mg/850mg', [['vildagliptin', '50 mg'], ['metformin', '850 mg']], 'Viên nén bao phim'],
    ['0016', 'Forxiga 10mg', [['dapagliflozin', '10 mg']], 'Viên nén bao phim'],
    ['0017', 'Coversyl 5mg', [['perindopril', '5 mg']], 'Viên nén bao phim'],
    ['0018', 'Amlor 5mg', [['amlodipine', '5 mg']], 'Viên nang'],
    ['0019', 'Crestor 10mg', [['rosuvastatin', '10 mg']], 'Viên nén bao phim'],
    ['0020', 'Lipitor 20mg', [['atorvastatin', '20 mg']], 'Viên nén bao phim'],
  ].map(([n, brandName, ingredients, dosageForm]) => ({
    id: `6f1c2a10-${n}-4a01-9a01-00000000${n.padStart(4, '0')}`,
    brandName, activeIngredients: ingredients.map(([name, strength]) => ({ name, strength })), dosageForm,
  })),
];

export function seedCatalog(ctx) {
  ctx.db.transaction(() => {
    for (const drug of DEMO_DRUGS) {
      if (!ctx.db.get('drugs', drug.id)) {
        ctx.db.insert('drugs', { ...drug, demo: true, registrationNo: '' });
        ctx.audit({ actionType: 'DEMO_CATALOG_SEEDED', targetType: 'Drug', targetId: drug.id });
      }
    }
  });
}
