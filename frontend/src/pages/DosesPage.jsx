import { Fragment, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, Pill } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { useQuery } from '../app/query.js';
import { replaceQuery } from '../app/router.js';
import { DOSE_STATUS, SLOT_META } from '../domain/constants.js';
import { groupDoses, checkConfirmable } from '../domain/rules.js';
import { addDays, atTime, dayLabel, diffDays, fmtDate, fmtDateTime, fmtTime, isValidDateKey, isValidHHmm, toDateKey } from '../lib/time.js';
import { fmtNumber } from '../lib/text.js';
import { Card, DoseStatusBadge, EmptyState, Field, PageHeader, PageStatus } from '../components/ui.jsx';
import { confirmationText } from './OverviewPage.jsx';

const STATUS_ORDER = ['PENDING', 'TAKEN', 'TAKEN_BY_DELEGATE', 'LATE_CONFIRMED', 'MISSED', 'SCHEDULED', 'CANCELLED'];
const MAX_RANGE_DAYS = 120;
const ACTOR_LABELS = { PATIENT: 'Bệnh nhân', DELEGATE: 'Người nhà', CAREGIVER: 'Người chăm sóc' };

function CorrectionForm({ dose, latest, onClose }) {
  const { call } = useApp();
  const nowMs = useNow();
  const [date, setDate] = useState(toDateKey(latest.takenAt));
  const [time, setTime] = useState(fmtTime(latest.takenAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!isValidDateKey(date) || !isValidHHmm(time)) { setError('Nhập ngày và giờ uống hợp lệ.'); return; }
    const takenAt = atTime(date, time);
    const check = checkConfirmable({ ...dose, lastConfirmation: latest }, { takenAt, nowMs, correction: true });
    if (!check.ok) { setError(check.message); return; }
    setBusy(true);
    setError('');
    const result = await call(() => api.correctDoseConfirmation(dose.id, { takenAt, correctsConfirmationId: latest.id }), {
      success: 'Đã đính chính giờ uống', errorTitle: 'Chưa lưu được đính chính', refresh: patientKey(dose.patientId)
    });
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error?.message || 'Chưa lưu được đính chính.');
  }
  return (
    <form className="stack" onSubmit={save}>
      <div className="form-grid">
        <Field label="Ngày uống" htmlFor={`correct-date-${dose.id}`}><input id={`correct-date-${dose.id}`} className="input" type="date" value={date} max={toDateKey(nowMs)} onChange={e => setDate(e.target.value)} required disabled={busy} /></Field>
        <Field label="Giờ uống thực tế" htmlFor={`correct-time-${dose.id}`}><input id={`correct-time-${dose.id}`} className="input" type="text" placeholder="HH:mm" maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" title="24h: 00:00 - 23:59" value={time} onChange={e => setTime(e.target.value)} required disabled={busy} /></Field>
      </div>
      {error && <p className="text-sm" role="alert">{error}</p>}
      <div className="row"><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Hủy</button></div>
    </form>
  );
}

function DoseRecords({ dose }) {
  const { call } = useApp();
  const nowMs = useNow();
  const [confirming, setConfirming] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const recordsQ = useQuery(patientKey(dose.patientId, `confirmations:${dose.id}`), () => api.listDoseConfirmations(dose.id));
  const records = recordsQ.data;
  const original = records?.[0];
  const latest = records?.at(-1);
  const actorName = record => record.actorLabel || ACTOR_LABELS[record.actorRole];
  const doseTime = record => toDateKey(record.takenAt) === dose.date ? fmtTime(record.takenAt) : fmtDateTime(record.takenAt);
  const canConfirm = !dose.prescriptionDeleted && checkConfirmable(dose, { takenAt: new Date(nowMs).toISOString(), nowMs }).ok;
  async function confirm() {
    setConfirming(true);
    await call(() => api.confirmDose(dose.id), {
      success: `Đã xác nhận hộ cữ ${dose.drugDisplayName}`, errorTitle: 'Chưa xác nhận được cữ thuốc', refresh: patientKey(dose.patientId)
    });
    setConfirming(false);
  }
  return (
    <div className="conf-dose">
      <div className="conf-dose-head">
        <Pill size={14} aria-hidden="true" />
        <strong>{dose.drugDisplayName}</strong>
        <span className="muted">
          · {fmtNumber(dose.unitsPerDose)} {dose.unit}
        </span>
        <DoseStatusBadge status={dose.status} />
      </div>
      {!records ? (
        <PageStatus compact error={recordsQ.error} onRetry={recordsQ.reload} label="Đang tải bản ghi…" />
      ) : records.length === 0 ? (
        canConfirm
          ? <button type="button" className="btn btn-primary btn-sm" disabled={confirming || recordsQ.refreshing} onClick={confirm}>{confirming ? 'Đang ghi nhận…' : 'Xác nhận hộ'}</button>
          : <p className="muted text-sm">Chưa xác nhận.</p>
      ) : (
        <div className="row">
          <span className="text-sm">Uống lúc <strong className="num">{doseTime(latest)}</strong> · {actorName(original)} {original.actorRole === 'PATIENT' ? 'tự xác nhận' : 'xác nhận hộ'}</span>
          {!correcting && dose.status !== 'CANCELLED' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCorrecting(true)}>Sửa giờ</button>}
        </div>
      )}
      {correcting && latest && dose.status !== 'CANCELLED' && <CorrectionForm key={latest.id} dose={dose} latest={latest} onClose={() => setCorrecting(false)} />}
      {records?.length > 1 && (
        <details className="text-sm muted">
          <summary>Lịch sử sửa giờ</summary>
          <ol className="conf-records">
            {records.map(r => <li key={r.id}>{actorName(r)} {r.correctsConfirmationId ? 'sửa giờ thành' : 'ghi nhận giờ uống'} {doseTime(r)}</li>)}
          </ol>
        </details>
      )}
    </div>
  );
}

