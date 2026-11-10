import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  FastForward,
  FileText,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Plus,
  Smartphone,
  Users
} from 'lucide-react';
import * as api from '../api/caregiver.js';
import { clock } from '../app/clock.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow, useOnClickOutside } from '../app/hooks.js';
import { invalidate, invalidateAll, useQuery } from '../app/query.js';
import { useAlertSocket } from '../app/realtime.js';
import { href, navigate, ROUTES } from '../app/router.js';
import { ALERT_TYPES } from '../domain/constants.js';
import { addDays, ageFromBirthYear, dayLabel, fmtDuration, fmtRelative, fmtTime, toDateKey } from '../lib/time.js';
import { EmptyState, Req, Spinner, Toasts, initials } from '../components/ui.jsx';
import PatientFormModal from './PatientFormModal.jsx';
import PhoneDock from '../device/PhoneDock.jsx';
import DemoPanel from '../demo/DemoPanel.jsx';

const NAV = [
  {
    group: 'Theo dõi',
    items: [
      { path: ROUTES.overview, label: 'Tổng quan', icon: LayoutDashboard },
      { path: ROUTES.doses, label: 'Lịch cữ thuốc', icon: CalendarClock }
    ]
  },
  {
    group: 'Điều trị',
    items: [
      { path: ROUTES.prescriptions, label: 'Đơn thuốc', icon: Pill },
      { path: ROUTES.clinical, label: 'Chỉ số & tái khám', icon: Activity }
    ]
  },
  {
    group: 'Báo cáo & ghi vết',
    items: [
      { path: ROUTES.reports, label: 'Báo cáo PDF', icon: FileText },
      { path: ROUTES.audit, label: 'Nhật ký thao tác', icon: History }
    ]
  },
  {
    group: 'Gia đình',
    items: [{ path: ROUTES.family, label: 'Hồ sơ & thiết bị', icon: Users }]
  }
];

const ALERT_ICON = {
  DOSE_MISSED: { icon: AlertCircle, tone: 'danger' },
  VISIT_UPCOMING: { icon: CalendarClock, tone: 'info' },
  DUPLICATE_INGREDIENT: { icon: AlertTriangle, tone: 'warning' }
};

/** Cảnh báo mới đẩy qua WSS /ws/alerts hiện ngay thành thông báo và làm mới dữ liệu hồ sơ đó. */
function useAlertStream() {
  const { patients, toast } = useApp();
  const seen = useRef(new Set());
  return useAlertSocket({
    enabled: true,
    onAlert: (alert) => {
      invalidate(patientKey(alert.patientId), 'patients');
      if (seen.current.has(alert.id)) return;
      seen.current.add(alert.id);
      if (alert.type === 'DUPLICATE_INGREDIENT') return; // đã hiện ngay trong màn hình nhập đơn
      const owner = patients.find((p) => p.id === alert.patientId);
      toast({
        tone: alert.type === 'DOSE_MISSED' ? 'danger' : 'info',
        title: `Cảnh báo mới${owner ? ` · ${owner.alias}` : ''} · ${ALERT_TYPES[alert.type]?.label || alert.type}`,
        message: alert.message,
        timeout: 9000
      });
    },
    // Mất kết nối một lúc: tải lại qua REST để bù các cảnh báo đã lỡ.
    onReconnect: () => invalidateAll()
  });
}

