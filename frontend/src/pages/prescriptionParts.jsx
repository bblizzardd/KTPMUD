import { Check } from 'lucide-react';
import { SLOT_META, SLOTS } from '../domain/constants.js';
import { ingredientText, useDrugInfo } from '../api/drugs.js';
import { resolveItemDrug } from '../domain/rules.js';
import { fmtNumber } from '../lib/text.js';
import { Badge } from '../components/ui.jsx';

/** Bảng dòng thuốc: tên gốc trên đơn (BR-04), liên kết danh mục, liều, buổi, ghi chú. */
export function RxItemsTable({ items, highlight = [] }) {
  const drugs = useDrugInfo(items.map((i) => i.drugId));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Thuốc (tên trên đơn)</th>
            <th>Hoạt chất</th>
            <th>Mỗi lần</th>
            <th>Buổi uống</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const { source, drug } = resolveItemDrug(item, drugs);
            return (
              <tr key={item.id || i} className={highlight.includes(i) ? 'row-warn' : ''}>
                <td>
                  <strong>{item.drugNameRaw}</strong>
                  {source === 'UNLINKED' && (
                    <div style={{ marginTop: 4 }}>
                      <Badge tone="neutral">Tên tự do</Badge>
                    </div>
                  )}
                </td>
                <td className="text-sm">
                  {drug ? ingredientText(drug) : <span className="muted">{source === 'LINKED_LOADING' ? 'Đang tải…' : 'Chưa liên kết danh mục'}</span>}
                </td>
                <td className="nowrap">
                  {fmtNumber(item.unitsPerDose)} {item.unit || 'viên'}
                </td>
                <td>
                  <span className="slot-dots">
                    {SLOTS.map((s) => (
                      <span key={s} className={item.slots.includes(s) ? 'on' : ''} title={SLOT_META[s].long}>
                        {item.slots.includes(s) && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                        {SLOT_META[s].label}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="text-sm">{item.instruction || <span className="faint">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STEPS = [
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'ACTIVE', label: 'Hiệu lực' },
  { key: 'END', label: 'Hết hạn / Bị thay thế' }
];

/** Vòng đời đơn thuốc theo biểu đồ trạng thái (Hình 5). */
export function RxLifecycle({ status }) {
  if (status === 'CANCELLED') {
    return (
      <ol className="lifecycle" aria-label="Vòng đời đơn thuốc">
        <li className="is-past">Nháp</li>
        <li className="is-current is-cancelled">Đã hủy</li>
      </ol>
    );
  }
  const index = status === 'DRAFT' ? 0 : status === 'ACTIVE' ? 1 : 2;
  return (
    <ol className="lifecycle" aria-label="Vòng đời đơn thuốc">
      {STEPS.map((s, i) => (
        <li key={s.key} className={i < index ? 'is-past' : i === index ? 'is-current' : ''} aria-current={i === index ? 'step' : undefined}>
          {i === 2 && index === 2 ? (status === 'EXPIRED' ? 'Hết hạn' : 'Bị thay thế') : s.label}
        </li>
      ))}
    </ol>
  );
}
