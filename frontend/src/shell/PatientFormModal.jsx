import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { useApp } from '../app/AppContext.jsx';
import { Callout, Field, Modal, Spinner } from '../components/ui.jsx';
import { fieldError } from '../api/errors.js';
import { DEFAULT_MISSED_THRESHOLD, DEFAULT_REMINDER_TIMES, SLOTS, SLOT_META } from '../domain/constants.js';
import { validatePatientInput } from '../domain/rules.js';

const toMap = (list) => Object.fromEntries(SLOTS.map((s) => [s, list?.find((r) => r.slot === s)?.time || SLOT_META[s].defaultTime]));

/** UC-02: tạo / sửa hồ sơ bệnh nhân chỉ với tên gọi và năm sinh (BR-07, NFR-05). */
export default function PatientFormModal({ open, mode = 'create', patient, onClose, onSaved }) {
  const { call, toast, selectPatient } = useApp();
  const [busy, setBusy] = useState(false);
  const [alias, setAlias] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [times, setTimes] = useState(toMap(DEFAULT_REMINDER_TIMES));
  const [threshold, setThreshold] = useState(DEFAULT_MISSED_THRESHOLD);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && patient) {
      setAlias(patient.alias);
      setBirthYear(String(patient.birthYear));
      setTimes(toMap(patient.reminderTimes));
      setThreshold(patient.missedThresholdMinutes);
    } else {
      setAlias('');
      setBirthYear('');
      setTimes(toMap(DEFAULT_REMINDER_TIMES));
      setThreshold(DEFAULT_MISSED_THRESHOLD);
    }
    // Chỉ khởi tạo khi mở form/đổi hồ sơ, không reset khi dữ liệu nền thay đổi lúc đang nhập.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, patient?.id]);

  const reminderTimes = SLOTS.map((slot) => ({ slot, time: times[slot] }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const body =
      mode === 'create'
        ? { alias: alias.trim(), birthYear: Number(birthYear), reminderTimes }
        : { alias: alias.trim(), reminderTimes, missedThresholdMinutes: Number(threshold) };
    const problems = validatePatientInput(body, { partial: mode === 'edit' });
    if (problems.length) {
      setError({ message: problems[0].issue, details: problems });
      return;
    }
    setBusy(true);
    const res = await call(() => (mode === 'create' ? api.createPatient(body) : api.updatePatient(patient.id, body)), {
      silent: true,
      refresh: ['patients', ...(patient ? [`p:${patient.id}:`] : [])]
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (mode === 'create') {
      selectPatient(res.result.id);
      toast({ title: `Đã tạo hồ sơ "${res.result.alias}"`, message: 'Bước tiếp theo: ghép điện thoại và nhập đơn thuốc.' });
    } else {
      toast({ title: 'Đã lưu hồ sơ' });
    }
    onSaved?.(res.result);
    onClose();
  }

  const timeError = [...SLOTS.map((s) => fieldError(error, `reminderTimes.${s}`)), fieldError(error, 'reminderTimes')].find(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Thêm hồ sơ người thân' : `Sửa hồ sơ · ${patient?.alias}`}
      subtitle={mode === 'create' ? 'Mỗi hồ sơ là một người bệnh bạn chăm sóc (BR-01).' : 'Giờ nhắc mới áp dụng cho đơn thuốc được xác nhận sau khi lưu.'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="patient-form" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />} {mode === 'create' ? 'Tạo hồ sơ' : 'Lưu thay đổi'}
          </button>
        </>
      }
    >
      <form id="patient-form" className="stack" onSubmit={submit} noValidate>
        <Callout tone="neutral" icon={ShieldCheck}>
          Chỉ nhập tên gọi trong gia đình (ví dụ “Bố”, “Mẹ”) và năm sinh. Không nhập họ tên thật, số CCCD hay số thẻ BHYT.
        </Callout>
        {error && !error.details?.length && <Callout tone="danger">{error.message}</Callout>}
        <div className="form-grid">
          <Field label="Tên gọi trong gia đình" required htmlFor="pf-alias" error={fieldError(error, 'alias')} hint="Tối đa 50 ký tự">
            <input id="pf-alias" className="input" value={alias} maxLength={50} onChange={(e) => setAlias(e.target.value)} placeholder="Ví dụ: Bố" aria-invalid={Boolean(fieldError(error, 'alias'))} data-autofocus />
          </Field>
          <Field
            label="Năm sinh"
            required={mode === 'create'}
            htmlFor="pf-year"
            error={fieldError(error, 'birthYear')}
            hint={mode === 'edit' ? 'Không đổi được sau khi tạo hồ sơ' : 'Từ 1920 đến 2010'}
          >
            <input
              id="pf-year"
              className="input"
              type="number"
              inputMode="numeric"
              min={1920}
              max={2010}
              value={birthYear}
              readOnly={mode === 'edit'}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="Ví dụ: 1954"
              aria-invalid={Boolean(fieldError(error, 'birthYear'))}
            />
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend className="field-label">Giờ nhắc theo buổi</legend>
          <div className="grid-4">
            {SLOTS.map((slot) => (
              <Field key={slot} label={SLOT_META[slot].long} htmlFor={`pf-${slot}`}>
                <input id={`pf-${slot}`} className="input" type="time" value={times[slot]} onChange={(e) => setTimes((t) => ({ ...t, [slot]: e.target.value }))} required />
              </Field>
            ))}
          </div>
          {timeError ? <span className="field-error">{timeError}</span> : <span className="field-hint">Đơn thuốc chỉ dùng những buổi có thuốc; giờ các buổi phải tăng dần trong ngày.</span>}
        </fieldset>

        {mode === 'edit' && (
          <Field
            label="Ngưỡng chuyển sang Bỏ lỡ (phút)"
            htmlFor="pf-threshold"
            error={fieldError(error, 'missedThresholdMinutes')}
            hint="Từ 15 đến 360 phút. 120 phút hiện chỉ là giả định kiểm thử, cần ý kiến bác sĩ (TD-01)."
          >
            <input id="pf-threshold" className="input" type="number" min={15} max={360} step={5} value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ maxWidth: 160 }} />
          </Field>
        )}
      </form>
    </Modal>
  );
}
