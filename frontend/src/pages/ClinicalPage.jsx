import { useEffect, useState } from 'react';
import { Activity, BellRing, CalendarCheck, CalendarClock, CalendarPlus, Plus } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { fieldError } from '../api/errors.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow, usePref } from '../app/hooks.js';
import { combine, useQuery } from '../app/query.js';
import { APPOINTMENT_STATUS, LAB_TYPES } from '../domain/constants.js';
import { addDays, diffDays, fmtDate, fmtDateTime, isValidDateKey, toDateKey, weekdayOf } from '../lib/time.js';
import { fmtNumber } from '../lib/text.js';
import { Badge, Callout, Card, EmptyState, Field, Modal, PageHeader, PageStatus, Segmented, Spinner } from '../components/ui.jsx';
import { TrendChart } from '../components/charts.jsx';

const CHART_TYPES = ['HBA1C', 'FASTING_GLUCOSE', 'POSTPRANDIAL_GLUCOSE'];

function labProblems(form, today) {
  const details = [];
  const value = Number(String(form.value).replace(',', '.'));
  if (form.value === '' || !Number.isFinite(value)) details.push({ field: 'value', issue: 'Nhập giá trị bằng số.' });
  else if (value < 0) details.push({ field: 'value', issue: 'Giá trị không được âm.' });
  if (!isValidDateKey(form.testedDate)) details.push({ field: 'testedDate', issue: 'Chọn ngày xét nghiệm.' });
  else if (form.testedDate > today) details.push({ field: 'testedDate', issue: 'Ngày xét nghiệm không được ở tương lai.' });
  if (!String(form.unit).trim()) details.push({ field: 'unit', issue: 'Nhập đơn vị.' });
  if (form.testType === 'OTHER' && !String(form.note).trim()) details.push({ field: 'note', issue: 'Ghi rõ tên chỉ số trong ghi chú.' });
  return details;
}

function LabModal({ open, onClose }) {
  const { patient, call, toast } = useApp();
  const today = toDateKey(useNow(60_000));
  const [form, setForm] = useState({ testType: 'HBA1C', value: '', unit: '%', testedDate: today, note: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ testType: 'HBA1C', value: '', unit: '%', testedDate: today, note: '' });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const problems = labProblems(form, today);
    if (problems.length) {
      setError({ message: problems[0].issue, details: problems });
      return;
    }
    setBusy(true);
    const body = { testType: form.testType, value: Number(String(form.value).replace(',', '.')), unit: form.unit.trim(), testedDate: form.testedDate, note: form.note.trim() };
    const res = await call(() => api.createLabResult(patient.id, body), { silent: true, refresh: patientKey(patient.id, 'labs') });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ title: 'Đã lưu chỉ số', message: `${LAB_TYPES[res.result.testType].label}: ${fmtNumber(res.result.value)} ${res.result.unit}` });
    onClose();
  }

  const fe = (f) => fieldError(error, f);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ghi chỉ số xét nghiệm"
      subtitle="Nhập theo phiếu kết quả sau mỗi đợt khám hoặc lần đo tại nhà."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="lab-form" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />} Lưu chỉ số
          </button>
        </>
      }
    >
      <form id="lab-form" className="stack" onSubmit={submit} noValidate>
        {error && !error.details?.length && <Callout tone="danger">{error.message}</Callout>}
        <div className="form-grid">
          <Field label="Loại xét nghiệm" required htmlFor="lab-type" error={fe('testType')}>
            <select
              id="lab-type"
              className="select"
              value={form.testType}
              onChange={(e) => setForm((f) => ({ ...f, testType: e.target.value, unit: LAB_TYPES[e.target.value].unit || f.unit }))}
            >
              {Object.entries(LAB_TYPES).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.long}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ngày xét nghiệm" required htmlFor="lab-date" error={fe('testedDate')}>
            <input id="lab-date" className="input" type="date" max={today} value={form.testedDate} onChange={(e) => setForm((f) => ({ ...f, testedDate: e.target.value }))} />
          </Field>
          <Field label="Giá trị" required htmlFor="lab-value" error={fe('value')}>
            <input id="lab-value" className="input" type="number" inputMode="decimal" step={LAB_TYPES[form.testType].step} min={0} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} aria-invalid={Boolean(fe('value'))} data-autofocus />
          </Field>
          <Field label="Đơn vị" required htmlFor="lab-unit" error={fe('unit')}>
            <input id="lab-unit" className="input" value={form.unit} maxLength={20} readOnly={form.testType !== 'OTHER'} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          </Field>
        </div>
        <Field label="Ghi chú" htmlFor="lab-note" error={fe('note')} hint={form.testType === 'OTHER' ? 'Bắt buộc: ghi tên chỉ số, ví dụ "Cholesterol toàn phần".' : 'Ví dụ: lấy máu lúc đói tại BV Hữu Nghị'}>
          <input id="lab-note" className="input" maxLength={200} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

