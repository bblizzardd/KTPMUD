import { useState } from 'react';
import { AlertCircle, BellRing, Clock, FlaskConical, Lock, RotateCcw, Smartphone, X } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { clock, syncClock } from '../app/clock.js';
import { useApp } from '../app/AppContext.jsx';
import { useNow, usePref } from '../app/hooks.js';
import { invalidateAll } from '../app/query.js';
import { addDays, dayLabel, fmtDateTime, fmtDuration, fmtTime, toDateKey } from '../lib/time.js';
import { Badge, Spinner, Switch } from '../components/ui.jsx';

/**
 * Công cụ kiểm thử — KHÔNG thuộc sản phẩm. Tua đồng hồ của máy chủ (chỉ khi Backend bật
 * ENABLE_DEV_TOOLS=true) để thấy nhắc nhở, bỏ lỡ, cảnh báo ngay mà không phải chờ nhiều giờ.
 */
export default function DemoPanel() {
  const { patient, call, toast, annotate, setAnnotate, setPhoneOpen } = useApp();
  const [open, setOpen] = usePref('antam.v1.demoOpen', false);
  const [busy, setBusy] = useState(false);
  const now = useNow(5_000);
  const offset = clock.offsetMs();
  const devTools = clock.devTools();

  async function advance(body, describe) {
    setBusy(true);
    const before = clock.now();
    const res = await call(() => api.advanceDevClock(body), { errorTitle: 'Không tua được đồng hồ' });
    await syncClock();
    invalidateAll();
    setBusy(false);
    if (res.ok) toast({ tone: 'info', title: `Đã tua tới ${fmtDateTime(res.result.now)}`, message: describe || `Nhanh thêm ${fmtDuration((Date.parse(res.result.now) - before) / 60_000)}; bộ lập lịch trên máy chủ đã chạy.` });
  }

  /** Tìm mốc tiếp theo trong lịch cữ của hồ sơ đang xem rồi tua tới đó. */
  async function jump(target) {
    if (!patient) return;
    const today = toDateKey(clock.now());
    const res = await call(() => api.listDoses(patient.id, { from: today, to: addDays(today, 2) }), { errorTitle: 'Không đọc được lịch cữ' });
    if (!res.ok) return;
    const nowMs = clock.now();
    if (target === 'NEXT_REMINDER') {
      const next = res.result.find((d) => d.status === 'SCHEDULED' && Date.parse(d.scheduledAt) > nowMs);
      if (!next) return toast({ tone: 'warning', title: 'Không có cữ nào sắp tới trong 2 ngày' });
      return advance({ to: new Date(Date.parse(next.scheduledAt) + 30_000).toISOString() }, `Đến giờ cữ ${fmtTime(next.scheduledAt)} ${dayLabel(next.date, nowMs).toLowerCase()}: điện thoại sẽ đổ chuông trong vài giây.`);
    }
    const pending = res.result.find((d) => d.status === 'PENDING') || res.result.find((d) => d.status === 'SCHEDULED' && Date.parse(d.scheduledAt) > nowMs);
    if (!pending) return toast({ tone: 'warning', title: 'Không có cữ đang chờ hoặc sắp tới' });
    return advance({ to: new Date(Date.parse(pending.deadlineAt) + 60_000).toISOString() }, `Quá hạn xác nhận ${fmtTime(pending.deadlineAt)}: cữ chuyển sang Bỏ lỡ và máy chủ gửi cảnh báo.`);
  }

  async function tryDeleteAudit() {
    if (!patient) return;
    const page = await call(() => api.listAuditLogs(patient.id, { size: 1 }), { silent: true });
    const first = page.ok ? page.result.items[0] : null;
    if (!first) return toast({ tone: 'warning', title: 'Chưa có dòng nhật ký nào để thử' });
    const res = await call(() => api.attemptAuditDelete(patient.id, first.id), { silent: true, refresh: `p:${patient.id}:audit` });
    if (res.ok) toast({ tone: 'danger', title: 'Máy chủ KHÔNG chặn xóa nhật ký', message: 'Đây là lỗi cần báo lại.' });
    else if (res.error?.status === 405) toast({ tone: 'success', title: 'Máy chủ từ chối (405 Method Not Allowed)', message: `${res.error.message} Lần thử này cũng được ghi vào nhật ký.` });
    else toast({ tone: 'warning', title: 'Kết quả không như mong đợi', message: res.error?.message });
  }

  return (
    <>
      <button type="button" className="demo-fab no-print" aria-expanded={open} onClick={() => setOpen(!open)}>
        <FlaskConical size={16} aria-hidden="true" /> Công cụ kiểm thử
      </button>
      {open && (
        <div className="demo-panel no-print" role="dialog" aria-label="Công cụ kiểm thử">
          <div className="demo-panel-head">
            <div style={{ flex: 1 }}>
              <strong>Công cụ kiểm thử</strong>
              <p className="muted text-xs">Không thuộc sản phẩm. Dùng khi kiểm thử để rút ngắn thời gian chờ.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Đóng công cụ kiểm thử">
              <X size={17} />
            </button>
          </div>

          <div className="demo-section">
            <h4>Đồng hồ máy chủ & bộ lập lịch</h4>
            <div className="row" style={{ marginBottom: 8 }}>
              <Clock size={16} aria-hidden="true" />
              <strong className="num">{fmtTime(now)}</strong>
              <span className="muted text-sm">{dayLabel(toDateKey(now), Date.now())}</span>
              {offset >= 60_000 && <Badge tone="warning">nhanh hơn {fmtDuration(offset / 60_000)}</Badge>}
              {busy && <Spinner />}
            </div>
            {devTools ? (
              <>
                <p className="muted text-xs" style={{ marginBottom: 10 }}>
                  Máy chủ quét mỗi 15 giây: đến giờ thì cữ chuyển Đang chờ; hơn 60 phút sau giờ hẹn chưa xác nhận sẽ chuyển Bỏ lỡ. Uống trong khoảng ±60 phút được tính đúng giờ. Đồng hồ chỉ tua tiến; muốn về giờ thực, chạy lại dữ liệu mẫu.
                </p>
                <div className="demo-buttons">
                  <button type="button" className="btn btn-secondary" onClick={() => jump('NEXT_REMINDER')} disabled={!patient || busy}>
                    <BellRing size={15} /> Tới giờ cữ kế tiếp
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => jump('PENDING_DEADLINE')} disabled={!patient || busy}>
                    <AlertCircle size={15} /> Cho cữ đang chờ quá hạn
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => advance({ advanceMinutes: 15 })} disabled={busy}>
                    +15 phút
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => advance({ advanceMinutes: 60 })} disabled={busy}>
                    +1 giờ
                  </button>
                </div>
              </>
            ) : (
              <p className="muted text-xs">
                Máy chủ đang chạy giờ thực. Muốn tua giờ để kiểm thử nhắc nhở và bỏ lỡ, đặt <span className="mono">ENABLE_DEV_TOOLS=true</span> trong <span className="mono">backend/.env</span> rồi khởi động lại máy chủ.
              </p>
            )}
          </div>

          <div className="demo-section">
            <h4>Tình huống</h4>
            <div className="switch-row">
              <span>Hiện mã yêu cầu (UC/FR/BR) trên giao diện</span>
              <Switch checked={annotate} onChange={setAnnotate} label="Hiện mã yêu cầu" />
            </div>
            <div className="demo-buttons" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={tryDeleteAudit} disabled={!patient}>
                <Lock size={15} /> Thử xóa nhật ký (TC-39)
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPhoneOpen(true)}>
                <Smartphone size={15} /> Mở điện thoại
              </button>
            </div>
          </div>

          <div className="demo-section">
            <h4>Dữ liệu</h4>
            <p className="muted text-xs">
              <RotateCcw size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Khôi phục dữ liệu mẫu: tắt máy chủ, chạy <span className="mono">npm run reset-demo</span> trong thư mục <span className="mono">backend</span> rồi khởi động lại. Lệnh này cũng đưa đồng hồ về giờ thực.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