/** Tự làm mới dữ liệu hồ sơ đang xem: trạng thái cữ do bộ lập lịch trên máy chủ đổi theo thời gian. */
function useAutoRefresh(patientId) {
  useEffect(() => {
    if (!patientId) return undefined;
    const refresh = () => {
      if (!document.hidden) invalidate(patientKey(patientId), 'patients');
    };
    const id = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [patientId]);
}

const LINK_STATUS = {
  live: { tone: 'success', text: 'Đã kết nối máy chủ · cảnh báo thời gian thực' },
  connecting: { tone: 'warning', text: 'Đang kết nối máy chủ…' },
  offline: { tone: 'danger', text: 'Mất kết nối thời gian thực · đang thử lại' }
};

function Sidebar({ route, linkStatus }) {
  const link = LINK_STATUS[linkStatus] || LINK_STATUS.connecting;
  return (
    <aside className="sidebar" aria-label="Điều hướng chính">
      <div className="sidebar-brand">
        <span className="logo-mark">
          <HeartPulse size={22} aria-hidden="true" />
        </span>
        <div>
          <strong>An Tâm</strong>
          <span>Theo dõi ĐTĐ type 2</span>
        </div>
      </div>
      <nav>
        {NAV.map((group) => (
          <div className="nav-group" key={group.group}>
            <div className="nav-group-label">{group.group}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const current = route.path === item.path || route.path.startsWith(`${item.path}/`);
              return (
                <a key={item.path} href={href(item.path)} className="nav-link" aria-current={current ? 'page' : undefined}>
                  <Icon size={19} aria-hidden="true" />
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className={`link-status tone-text-${link.tone}`}>
          <span className="link-dot" aria-hidden="true" /> {link.text}
        </span>
        <span>Khoa Nội tiết – ĐTĐ · BV Hữu Nghị</span>
        <span>An Tâm v1.0</span>
      </div>
    </aside>
  );
}

function UnreadBadge({ patientId }) {
  const { data } = useQuery(patientKey(patientId, 'alerts'), () => api.listAlerts(patientId));
  const unread = (data || []).filter((a) => !a.read).length;
  if (!unread) return null;
  return (
    <span className="badge tone-danger" title={`${unread} cảnh báo chưa đọc`}>
      {unread}
    </span>
  );
}

function PatientSwitcher({ route }) {
  const { patients, patient, selectPatient } = useApp();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);
  const now = useNow(60_000);
  useOnClickOutside(ref, () => setOpen(false), open);

  if (!patient) return null;

  function choose(id) {
    setOpen(false);
    if (id === patient.id) return;
    selectPatient(id);
    // Đang xem chi tiết của hồ sơ cũ thì quay về trang danh sách của mục đó
    if (route.segments.length > 1) navigate(`/${route.segments[0]}`);
  }

  return (
    <div className="patient-switcher" ref={ref}>
      <button type="button" className="patient-switcher-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="avatar">{initials(patient.alias)}</span>
        <div style={{ minWidth: 0 }}>
          <strong className="ps-name">{patient.alias}</strong>
          <span className="ps-sub">
            {ageFromBirthYear(patient.birthYear, now)} tuổi · sinh năm {patient.birthYear}
          </span>
        </div>
        <ChevronDown size={16} className="muted" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu" style={{ left: 0, top: 'calc(100% + 6px)', minWidth: 300 }}>
          <div className="menu-label">Hồ sơ bạn đang chăm sóc</div>
          {patients.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === patient.id} aria-current={p.id === patient.id} className="menu-item" onClick={() => choose(p.id)}>
              <span className="avatar avatar-sm">{initials(p.alias)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{p.alias}</strong>
                <span className="muted text-xs">
                  {' '}
                  · {ageFromBirthYear(p.birthYear, now)} tuổi · sinh năm {p.birthYear}
                </span>
              </span>
              <UnreadBadge patientId={p.id} />
              {p.id === patient.id && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
          <div className="menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
          >
            <Plus size={16} aria-hidden="true" /> Thêm hồ sơ người thân
          </button>
        </div>
      )}
      <PatientFormModal open={creating} mode="create" onClose={() => setCreating(false)} onSaved={() => navigate(ROUTES.overview)} />
    </div>
  );
}

function alertTarget(alert) {
  if (alert.type === 'DOSE_MISSED') {
    // Cảnh báo sinh lúc hết hạn xác nhận: cùng ngày với cữ hoặc sáng hôm sau với cữ tối muộn.
    const day = toDateKey(alert.createdAt);
    return href(ROUTES.doses, { from: addDays(day, -1), to: day, status: 'MISSED' });
  }
  if (alert.type === 'DUPLICATE_INGREDIENT') return href(ROUTES.prescriptions);
  return href(ROUTES.clinical);
}

function AlertsButton() {
  const { patient, call } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const now = useNow(30_000);
  useOnClickOutside(ref, () => setOpen(false), open);
  const alertsQ = useQuery(patient ? patientKey(patient.id, 'alerts') : null, () => api.listAlerts(patient.id));
  if (!patient) return null;
  const alerts = alertsQ.data || [];
  const unread = alerts.filter((a) => !a.read).length;
  const refresh = [patientKey(patient.id)];

  function openAlert(alert) {
    if (!alert.read) call(() => api.markAlertsRead(patient.id, [alert.id]), { silent: true, refresh });
    setOpen(false);
    window.location.hash = alertTarget(alert);
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className="topbar-icon-btn"
        aria-label={`Cảnh báo, ${unread} chưa đọc`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="alerts-panel" role="dialog" aria-label={`Cảnh báo của ${patient.alias}`}>
          <div className="alerts-panel-head">
            <strong>Cảnh báo · {patient.alias}</strong>
            <Req ids="FR-12 · US-03" />
            <span className="spacer" />
            {unread > 0 && (
              <button type="button" className="link-btn text-sm" onClick={() => call(() => api.markAlertsRead(patient.id), { silent: true, refresh })}>
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          <div className="alerts-panel-list">
            {alertsQ.loading ? (
              <div className="page-status is-compact" style={{ padding: 16 }}>
                <Spinner /> Đang tải cảnh báo…
              </div>
            ) : alerts.length === 0 ? (
              <EmptyState icon={Bell} title="Chưa có cảnh báo">
                Khi {patient.alias} bỏ lỡ một cữ thuốc hoặc sắp đến lịch tái khám, cảnh báo sẽ hiện ở đây.
              </EmptyState>
            ) : (
              alerts.slice(0, 40).map((alert) => {
                const meta = ALERT_ICON[alert.type] || ALERT_ICON.VISIT_UPCOMING;
                const Icon = meta.icon;
                return (
                  <button key={alert.id} type="button" className={`alert-item ${alert.read ? '' : 'is-unread'}`} onClick={() => openAlert(alert)}>
                    <span className={`alert-icon tone-${meta.tone}`}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="alert-text">{alert.message}</span>
                      <span className="alert-meta">
                        <span>{ALERT_TYPES[alert.type]?.label}</span>·<span>{fmtRelative(alert.createdAt, now)}</span>
                      </span>
                    </span>
                    {!alert.read && <span className="unread-dot" aria-label="Chưa đọc" />}
                  </button>
                );
              })
            )}
          </div>
          <div className="alerts-panel-foot">Cảnh báo mới được máy chủ đẩy ngay lên trang qua kênh WSS /ws/alerts.</div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { caregiver, logout } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false), open);
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="avatar avatar-sm" style={{ background: '#e8edf3', color: 'var(--text-2)' }}>
          {initials(caregiver.displayName)}
        </span>
        <span className="label">{caregiver.displayName}</span>
        <ChevronDown size={15} className="muted" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu" style={{ right: 0, top: 'calc(100% + 6px)' }}>
          <div style={{ padding: '8px 10px 10px' }}>
            <div className="strong">{caregiver.displayName}</div>
            <div className="muted text-sm">{caregiver.email}</div>
            <div className="faint text-xs" style={{ marginTop: 4 }}>
              Người chăm sóc chính
            </div>
          </div>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item" onClick={logout}>
            <LogOut size={16} aria-hidden="true" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function SimulatedClock() {
  const now = useNow(10_000);
  const offset = clock.offsetMs();
  if (!clock.devTools() || offset < 60_000) return null;
  const label = dayLabel(toDateKey(new Date(now)), Date.now());
  return (
    <span className="time-chip" title={`Máy chủ đang chạy nhanh ${fmtDuration(offset / 60_000)} so với giờ thực (công cụ kiểm thử)`}>
      <FastForward size={14} aria-hidden="true" />
      <span className="label">Giờ mô phỏng</span>
      <span className="num">
        {fmtTime(new Date(now).toISOString())}
        {label !== 'Hôm nay' ? ` · ${label.toLowerCase()}` : ''}
      </span>
    </span>
  );
}

export default function AppShell({ route, children }) {
  const { phoneOpen, setPhoneOpen, patient } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  const linkStatus = useAlertStream();
  useAutoRefresh(patient?.id);

  useEffect(() => setNavOpen(false), [route.path]);

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''} ${phoneOpen ? 'phone-open' : ''}`}>
      <Sidebar route={route} linkStatus={linkStatus} />
      <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <div className="main">
        <header className="topbar no-print">
          <button type="button" className="topbar-icon-btn topbar-menu-btn" onClick={() => setNavOpen(true)} aria-label="Mở menu">
            <Menu size={20} />
          </button>
          <PatientSwitcher route={route} />
          <div className="topbar-right">
            <SimulatedClock />
            <button type="button" className="topbar-phone-btn" aria-pressed={phoneOpen} onClick={() => setPhoneOpen(!phoneOpen)} title="Xem ứng dụng trên điện thoại của bệnh nhân / người nhà (mô phỏng)">
              <Smartphone size={17} aria-hidden="true" />
              <span className="label">Điện thoại mô phỏng</span>
            </button>
            {patient && <AlertsButton />}
            <AccountMenu />
          </div>
        </header>
        <div className="content-area">
          <main className="page" id="main">
            {children}
          </main>
          {phoneOpen && <PhoneDock onClose={() => setPhoneOpen(false)} />}
        </div>
      </div>
      <DemoPanel />
      <Toasts />
    </div>
  );
}