function ConfirmationHistory({ group }) {
  return (
    <div className="conf-history">
      {group.doses.map((dose) => (
        <DoseRecords key={dose.id} dose={dose} />
      ))}
    </div>
  );
}

export default function DosesPage({ route }) {
  const { patient } = useApp();
  const nowMs = useNow(30_000);
  const today = toDateKey(nowMs);
  const [expanded, setExpanded] = useState(() => new Set());

  const q = route.query;
  let from = isValidDateKey(q.from) ? q.from : addDays(today, -6);
  let to = isValidDateKey(q.to) ? q.to : today;
  if (from > to) [from, to] = [to, from];
  if (diffDays(from, to) > MAX_RANGE_DAYS) from = addDays(to, -MAX_RANGE_DAYS);
  const status = DOSE_STATUS[q.status] ? q.status : '';
  const setQuery = (patch) => replaceQuery({ from, to, status, ...patch });

  const dosesQ = useQuery(patientKey(patient.id, `doses:${from}:${to}`), () => api.listDoses(patient.id, { from, to }));
  const all = dosesQ.data || [];
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, all.filter((d) => d.status === s).length]));
  const groups = groupDoses(status ? all.filter((d) => d.status === status) : all).reverse();
  const byDate = new Map();
  for (const g of groups) {
    if (!byDate.has(g.date)) byDate.set(g.date, []);
    byDate.get(g.date).push(g);
  }

  const presets = [
    { label: 'Hôm nay', from: today, to: today },
    { label: '7 ngày qua', from: addDays(today, -6), to: today },
    { label: '30 ngày qua', from: addDays(today, -29), to: today },
    { label: '7 ngày tới', from: today, to: addDays(today, 6) }
  ];

  function toggle(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Lịch cữ thuốc" />

      <Card>
        <div className="filters">
          <div className="filters-row">
            <div className="chips" role="group" aria-label="Khoảng thời gian">
              {presets.map((p) => (
                <button key={p.label} type="button" className="chip" aria-pressed={from === p.from && to === p.to} onClick={() => setQuery({ from: p.from, to: p.to })}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="date-range">
              <label className="sr-only" htmlFor="doses-from">
                Từ ngày
              </label>
              <input id="doses-from" className="input" type="date" value={from} onChange={(e) => e.target.value && setQuery({ from: e.target.value })} />
              <span className="muted">→</span>
              <label className="sr-only" htmlFor="doses-to">
                Đến ngày
              </label>
              <input id="doses-to" className="input" type="date" value={to} onChange={(e) => e.target.value && setQuery({ to: e.target.value })} />
            </div>
          </div>
          <div className="chips" role="group" aria-label="Lọc theo trạng thái">
            <button type="button" className="chip" aria-pressed={!status} onClick={() => setQuery({ status: '' })}>
              Tất cả <span className="chip-count">{all.length}</span>
            </button>
            {STATUS_ORDER.filter((s) => counts[s] > 0 || s === status).map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setQuery({ status: status === s ? '' : s })}>
                {DOSE_STATUS[s].label} <span className="chip-count">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {!dosesQ.data ? (
        <PageStatus error={dosesQ.error} onRetry={dosesQ.reload} />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarClock} title="Không có cữ thuốc nào">
            {all.length ? 'Không có cữ nào khớp bộ lọc trạng thái.' : `Không có cữ thuốc trong khoảng ${fmtDate(from)} – ${fmtDate(to)}.`}
          </EmptyState>
        </Card>
      ) : (
        <div className="day-blocks">
          {[...byDate.entries()].map(([date, list]) => (
            <Card key={date} className="day-block" bodyClassName="flush">
              <div className="day-head">
                <strong>{dayLabel(date, nowMs)}</strong>
                <span className="muted">{fmtDate(date)}</span>
              </div>
              <ul className="dose-rows">
                {list.map((g) => {
                  const open = expanded.has(g.key);
                  const info = confirmationText(g);
                  return (
                    <Fragment key={g.key}>
                      <li className={`dose-row ${open ? 'is-open' : ''}`}>
                        <button type="button" className="dose-row-btn" aria-expanded={open} onClick={() => toggle(g.key)}>
                          <span className="dose-time">
                            <strong className="num">{fmtTime(g.scheduledAt)}</strong>
                            <span>{SLOT_META[g.slot].label}</span>
                          </span>
                          <span className="dose-meds">
                            {g.doses.map((d) => (
                              <span key={d.id}>
                                {d.drugDisplayName}{' '}
                                <span className="muted">
                                  · {fmtNumber(d.unitsPerDose)} {d.unit}
                                </span>
                              </span>
                            ))}
                          </span>
                          <span className="dose-info">
                            {info || (g.status === 'MISSED' ? `Quá hạn ${fmtTime(g.deadlineAt)} chưa có xác nhận` : g.status === 'PENDING' ? `Hạn xác nhận ${fmtTime(g.deadlineAt)}` : g.status === 'CANCELLED' ? 'Hủy do đơn thuốc đã được thay thế hoặc xóa' : `Nhắc lúc ${fmtTime(g.scheduledAt)}`)}
                          </span>
                          <span className="dose-status">
                            <DoseStatusBadge status={g.status} />
                            {open ? <ChevronDown size={18} className="muted" aria-hidden="true" /> : <ChevronRight size={18} className="muted" aria-hidden="true" />}
                          </span>
                        </button>
                      </li>
                      {open && (
                        <li className="dose-row-detail">
                          <ConfirmationHistory group={g} />
                        </li>
                      )}
                    </Fragment>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

    </>
  );
}