function AppointmentModal({ open, onClose, appointments }) {
  const { patient, call, toast } = useApp();
  const today = toDateKey(useNow(60_000));
  const [form, setForm] = useState({ visitDate: '', remindDaysBefore: 2, note: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ visitDate: '', remindDaysBefore: 2, note: '' });
      setError(null);
    }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const details = [];
    const remind = Number(form.remindDaysBefore);
    if (!isValidDateKey(form.visitDate)) details.push({ field: 'visitDate', issue: 'Chọn ngày tái khám.' });
    else if (form.visitDate < today) details.push({ field: 'visitDate', issue: 'Ngày tái khám không được ở quá khứ.' });
    else if (appointments.some((a) => a.visitDate === form.visitDate && a.status === 'UPCOMING')) details.push({ field: 'visitDate', issue: 'Đã có lịch hẹn vào ngày này.' });
    if (form.remindDaysBefore === '' || !Number.isInteger(remind) || remind < 0 || remind > 14) details.push({ field: 'remindDaysBefore', issue: 'Số ngày nhắc trước từ 0 đến 14.' });
    if (details.length) {
      setError({ message: details[0].issue, details });
      return;
    }
    setBusy(true);
    const res = await call(() => api.createAppointment(patient.id, { visitDate: form.visitDate, remindDaysBefore: remind, note: form.note.trim() }), {
      silent: true,
      refresh: patientKey(patient.id)
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ title: 'Đã thêm lịch tái khám', message: `${fmtDate(res.result.visitDate)}, nhắc trước ${res.result.remindDaysBefore} ngày.` });
    onClose();
  }

  const fe = (f) => fieldError(error, f);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm lịch tái khám"
      subtitle="Hệ thống nhắc bạn trước ngày hẹn để kịp sắp xếp đưa người thân đi khám (US-16)."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="appt-form" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />} Lưu lịch hẹn
          </button>
        </>
      }
    >
      <form id="appt-form" className="stack" onSubmit={submit} noValidate>
        {error && !error.details?.length && <Callout tone="danger">{error.message}</Callout>}
        <div className="form-grid">
          <Field label="Ngày tái khám" required htmlFor="appt-date" error={fe('visitDate')}>
            <input id="appt-date" className="input" type="date" min={today} value={form.visitDate} onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))} aria-invalid={Boolean(fe('visitDate'))} data-autofocus />
          </Field>
          <Field label="Nhắc trước (ngày)" required htmlFor="appt-remind" error={fe('remindDaysBefore')} hint="Từ 0 đến 14 ngày">
            <input id="appt-remind" className="input" type="number" min={0} max={14} value={form.remindDaysBefore} onChange={(e) => setForm((f) => ({ ...f, remindDaysBefore: e.target.value }))} />
          </Field>
        </div>
        <Field label="Ghi chú chuẩn bị" htmlFor="appt-note" error={fe('note')} hint="Ví dụ: nhịn ăn sáng để lấy máu; mang báo cáo 30 ngày">
          <input id="appt-note" className="input" maxLength={200} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Field>
      </form>
    </Modal>
  );
}

