import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, History, Plus, Trash2 } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { useDrugInfo } from '../api/drugs.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { useQuery } from '../app/query.js';
import { href, navigate, ROUTES } from '../app/router.js';
import { DOSE_UNITS, SLOTS, SLOT_META } from '../domain/constants.js';
import { detectDuplicateIngredients, reminderTimeOf, validatePrescriptionInput } from '../domain/rules.js';
import { addDays, fmtDateTime, toDateKey } from '../lib/time.js';
import { Callout, Card, Field, PageHeader, PageStatus, Spinner } from '../components/ui.jsx';
import DrugAutocomplete from '../components/DrugAutocomplete.jsx';

let tmpSeq = 0;
const newItem = () => ({ id: `tmp-${Date.now().toString(36)}-${++tmpSeq}`, drugId: null, drugNameRaw: '', unitsPerDose: 1, unit: 'viên', slots: [], instruction: '' });

function storageKey(patientId, rxId) {
  return `antam.v1.rxForm.${patientId}.${rxId || 'new'}`;
}

function readAutosave(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function initialForm(existing, today) {
  if (existing) {
    return {
      issuedDate: existing.issuedDate,
      startDate: existing.startDate,
      nextVisitDate: existing.nextVisitDate,
      sourceNote: existing.sourceNote || '',
      items: existing.items.map((i) => ({ ...newItem(), ...i, unit: i.unit || 'viên', instruction: i.instruction || '', slots: [...i.slots] }))
    };
  }
  return { issuedDate: today, startDate: today, nextVisitDate: '', sourceNote: 'Hệ thống số hóa BV Hữu Nghị', items: [newItem()] };
}

export default function PrescriptionEditorPage({ prescriptionId }) {
  const { patient } = useApp();
  const rxQ = useQuery(prescriptionId ? patientKey(patient.id, `rx:${prescriptionId}`) : null, () => api.getPrescription(prescriptionId));
  if (prescriptionId && !rxQ.data) {
    if (rxQ.error?.status === 404 || rxQ.error?.status === 403) return <Editor prescriptionId={prescriptionId} loadError={rxQ.error} />;
    return <PageStatus error={rxQ.error} onRetry={rxQ.reload} />;
  }
  return <Editor key={prescriptionId || 'new'} prescriptionId={prescriptionId} existing={rxQ.data || null} />;
}

function Editor({ prescriptionId, existing = null, loadError = null }) {
  const { patient, call, toast } = useApp();
  const nowMs = useNow(60_000);
  const today = toDateKey(nowMs);
  const [busy, setBusy] = useState(false);
  const key = storageKey(patient.id, prescriptionId);
  const saved = useMemo(() => readAutosave(key), [key]);
  const [form, setForm] = useState(() => (saved?.form ? saved.form : initialForm(existing, today)));
  const [restored, setRestored] = useState(Boolean(saved?.form));
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);
  const firstError = useRef(null);
  const dirty = useRef(Boolean(saved?.form));
  const editable = !loadError && (!existing || (existing.status === 'DRAFT' && existing.patientId === patient.id));
  const drugs = useDrugInfo(form.items.map((i) => i.drugId));

  // E1: dữ liệu đang nhập được giữ lại trên máy nếu mất kết nối hoặc đóng trang
  useEffect(() => {
    if (!editable || !dirty.current) return undefined;
    const id = setTimeout(() => {
      if (!dirty.current) return; // vừa lưu lên máy chủ hoặc vừa bỏ bản nhập dở
      try {
        localStorage.setItem(key, JSON.stringify({ form, savedAt: new Date().toISOString() }));
      } catch {
        // bỏ qua
      }
    }, 400);
    return () => clearTimeout(id);
  }, [form, key, editable]);

  if (loadError || (existing && existing.patientId !== patient.id)) {
    return (
      <Callout tone="warning" title="Không mở được đơn thuốc này" actions={<a className="btn btn-sm btn-secondary" href={href(ROUTES.prescriptions)}>Về danh sách đơn</a>}>
        {loadError?.message || 'Đơn này thuộc hồ sơ khác.'}
      </Callout>
    );
  }
  if (existing && existing.status !== 'DRAFT') {
    return (
      <Callout tone="warning" title="Chỉ sửa được đơn ở trạng thái Nháp (FR-06)" actions={<a className="btn btn-sm btn-secondary" href={href(`${ROUTES.prescriptions}/${existing.id}`)}>Xem đơn</a>}>
        Đơn đang dùng không sửa trực tiếp. Muốn đổi thuốc, hãy thêm đơn mới; khi xác nhận, đơn cũ chuyển sang Bị thay thế.
      </Callout>
    );
  }

  const clientErrors = submitted ? validatePrescriptionInput(form, { today }) : [];
  const errors = serverError?.details?.length ? serverError.details : clientErrors;
  const err = (field) => errors.find((e) => e.field === field)?.issue || '';
  const duplicates = detectDuplicateIngredients(form.items, drugs);
  const flagged = duplicates.flatMap((d) => d.itemIndexes);

  const set = (patch) => {
    dirty.current = true;
    setServerError(null);
    setForm((f) => ({ ...f, ...patch }));
  };
  const setItem = (index, patch) => {
    dirty.current = true;
    setServerError(null);
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  };
  const toggleSlot = (index, slot) => {
    const item = form.items[index];
    setItem(index, { slots: item.slots.includes(slot) ? item.slots.filter((s) => s !== slot) : SLOTS.filter((s) => s === slot || item.slots.includes(s)) });
  };

  function discardAutosave() {
    try {
      localStorage.removeItem(key);
    } catch {
      // bỏ qua
    }
    dirty.current = false;
    setForm(initialForm(existing, today));
    setRestored(false);
    setSubmitted(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const problems = validatePrescriptionInput(form, { today });
    if (problems.length) {
      setTimeout(() => firstError.current?.querySelector('[aria-invalid="true"], .field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return;
    }
    setBusy(true);
    const res = await call(() => (existing ? api.updatePrescription(existing.id, form) : api.createPrescription(patient.id, form)), {
      silent: true,
      refresh: patientKey(patient.id, 'rx')
    });
    setBusy(false);
    if (!res.ok) {
      setServerError(res.error);
      if (!res.error.details?.length) toast({ tone: 'warning', title: 'Chưa lưu được đơn', message: res.error.message });
      return;
    }
    dirty.current = false;
    try {
      localStorage.removeItem(key);
    } catch {
      // bỏ qua
    }
    toast({ title: 'Đã lưu đơn nháp', message: 'Hãy xem lại toàn bộ đơn rồi bấm "Xác nhận đơn" để sinh lịch nhắc.' });
    navigate(`${ROUTES.prescriptions}/${res.result.id}`);
  }

  const backTo = existing ? `${ROUTES.prescriptions}/${existing.id}` : ROUTES.prescriptions;

  return (
    <form onSubmit={submit} noValidate ref={firstError} className="stack editor">
      <PageHeader
        back={
          <a className="back-link" href={href(backTo)}>
            <ArrowLeft size={15} aria-hidden="true" /> {existing ? 'Quay lại đơn' : 'Đơn thuốc'}
          </a>
        }
        title={existing ? 'Sửa đơn nháp' : `Thêm đơn thuốc cho ${patient.alias}`}
        subtitle="Nhập đúng như đơn tra cứu trên hệ thống số hóa của bệnh viện. Đơn được lưu ở trạng thái Nháp; lịch nhắc chỉ sinh sau khi bạn xác nhận."
        req="UC-05 · FR-04 · FR-05 · BR-04"
      />

      {restored && (
        <Callout
          tone="info"
          icon={History}
          title="Đã khôi phục nội dung đang nhập dở"
          actions={
            <button type="button" className="btn btn-sm btn-secondary" onClick={discardAutosave}>
              Bỏ bản nhập dở
            </button>
          }
        >
          Nội dung được tự lưu trên máy này lúc {fmtDateTime(saved?.savedAt)}.
        </Callout>
      )}

      {serverError && !serverError.details?.length && <Callout tone="danger">{serverError.message}</Callout>}

      <Card title="Thông tin đơn" req="FR-04">
        <div className="form-grid">
          <Field label="Ngày kê đơn" required htmlFor="rx-issued" error={err('issuedDate')}>
            <input id="rx-issued" className="input" type="date" max={today} value={form.issuedDate} onChange={(e) => set({ issuedDate: e.target.value })} aria-invalid={Boolean(err('issuedDate'))} />
          </Field>
          <Field label="Ngày bắt đầu uống" required htmlFor="rx-start" error={err('startDate')}>
            <input id="rx-start" className="input" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} aria-invalid={Boolean(err('startDate'))} />
          </Field>
          <Field label="Ngày tái khám" required htmlFor="rx-next" error={err('nextVisitDate')} hint="Lịch nhắc sinh tới hết ngày này.">
            <input id="rx-next" className="input" type="date" min={form.startDate || undefined} value={form.nextVisitDate} onChange={(e) => set({ nextVisitDate: e.target.value })} aria-invalid={Boolean(err('nextVisitDate'))} />
            {form.startDate && (
              <span className="quick-dates">
                {[
                  ['+1 tháng', 30],
                  ['+2 tháng', 60],
                  ['+3 tháng', 90]
                ].map(([label, d]) => (
                  <button key={label} type="button" className="link-btn text-sm" onClick={() => set({ nextVisitDate: addDays(form.startDate, d) })}>
                    {label}
                  </button>
                ))}
              </span>
            )}
          </Field>
          <Field label="Nguồn tra cứu" htmlFor="rx-source" error={err('sourceNote')} hint="Không bắt buộc">
            <input id="rx-source" className="input" maxLength={200} value={form.sourceNote} onChange={(e) => set({ sourceNote: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card
        title={`Thuốc trong đơn (${form.items.length})`}
        subtitle="Gõ từ 2 ký tự để chọn từ danh mục; nếu không có, giữ đúng tên ghi trên đơn."
        req="FR-05 · FR-08"
      >
        <div className="stack">
          {duplicates.length > 0 && (
            <Callout tone="warning" icon={AlertTriangle} title="Có thuốc trùng hoạt chất">
              {duplicates.map((d) => (
                <p key={d.ingredient}>{d.message}</p>
              ))}
            </Callout>
          )}
          {err('items') && <Callout tone="danger">{err('items')}</Callout>}

          {form.items.map((item, i) => (
            <div key={item.id} className={`editor-item ${flagged.includes(i) ? 'is-flagged' : ''}`}>
              <div className="editor-item-head">
                <span className="editor-item-no">Thuốc {i + 1}</span>
                {flagged.includes(i) && <span className="badge tone-warning">Trùng hoạt chất</span>}
                <span className="spacer" />
                {form.items.length > 1 && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ items: form.items.filter((_, j) => j !== i) })} aria-label={`Xóa thuốc ${i + 1}`}>
                    <Trash2 size={15} aria-hidden="true" /> Xóa
                  </button>
                )}
              </div>
              <div className="editor-item-grid">
                <Field label="Tên thuốc" required htmlFor={`rx-drug-${i}`} className="span-2">
                  <DrugAutocomplete inputId={`rx-drug-${i}`} value={item} onChange={(patch) => setItem(i, patch)} error={err(`items[${i}].drugNameRaw`)} />
                </Field>
                <Field label="Mỗi lần uống" required htmlFor={`rx-units-${i}`} error={err(`items[${i}].unitsPerDose`)}>
                  <div className="input-group">
                    <input
                      id={`rx-units-${i}`}
                      className="input"
                      type="number"
                      inputMode="decimal"
                      min={0.25}
                      step={0.25}
                      value={item.unitsPerDose}
                      onChange={(e) => setItem(i, { unitsPerDose: e.target.value === '' ? '' : Number(e.target.value) })}
                      aria-invalid={Boolean(err(`items[${i}].unitsPerDose`))}
                    />
                    <select className="select" aria-label="Đơn vị" value={item.unit} onChange={(e) => setItem(i, { unit: e.target.value })}>
                      {DOSE_UNITS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Buổi uống" required error={err(`items[${i}].slots`)} className="span-2">
                  <div className="chips" role="group" aria-label={`Buổi uống của thuốc ${i + 1}`}>
                    {SLOTS.map((slot) => (
                      <button key={slot} type="button" className="chip" aria-pressed={item.slots.includes(slot)} onClick={() => toggleSlot(i, slot)}>
                        {SLOT_META[slot].label} <span className="chip-sub num">{reminderTimeOf(patient, slot)}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Ghi chú cách dùng" htmlFor={`rx-note-${i}`} error={err(`items[${i}].instruction`)}>
                  <input id={`rx-note-${i}`} className="input" maxLength={200} placeholder="Ví dụ: uống sau ăn" value={item.instruction} onChange={(e) => setItem(i, { instruction: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-secondary add-item" onClick={() => set({ items: [...form.items, newItem()] })}>
            <Plus size={16} aria-hidden="true" /> Thêm thuốc
          </button>
          <p className="fine-print">
            Giờ nhắc theo buổi lấy từ hồ sơ {patient.alias}; đổi trong mục Hồ sơ & thiết bị. Ứng dụng không gợi ý liều — chỉ ghi lại đúng chỉ định trên đơn.
          </p>
        </div>
      </Card>

      <div className="sticky-actions">
        {submitted && clientErrors.length > 0 && <span className="tone-text-danger text-sm">Còn {clientErrors.length} chỗ cần sửa.</span>}
        <span className="spacer" />
        <a className="btn btn-secondary" href={href(backTo)}>
          Hủy
        </a>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy && <Spinner />} Lưu nháp và xem lại
        </button>
      </div>
    </form>
  );
}
