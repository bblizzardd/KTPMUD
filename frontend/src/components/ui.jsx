import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, HeartPulse, Info, RefreshCw, WifiOff, X } from 'lucide-react';
import { DOSE_STATUS, RX_STATUS } from '../domain/constants.js';
import { useApp } from '../app/AppContext.jsx';

export function Badge({ tone = 'neutral', dot = false, size, className = '', title, children }) {
  return (
    <span className={`badge tone-${tone}${dot ? ' badge-dot' : ''}${size === 'lg' ? ' badge-lg' : ''} ${className}`} title={title}>
      {children}
    </span>
  );
}

export function DoseStatusBadge({ status, size }) {
  const meta = DOSE_STATUS[status] || { label: status, tone: 'neutral' };
  return (
    <Badge tone={meta.tone} dot size={size} title={meta.desc}>
      {meta.label}
    </Badge>
  );
}

export function RxStatusBadge({ status, size }) {
  const meta = RX_STATUS[status] || { label: status, tone: 'neutral' };
  return (
    <Badge tone={meta.tone} size={size} title={meta.desc}>
      {meta.label}
    </Badge>
  );
}

/** Nhãn mã yêu cầu (UC/FR/BR...) chỉ hiện khi bật chế độ chú thích trong công cụ demo. */
export function Req({ ids }) {
  const { annotate } = useApp();
  if (!annotate || !ids) return null;
  return <span className="req">{ids}</span>;
}

export function PageHeader({ title, subtitle, actions, back, eyebrow, req, badge }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back}
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">
          {title}
          {badge}
          <Req ids={req} />
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, actions, children, footer, className = '', bodyClassName = '', req, id }) {
  const titleId = useId();
  return (
    <section className={`card ${className}`} id={id} aria-labelledby={title ? titleId : undefined}>
      {(title || actions) && (
        <div className="card-header">
          <div className="card-header-text">
            {title && (
              <h2 className="card-title" id={titleId}>
                {title}
                <Req ids={req} />
              </h2>
            )}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${bodyClassName}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

export function Field({ label, required, hint, error, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="field-required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="field-error" role="alert">
          <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

const CALLOUT_ICONS = { info: Info, warning: AlertTriangle, danger: AlertCircle, success: CheckCircle2, neutral: Info };

export function Callout({ tone = 'info', title, children, actions, icon, className = '' }) {
  const Icon = icon || CALLOUT_ICONS[tone] || Info;
  return (
    <div className={`callout tone-${tone} ${className}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={20} className="callout-icon" aria-hidden="true" />
      <div className="callout-body">
        {title && <div className="callout-title">{title}</div>}
        {children}
        {actions && <div className="callout-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={24} aria-hidden="true" />
      </div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-text">{children}</div>}
      {action}
    </div>
  );
}

export function Segmented({ value, onChange, options, ariaLabel, className = '' }) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button key={opt.value} type="button" aria-pressed={opt.value === value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
  );
}

export function Spinner({ label = 'Đang xử lý' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, title, subtitle, onClose, children, footer, size = 'md', busy = false, initialFocus }) {
  const ref = useRef(null);
  const titleId = useId();
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const node = ref.current;
    const target = (initialFocus && node?.querySelector(initialFocus)) || node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
    target?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
      if (event.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div ref={ref} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', tone = 'primary', onConfirm, onCancel, confirmDisabled = false }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={confirmDisabled} data-autofocus>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="stack-sm" style={{ fontSize: 14.5, color: 'var(--text-2)' }}>
        {children}
      </div>
    </Modal>
  );
}

const TOAST_ICONS = { success: CheckCircle2, info: Info, warning: AlertTriangle, danger: AlertCircle };

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-stack no-print" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = TOAST_ICONS[t.tone] || Info;
        return (
          <div key={t.id} className={`toast tone-${t.tone}`} role={t.tone === 'danger' ? 'alert' : 'status'}>
            <Icon size={18} className="toast-icon" aria-hidden="true" />
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button type="button" className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Đóng thông báo">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Trạng thái tải dữ liệu của một trang hoặc một khối: đang tải, hoặc lỗi kèm nút thử lại. */
export function PageStatus({ error, onRetry, label = 'Đang tải dữ liệu…', compact = false }) {
  if (!error) {
    return (
      <div className={`page-status ${compact ? 'is-compact' : ''}`} role="status">
        <Spinner label={label} /> <span className="muted">{label}</span>
      </div>
    );
  }
  const offline = error.status === 0;
  return (
    <Callout
      tone={offline ? 'danger' : 'warning'}
      icon={offline ? WifiOff : AlertTriangle}
      title={offline ? 'Mất kết nối tới máy chủ An Tâm' : 'Không tải được dữ liệu'}
      actions={
        onRetry && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden="true" /> Thử lại
          </button>
        )
      }
    >
      {error.message}
    </Callout>
  );
}

/** Màn hình toàn trang lúc khởi động (đang kiểm tra phiên đăng nhập) hoặc khi không gọi được máy chủ. */
export function FullPageStatus({ error, onRetry, onLogout }) {
  return (
    <div className="fullpage-status">
      <div className="fullpage-card">
        <span className="logo-mark">
          <HeartPulse size={22} aria-hidden="true" />
        </span>
        {error ? (
          <>
            <PageStatus error={error} onRetry={onRetry} />
            {onLogout && (
              <button type="button" className="link-btn text-sm" onClick={onLogout}>
                Đăng xuất
              </button>
            )}
          </>
        ) : (
          <PageStatus label="Đang mở An Tâm…" />
        )}
      </div>
      <Toasts />
    </div>
  );
}

export function Stat({ label, value, sub, className = '' }) {
  return (
    <div className={`stat ${className}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function initials(name) {
  const clean = String(name || '?').trim();
  return clean ? clean[0].toUpperCase() : '?';
}