export default function ClinicalPage() {
  const { patient, call } = useApp();
  const nowMs = useNow(60_000);
  const today = toDateKey(nowMs);
  const [chartType, setChartType] = usePref('antam.v1.labChart', 'HBA1C');
  const [labOpen, setLabOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const labsQ = useQuery(patientKey(patient.id, 'labs'), () => api.listLabResults(patient.id));
  const apptQ = useQuery(patientKey(patient.id, 'appointments'), () => api.listAppointments(patient.id));
  const alertsQ = useQuery(patientKey(patient.id, 'alerts'), () => api.listAlerts(patient.id));
  const state = combine(labsQ, apptQ, alertsQ);

  if (!state.ready) {
    return (
      <>
        <PageHeader title="Chỉ số & tái khám" />
        <PageStatus error={state.error} onRetry={state.reload} />
      </>
    );
  }

  const labs = labsQ.data;
  const points = labs
    .filter((l) => l.testType === chartType)
    .map((l) => ({ date: l.testedDate, value: l.value }))
    .reverse();
  const latest = labs.filter((l) => l.testType === chartType);
  const delta = latest.length > 1 ? latest[0].value - latest[1].value : null;
  const appointments = apptQ.data;
  const upcoming = appointments.filter((a) => a.status === 'UPCOMING' && a.visitDate >= today).sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  const past = appointments.filter((a) => !upcoming.includes(a)).sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const reminded = (appt) => alertsQ.data.find((a) => a.type === 'VISIT_UPCOMING' && a.relatedAppointmentId === appt.id);
  const markDone = (appt) =>
    call(() => api.updateAppointmentStatus(appt.id, 'DONE'), { success: `Đã ghi nhận đi khám ngày ${fmtDate(appt.visitDate)}`, refresh: patientKey(patient.id, 'appointments') });

  return (
    <>
      <PageHeader
        title="Chỉ số & tái khám"
        subtitle={`Theo dõi xu hướng HbA1c, đường huyết của ${patient.alias} qua các đợt khám và lịch hẹn tái khám.`}
        req="UC-11 · UC-12 · FR-16 · FR-17"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setApptOpen(true)}>
              <CalendarPlus size={16} aria-hidden="true" /> Thêm lịch tái khám
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setLabOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Ghi chỉ số
            </button>
          </>
        }
      />

      <div className="clinical-grid">
        <Card
          title="Xu hướng"
          subtitle={latest.length ? `Gần nhất: ${fmtNumber(latest[0].value)} ${latest[0].unit} ngày ${fmtDate(latest[0].testedDate)}${delta !== null ? ` · ${delta > 0 ? 'tăng' : delta < 0 ? 'giảm' : 'không đổi'} ${fmtNumber(Math.abs(Math.round(delta * 10) / 10))} so với lần trước` : ''}` : undefined}
          req="US-15"
          actions={<Segmented ariaLabel="Loại chỉ số" value={chartType} onChange={setChartType} options={CHART_TYPES.map((t) => ({ value: t, label: LAB_TYPES[t].label }))} />}
        >
          {points.length ? (
            <TrendChart points={points} unit={LAB_TYPES[chartType].unit} />
          ) : (
            <EmptyState icon={Activity} title={`Chưa có kết quả ${LAB_TYPES[chartType].label}`}>
              Ghi chỉ số sau mỗi đợt khám để thấy xu hướng.
            </EmptyState>
          )}
          <p className="fine-print">Ứng dụng chỉ hiển thị số liệu và xu hướng; mục tiêu điều trị do bác sĩ quyết định cho từng người bệnh.</p>
        </Card>

        <Card title="Lịch tái khám" req="FR-17 · US-16">
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Chưa có lịch hẹn sắp tới" action={<button type="button" className="btn btn-sm btn-secondary" onClick={() => setApptOpen(true)}>Thêm lịch</button>} />
          ) : (
            <ul className="appt-list">
              {upcoming.map((a) => {
                const left = diffDays(today, a.visitDate);
                const alert = reminded(a);
                return (
                  <li key={a.id} className="appt">
                    <div className="appt-date">
                      <strong>{fmtDate(a.visitDate).slice(0, 5)}</strong>
                      <span>{weekdayOf(a.visitDate)}</span>
                    </div>
                    <div>
                      <div className="strong">{left === 0 ? 'Hôm nay' : `Còn ${left} ngày`}</div>
                      {a.note && <div className="text-sm">{a.note}</div>}
                      <div className="muted text-xs row-tight" style={{ marginTop: 4 }}>
                        <BellRing size={13} aria-hidden="true" />
                        {alert ? `Đã nhắc lúc ${fmtDateTime(alert.createdAt)}` : `Sẽ nhắc từ ngày ${fmtDate(addDays(a.visitDate, -a.remindDaysBefore))} (trước ${a.remindDaysBefore} ngày)`}
                      </div>
                    </div>
                    {left === 0 && (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => markDone(a)}>
                        <CalendarCheck size={15} aria-hidden="true" /> Đã đi khám
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {past.length > 0 && (
            <details className="past-appts">
              <summary>Lịch đã qua ({past.length})</summary>
              <ul>
                {past.map((a) => (
                  <li key={a.id}>
                    <span className="num">{fmtDate(a.visitDate)}</span>
                    <Badge tone={a.status === 'DONE' ? 'success' : 'neutral'}>{a.status === 'UPCOMING' ? 'Đã qua ngày hẹn' : APPOINTMENT_STATUS[a.status]}</Badge>
                    <span className="muted text-sm">{a.note}</span>
                    {a.status !== 'DONE' && (
                      <button type="button" className="link-btn text-sm" onClick={() => markDone(a)}>
                        Đánh dấu đã khám
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>

      <Card title={`Kết quả xét nghiệm (${labs.length})`} req="FR-16">
        {labs.length === 0 ? (
          <EmptyState icon={Activity} title="Chưa có kết quả nào" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày xét nghiệm</th>
                  <th>Loại</th>
                  <th className="col-num">Giá trị</th>
                  <th>Ghi chú</th>
                  <th>Nhập lúc</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap">{fmtDate(l.testedDate)}</td>
                    <td>{LAB_TYPES[l.testType]?.label}</td>
                    <td className="col-num strong nowrap">
                      {fmtNumber(l.value)} <span className="muted">{l.unit}</span>
                    </td>
                    <td className="text-sm">{l.note || <span className="faint">—</span>}</td>
                    <td className="text-sm muted nowrap">{fmtDateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LabModal open={labOpen} onClose={() => setLabOpen(false)} />
      <AppointmentModal open={apptOpen} onClose={() => setApptOpen(false)} appointments={appointments} />
    </>
  );
}
