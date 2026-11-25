import { useEffect, useState } from 'react';
import * as api from '../api/caregiver.js';
import { useApp } from '../app/AppContext.jsx';
import { Callout, Field, Modal, SlotTimeField, Spinner } from '../components/ui.jsx';
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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && patient) {
      setAlias(patient.alias);
      setBirthYear(String(patient.birthYear));
      setTimes(toMap(patient.reminderTimes));
    } else {
      setAlias('');
      setBirthYear('');
      setTimes(toMap(DEFAULT_REMINDER_TIMES));
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
        : { alias: alias.trim(), birthYear: Number(birthYear), reminderTimes, missedThresholdMinutes: DEFAULT_MISSED_THRESHOLD };
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

  const timeError = fieldError(error, 'reminderTimes');

  return (
    <Modal
      open={open}
      busy={busy}
      onClose={onClose}
      title={mode === 'create' ? 'Thêm hồ sơ người thân' : `Sửa hồ sơ · ${patient?.alias}`}
      subtitle={mode === 'edit' ? 'Giờ nhắc mới áp dụng cho các đơn xác nhận sau khi lưu.' : undefined}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" form="patient-form" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />} {mode === 'create' ? 'Tạo hồ sơ' : 'Lưu thay đổi'}
          </button>
        </>
      }
    >
      <form id="patient-form" className="stack" onSubmit={submit} noValidate>
        {error && !error.details?.length && <Callout tone="danger">{error.message}</Callout>}
        <div className="form-grid">
          <Field label="Tên gọi trong gia đình" required htmlFor="pf-alias" error={fieldError(error, 'alias')}>
            <input id="pf-alias" className="input" value={alias} maxLength={50} onChange={(e) => setAlias(e.target.value)} placeholder="Ví dụ: Bố" aria-invalid={Boolean(fieldError(error, 'alias'))} data-autofocus />
          </Field>
          <Field
            label="Năm sinh"
            required
            htmlFor="pf-year"
            error={fieldError(error, 'birthYear')}
            hint="Từ 1920 đến 2010"
          >
            <input
              id="pf-year"
              className="input"
              type="number"
              inputMode="numeric"
              min={1920}
              max={2010}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="Ví dụ: 1954"
              aria-invalid={Boolean(fieldError(error, 'birthYear'))}
            />
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend className="field-label">Giờ nhắc theo buổi</legend>
          <div className="grid-4">
            {SLOTS.map((slot, i) => (
              <SlotTimeField key={slot} id={`pf-${slot}`} label={SLOT_META[slot].long} slot={slot} value={times[slot]}
                onChange={time => { setError(null); setTimes(t => ({ ...t, [slot]: time })); }}
                error={fieldError(error, `reminderTimes.${slot}`) || fieldError(error, `reminderTimes[${i}].time`)} />
            ))}
          </div>
          {timeError && <span className="field-error">{timeError}</span>}
        </fieldset>

      </form>
    </Modal>
  );
}
