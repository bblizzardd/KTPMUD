import { Fragment, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, HelpCircle, Pill } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { useQuery } from '../app/query.js';
import { replaceQuery } from '../app/router.js';
import { DOSE_STATUS, SLOT_META } from '../domain/constants.js';
import { DECISION_TABLE, groupDoses } from '../domain/rules.js';
import { addDays, dayLabel, diffDays, fmtDate, fmtDateTime, fmtTime, isValidDateKey, toDateKey } from '../lib/time.js';
import { fmtNumber, shortId } from '../lib/text.js';
import { Badge, Card, DoseStatusBadge, EmptyState, Modal, PageHeader, PageStatus } from '../components/ui.jsx';
import { confirmationText } from './OverviewPage.jsx';

const STATUS_ORDER = ['PENDING', 'TAKEN', 'TAKEN_BY_DELEGATE', 'LATE_CONFIRMED', 'MISSED', 'SCHEDULED', 'CANCELLED'];
const MAX_RANGE_DAYS = 120;

function StatusGuide({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Trạng thái cữ thuốc" subtitle="Theo biểu đồ chuyển trạng thái (Hình 4) và bảng quyết định (Bảng 6) trong đặc tả.">
      <div className="stack">
        <ul className="status-guide">
          {STATUS_ORDER.map((s) => (
            <li key={s}>
              <DoseStatusBadge status={s} />
              <span>{DOSE_STATUS[s].desc}</span>
            </li>
          ))}
        </ul>
        <div>
          <h3 style={{ marginBottom: 8 }}>Bảng quyết định cập nhật trạng thái</h3>
          <div className="table-wrap card" style={{ boxShadow: 'none' }}>
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Luật</th>
                  <th>Có xác nhận</th>
                  <th>Người xác nhận là bệnh nhân</th>
                  <th>Trong thời hạn</th>
                  <th>Đã quá thời hạn</th>
                  <th>Trạng thái mới</th>
                  <th>Hành động kèm theo</th>
                </tr>
              </thead>
              <tbody>
                {DECISION_TABLE.map((r) => (
                  <tr key={r.rule}>
                    <td className="strong">{r.rule}</td>
                    <td>{r.hasConfirmation}</td>
                    <td>{r.byPatient}</td>
                    <td>{r.inTime}</td>
                    <td>{r.overdue}</td>
                    <td>
                      <DoseStatusBadge status={r.result} />
                    </td>
                    <td>{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine-print" style={{ marginTop: 8 }}>
            Đúng giờ là từ 60 phút trước đến 60 phút sau giờ hẹn, gồm cả hai mốc. Quá mốc sau mà chưa xác nhận sẽ tính bỏ lỡ. Xét theo giờ uống (takenAt), kể cả xác nhận ngoại tuyến gửi lại trong 72 giờ. Khoảng đúng giờ có thể qua nửa đêm; ngoài khoảng đó chỉ nhận xác nhận muộn trong ngày của cữ.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function DoseRecords({ dose }) {
  const recordsQ = useQuery(patientKey(dose.patientId, `confirmations:${dose.id}`), () => api.listDoseConfirmations(dose.id));
  const records = recordsQ.data;
  return (
    <div className="conf-dose">
      <div className="conf-dose-head">
        <Pill size={14} aria-hidden="true" />
        <strong>{dose.drugDisplayName}</strong>
        <span className="muted">
          · {fmtNumber(dose.unitsPerDose)} {dose.unit} · hạn {fmtTime(dose.deadlineAt)}
        </span>
        <DoseStatusBadge status={dose.status} />
      </div>
      {!records ? (
        <PageStatus compact error={recordsQ.error} onRetry={recordsQ.reload} label="Đang tải bản ghi…" />
      ) : records.length === 0 ? (
        <p className="muted text-sm">Chưa có bản ghi xác nhận.</p>
      ) : (
        <ol className="conf-records">
          {records.map((r) => (
            <li key={r.id}>
              <Badge tone={r.correctsConfirmationId ? 'warning' : 'neutral'}>{r.correctsConfirmationId ? 'Đính chính' : 'Bản ghi gốc'}</Badge>
              <span>
                {r.actorLabel || (r.actorRole === 'PATIENT' ? 'Bệnh nhân' : 'Người nhà')} ({r.actorRole === 'PATIENT' ? 'bệnh nhân' : 'người nhà'}) · uống lúc <strong className="num">{fmtTime(r.takenAt)}</strong> · máy chủ ghi{' '}
                <span className="num">{fmtDateTime(r.recordedAt)}</span> → {DOSE_STATUS[r.resultingStatus]?.label}
                {r.correctsConfirmationId && <span className="muted"> · tham chiếu bản ghi #{shortId(r.correctsConfirmationId)}</span>}
              </span>
              <span className="mono faint">#{shortId(r.id)}</span>
            </li>
          ))}
        </ol>
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
      <p className="fine-print">Bản ghi xác nhận chỉ được thêm, không sửa hay xóa; bấm nhầm được đính chính bằng bản ghi mới tham chiếu bản ghi cũ (BR-05).</p>
    </div>
  );
}

export default function DosesPage({ route }) {
  const { patient } = useApp();
  const nowMs = useNow(30_000);
  const today = toDateKey(nowMs);
  const [expanded, setExpanded] = useState(() => new Set());
  const [guide, setGuide] = useState(false);

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
      <PageHeader
        title="Lịch cữ thuốc"
        subtitle={`Từng cữ thuốc của ${patient.alias}: giờ nhắc, hạn xác nhận, ai xác nhận và lúc nào.`}
        req="FR-09 · FR-13 · FR-14 · FR-15"
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setGuide(true)}>
            <HelpCircle size={16} aria-hidden="true" /> Giải thích trạng thái
          </button>
        }
      />

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
                            {info || (g.status === 'MISSED' ? `Quá hạn ${fmtTime(g.deadlineAt)} chưa có xác nhận` : g.status === 'PENDING' ? `Hạn xác nhận ${fmtTime(g.deadlineAt)}` : g.status === 'CANCELLED' ? 'Hủy do đơn thuốc được thay thế' : `Nhắc lúc ${fmtTime(g.scheduledAt)}`)}
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

      <StatusGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}
