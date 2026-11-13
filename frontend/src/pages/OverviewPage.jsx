import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  FileText,
  PhoneCall,
  Pill,
  Plus,
  Smartphone,
  UserPlus
} from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow, usePref } from '../app/hooks.js';
import { combine, useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { ADHERENCE_PERIODS, CONFIRMED_STATUSES, LAB_TYPES, SLOT_META } from '../domain/constants.js';
import { dailyAdherence, groupDoses } from '../domain/rules.js';
import { addDays, dayLabel, diffDays, fmtDate, fmtTime, toDateKey, weekdayOf, MINUTE } from '../lib/time.js';
import { fmtNumber, percent } from '../lib/text.js';
import { Callout, Card, DoseStatusBadge, PageHeader, PageStatus, Segmented } from '../components/ui.jsx';
import { DailyBars, StatusBreakdown } from '../components/charts.jsx';

const DELAYED_SYNC_MS = 5 * MINUTE;

/** Mô tả ai xác nhận, lúc nào (FR-13, BR-06), kèm dấu hiệu gửi lại khi có mạng và đính chính. */
export function confirmationText(group) {
  const c = group.lastConfirmation;
  if (!c) return '';
  const actor = c.actorRole === 'PATIENT' ? c.actorLabel || 'Bệnh nhân' : `${c.actorLabel || 'Người nhà'} (người nhà)`;
  let text;
  if (group.status === 'LATE_CONFIRMED') text = `${actor} xác nhận muộn: đã uống lúc ${fmtTime(c.takenAt)}`;
  else if (c.actorRole === 'PATIENT') text = `${actor} tự xác nhận đã uống lúc ${fmtTime(c.takenAt)}`;
  else text = `${actor} xác nhận hộ lúc ${fmtTime(c.takenAt)}`;
  if (Date.parse(c.recordedAt) - Date.parse(c.takenAt) > DELAYED_SYNC_MS && !c.correctsConfirmationId) {
    text += ` · máy chủ nhận lúc ${fmtTime(c.recordedAt)} (gửi lại khi có mạng)`;
  }
  if (c.correctsConfirmationId) text += ' · đã đính chính giờ uống';
  return text;
}

function groupDetail(group, { nowMs, patient, hasDevice, hasDelegate }) {
  switch (group.status) {
    case 'TAKEN':
    case 'TAKEN_BY_DELEGATE':
    case 'LATE_CONFIRMED':
      return confirmationText(group);
    case 'PENDING': {
      const left = Math.max(0, Math.round((Date.parse(group.deadlineAt) - nowMs) / MINUTE));
      return `Đã gửi nhắc lúc ${fmtTime(group.scheduledAt)} · hạn xác nhận ${fmtTime(group.deadlineAt)} (còn ${left} phút)`;
    }
    case 'MISSED':
      return `Quá hạn ${fmtTime(group.deadlineAt)} chưa có xác nhận — đã cảnh báo bạn${hasDelegate ? ' và người nhà' : ''}. Hãy gọi nhắc ${patient.alias}.`;
    case 'SCHEDULED':
      return hasDevice ? `Điện thoại của ${patient.alias} sẽ đổ chuông lúc ${fmtTime(group.scheduledAt)}` : `Sẽ nhắc lúc ${fmtTime(group.scheduledAt)} — ${patient.alias} chưa ghép điện thoại nên chưa nhận được nhắc`;
    default:
      return '';
  }
}

export function TodayTimeline({ groups, patient, nowMs, hasDevice, hasDelegate }) {
  return (
    <ol className="timeline">
      {groups.map((g) => (
        <li key={g.key} className={`tl-row tl-${g.status.toLowerCase()}`}>
          <div className="tl-time">
            <span className="num">{fmtTime(g.scheduledAt)}</span>
            <span>{SLOT_META[g.slot].long}</span>
          </div>
          <div className="tl-main">
            <div className="tl-meds">
              {g.doses.map((d) => (
                <span key={d.id} className="tl-med">
                  <Pill size={14} aria-hidden="true" />
                  {d.drugDisplayName}
                  <span className="muted">
                    · {fmtNumber(d.unitsPerDose)} {d.unit}
                  </span>
                </span>
              ))}
            </div>
            <div className="tl-detail">{groupDetail(g, { nowMs, patient, hasDevice, hasDelegate })}</div>
          </div>
          <div className="tl-status">
            <DoseStatusBadge status={g.status} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SetupChecklist({ patient, hasDevice, activeRx, drafts, hasDelegate }) {
  const steps = [
    { done: true, title: `Tạo hồ sơ ${patient.alias}`, text: 'Hồ sơ chỉ gồm tên gọi trong gia đình và năm sinh.' },
    {
      done: hasDevice,
      title: `Ghép điện thoại của ${patient.alias}`,
      text: 'Tạo mã 6 số dùng một lần, nhập trên điện thoại; không cần mật khẩu.',
      action: { label: 'Tạo mã ghép nối', to: ROUTES.family, icon: Smartphone }
    },
    {
      done: Boolean(activeRx),
      title: 'Nhập và xác nhận đơn thuốc',
      text: drafts.length ? `Có ${drafts.length} đơn nháp đang chờ bạn xem lại và xác nhận.` : 'Tra cứu đơn trên hệ thống số hóa của bệnh viện rồi nhập lại; lịch nhắc sinh sau khi xác nhận.',
      action: drafts.length ? { label: 'Xem đơn nháp', to: `${ROUTES.prescriptions}/${drafts[0].id}`, icon: Pill } : { label: 'Thêm đơn thuốc', to: ROUTES.prescriptionNew, icon: Pill }
    },
    {
      done: hasDelegate,
      optional: true,
      title: 'Ủy quyền người nhà sống cùng (không bắt buộc)',
      text: 'Người nhà có thể xác nhận hộ và nhận cảnh báo khi bỏ lỡ cữ.',
      action: { label: 'Ủy quyền', to: ROUTES.family, icon: UserPlus }
    }
  ];
  return (
    <Card title={`Thiết lập theo dõi cho ${patient.alias}`} subtitle="Hoàn tất các bước dưới đây để bắt đầu nhắc thuốc." req="UC-02 · UC-03 · UC-04 · UC-05">
      <ol className="checklist">
        {steps.map((s) => (
          <li key={s.title} className={s.done ? 'is-done' : ''}>
            {s.done ? <CheckCircle2 size={22} className="tone-text-success" aria-hidden="true" /> : <Circle size={22} className="faint" aria-hidden="true" />}
            <div className="checklist-text">
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </div>
            {!s.done && s.action && (
              <a className={`btn btn-sm ${s.optional ? 'btn-secondary' : 'btn-primary'}`} href={href(s.action.to)}>
                <s.action.icon size={15} aria-hidden="true" /> {s.action.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * Số liệu tuân thủ: các con số lấy từ GET /adherence/summary của máy chủ; biểu đồ theo ngày
 * và số cữ đang chờ tính từ danh sách cữ cùng kỳ.
 */
function buildSummary(server, doses, days) {
  const onTime = server.taken + server.takenByDelegate;
  const total = server.totalDoses;
  return {
    ...server,
    days,
    adherenceRate: total ? onTime / total : null,
    recordedRate: total ? (onTime + server.lateConfirmed) / total : null,
    pending: doses.filter((d) => d.status === 'PENDING').length,
    daily: dailyAdherence(doses, { fromDate: server.fromDate, toDate: server.toDate })
  };
}

export default function OverviewPage() {
  const { patient, call } = useApp();
  const nowMs = useNow(20_000);
  const [storedDays, setDays] = usePref('antam.v1.adherenceDays', 30);
  const days = ADHERENCE_PERIODS.includes(storedDays) ? storedDays : 30;
  const today = toDateKey(nowMs);
  const pid = patient.id;
  const key = (suffix) => patientKey(pid, suffix);

  const devicesQ = useQuery(key('devices'), () => api.listDevices(pid));
  const delegatesQ = useQuery(key('delegates'), () => api.listDelegates(pid));
  const rxQ = useQuery(key('rx'), () => api.listPrescriptions(pid));
  const recentQ = useQuery(key(`doses:${addDays(today, -1)}:${today}`), () => api.listDoses(pid, { from: addDays(today, -1), to: today }));
  const summaryQ = useQuery(key(`adherence:${days}`), () => api.getAdherenceSummary(pid, days));
  const periodQ = useQuery(key(`doses:${addDays(today, 1 - days)}:${today}`), () => api.listDoses(pid, { from: addDays(today, 1 - days), to: today }));
  const alertsQ = useQuery(key('alerts'), () => api.listAlerts(pid));
  const apptQ = useQuery(key('appointments'), () => api.listAppointments(pid));
  const labsQ = useQuery(key('labs'), () => api.listLabResults(pid));
  const all = combine(devicesQ, delegatesQ, rxQ, recentQ, summaryQ, periodQ, alertsQ, apptQ, labsQ);

  if (!all.ready) {
    return (
      <>
        <PageHeader eyebrow={`${weekdayOf(today)}, ${fmtDate(today)}`} title={`Tổng quan · ${patient.alias}`} />
        <PageStatus error={all.error} onRetry={all.reload} />
      </>
    );
  }

  const hasDevice = devicesQ.data.some((d) => d.role === 'PATIENT' && d.active);
  const hasDelegate = delegatesQ.data.some((d) => d.active);
  const prescriptions = rxQ.data;
  const activeRx = prescriptions.find((r) => r.status === 'ACTIVE');
  const drafts = prescriptions.filter((r) => r.status === 'DRAFT');
  const recentDoses = recentQ.data;
  const todayGroups = groupDoses(recentDoses.filter((d) => d.date === today && d.status !== 'CANCELLED'));
  const lastTaken = groupDoses(recentDoses.filter((d) => CONFIRMED_STATUSES.includes(d.status)))
    .filter((g) => g.lastConfirmation)
    .sort((a, b) => b.lastConfirmation.takenAt.localeCompare(a.lastConfirmation.takenAt))[0];
  const summary = buildSummary(summaryQ.data, periodQ.data, days);
  const unreadMissed = alertsQ.data.filter((a) => !a.read && a.type === 'DOSE_MISSED');
  const nextVisit = apptQ.data
    .filter((a) => a.status === 'UPCOMING' && a.visitDate >= today)
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0];
  const labs = labsQ.data;
  const latestLabs = ['HBA1C', 'FASTING_GLUCOSE'].map((type) => labs.filter((l) => l.testType === type)).filter((list) => list.length);
  const needsSetup = !hasDevice || !activeRx;
  const doneToday = todayGroups.filter((g) => CONFIRMED_STATUSES.includes(g.status)).length;

  return (
    <>
      <PageHeader
        eyebrow={`${weekdayOf(today)}, ${fmtDate(today)}`}
        title={`Quản lý đơn thuốc & sức khỏe cho ${patient.alias}`}
        subtitle="Theo dõi lịch uống thuốc và chăm sóc người thân từ xa."
        req="UC-09 · FR-19 · US-04"
        actions={
          <><a className="btn btn-primary" href={href(ROUTES.prescriptionNew)}>
            <Plus size={19} aria-hidden="true" /> Thêm đơn thuốc mới
          </a><a className="btn btn-secondary" href={href(ROUTES.reports)}>
            <FileText size={16} aria-hidden="true" /> Báo cáo cho bác sĩ
          </a></>
        }
      />

      <div className="overview-stats">
        <div className="overview-stat"><span>Tỷ lệ tuân thủ uống thuốc</span><strong>{summary.adherenceRate === null ? 'Chưa có dữ liệu' : percent(summary.adherenceRate)}</strong><small>{summary.taken + summary.takenByDelegate} / {summary.totalDoses} cữ đúng hạn trong {days} ngày</small></div>
        <div className="overview-stat stat-amber"><span>Lịch uống thuốc hôm nay</span><strong>{doneToday} / {todayGroups.length} buổi</strong><small>Đã có xác nhận uống thuốc</small></div>
        <div className="overview-stat"><span>Lịch tái khám sắp tới</span><strong>{nextVisit ? fmtDate(nextVisit.visitDate) : 'Chưa có lịch'}</strong><small>{nextVisit ? `Nhắc trước ${nextVisit.remindDaysBefore} ngày` : 'Thêm lịch tại Chỉ số & tái khám'}</small></div>
      </div>

      {unreadMissed.length > 0 && (
        <Callout
          tone="danger"
          title={unreadMissed.length === 1 ? unreadMissed[0].message : `${unreadMissed.length} cữ thuốc bị bỏ lỡ chưa xem`}
          actions={
            <>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => call(() => api.markAlertsRead(pid, unreadMissed.map((a) => a.id)), { success: 'Đã đánh dấu đã xem', refresh: key('') })}>
                <PhoneCall size={15} aria-hidden="true" /> Đã gọi nhắc
              </button>
              <a className="btn btn-sm btn-secondary" href={href(ROUTES.doses, { status: 'MISSED', from: addDays(today, -6), to: today })}>
                Xem các cữ bỏ lỡ
              </a>
            </>
          }
        >
          Hệ thống đã gửi cảnh báo tới bạn{hasDelegate ? ' và người nhà được ủy quyền' : ''}. Gọi nhắc {patient.alias}; nếu {patient.alias} đã uống mà quên bấm, có thể xác nhận muộn trên điện thoại trong ngày.
        </Callout>
      )}

      {needsSetup && <SetupChecklist patient={patient} hasDevice={hasDevice} activeRx={activeRx} drafts={drafts} hasDelegate={hasDelegate} />}

      <div className="ov-grid">
        <Card
          className="ov-today"
          title="Lịch uống thuốc hôm nay"
          subtitle={todayGroups.length ? `${doneToday}/${todayGroups.length} buổi đã có xác nhận` : undefined}
          req="FR-10 · FR-11 · FR-13"
          actions={
            <a className="btn btn-sm btn-ghost" href={href(ROUTES.doses)}>
              Lịch cữ thuốc <ArrowRight size={15} aria-hidden="true" />
            </a>
          }
        >
          <div className="last-taken">
            <span className="last-taken-label">Lần uống gần nhất</span>
            {lastTaken ? (
              <span>
                <strong className="num">{fmtTime(lastTaken.lastConfirmation.takenAt)}</strong> {dayLabel(lastTaken.date, nowMs).toLowerCase()} · {SLOT_META[lastTaken.slot].long.toLowerCase()} ·{' '}
                {lastTaken.lastConfirmation.actorRole === 'PATIENT' ? `${lastTaken.lastConfirmation.actorLabel || patient.alias} tự xác nhận` : `${lastTaken.lastConfirmation.actorLabel || 'Người nhà'} xác nhận hộ`}
              </span>
            ) : (
              <span className="muted">Chưa có xác nhận trong 2 ngày gần đây</span>
            )}
          </div>
          {todayGroups.length ? (
            <TodayTimeline groups={todayGroups} patient={patient} nowMs={nowMs} hasDevice={hasDevice} hasDelegate={hasDelegate} />
          ) : (
            <p className="muted" style={{ padding: '8px 0' }}>
              {activeRx ? 'Hôm nay không có cữ thuốc nào theo đơn.' : 'Chưa có đơn thuốc Hiệu lực nên chưa có lịch cữ.'}
            </p>
          )}
        </Card>

        <Card
          className="ov-adherence"
          title="Tuân thủ"
          req="FR-19 · TD-02"
          actions={<Segmented ariaLabel="Kỳ thống kê" value={summary.days} onChange={setDays} options={ADHERENCE_PERIODS.map((d) => ({ value: d, label: `${d} ngày` }))} />}
        >
          {summary.totalDoses === 0 ? (
            <p className="muted">Chưa có cữ thuốc nào đến hạn trong {summary.days} ngày qua.</p>
          ) : (
            <div className="stack">
              <div className="adh-head">
                <div className="adh-rate">
                  <span className="adh-value num">{percent(summary.adherenceRate)}</span>
                  <span className="adh-label">đúng hạn</span>
                </div>
                <div className="adh-side">
                  <div>
                    <strong className="num">{percent(summary.recordedRate)}</strong> có ghi nhận (tính cả xác nhận muộn)
                  </div>
                  <div className="muted">
                    {summary.totalDoses} cữ đã đến hạn từ {fmtDate(summary.fromDate)}
                    {summary.pending ? ` · ${summary.pending} cữ đang chờ` : ''}
                  </div>
                </div>
              </div>
              <StatusBreakdown summary={summary} />
              <p className="fine-print">
                Mỗi thuốc trong một buổi tính là một cữ. Tỷ lệ đúng hạn = (tự xác nhận + xác nhận hộ) / cữ đã có kết quả; cữ đang chờ, chưa đến giờ và đã hủy không nằm trong mẫu số. Cách tính xác nhận muộn đang chờ chốt (TD-02). Dữ liệu tự xác nhận không chứng minh việc đã uống thuốc.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Diễn biến theo ngày" subtitle={`${summary.days} ngày gần nhất · rê chuột lên cột để xem chi tiết`}>
        <DailyBars daily={summary.daily} today={today} />
      </Card>

      <div className="grid-3">
        <Card title="Tái khám sắp tới" req="UC-12 · FR-17" actions={<a className="btn btn-sm btn-ghost" href={href(ROUTES.clinical)}>Chi tiết</a>}>
          {nextVisit ? (
            <div className="mini">
              <CalendarClock size={22} className="mini-icon" aria-hidden="true" />
              <div>
                <div className="mini-value">{fmtDate(nextVisit.visitDate)}</div>
                <div className="muted text-sm">
                  {weekdayOf(nextVisit.visitDate)} · {diffDays(today, nextVisit.visitDate) === 0 ? 'hôm nay' : `còn ${diffDays(today, nextVisit.visitDate)} ngày`} · nhắc trước {nextVisit.remindDaysBefore} ngày
                </div>
                {nextVisit.note && <div className="text-sm" style={{ marginTop: 6 }}>{nextVisit.note}</div>}
              </div>
            </div>
          ) : (
            <p className="muted text-sm">Chưa có lịch tái khám.</p>
          )}
        </Card>

        <Card title="Chỉ số gần nhất" req="UC-11 · FR-16" actions={<a className="btn btn-sm btn-ghost" href={href(ROUTES.clinical)}>Xu hướng</a>}>
          {latestLabs.length ? (
            <div className="stack-sm">
              {latestLabs.map((list) => {
                const [latest, prev] = list;
                const delta = prev ? latest.value - prev.value : null;
                return (
                  <div key={latest.testType} className="mini">
                    <Activity size={22} className="mini-icon" aria-hidden="true" />
                    <div>
                      <div className="muted text-sm">{LAB_TYPES[latest.testType].label}</div>
                      <div className="mini-value">
                        {fmtNumber(latest.value)} <span className="mini-unit">{latest.unit}</span>
                      </div>
                      <div className="muted text-xs">
                        {fmtDate(latest.testedDate)}
                        {delta !== null && ` · ${delta > 0 ? 'tăng' : delta < 0 ? 'giảm' : 'không đổi'} ${fmtNumber(Math.abs(Math.round(delta * 10) / 10))} so với lần trước`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted text-sm">Chưa ghi chỉ số xét nghiệm nào.</p>
          )}
        </Card>

        <Card title="Đơn đang dùng" req="BR-02" actions={<a className="btn btn-sm btn-ghost" href={href(ROUTES.prescriptions)}>Đơn thuốc</a>}>
          {activeRx ? (
            <div className="stack-sm">
              <div className="muted text-sm">
                Hiệu lực từ {fmtDate(activeRx.startDate)} tới ngày tái khám {fmtDate(activeRx.nextVisitDate)}
              </div>
              <ul className="mini-list">
                {activeRx.items.map((it) => (
                  <li key={it.id}>
                    <Pill size={14} aria-hidden="true" /> {it.drugNameRaw}
                    <span className="muted"> · {it.slots.map((s) => SLOT_META[s].label.toLowerCase()).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted text-sm">{drafts.length ? `Có ${drafts.length} đơn nháp chờ xác nhận.` : 'Chưa có đơn thuốc Hiệu lực.'}</p>
          )}
        </Card>
      </div>
    </>
  );
}
