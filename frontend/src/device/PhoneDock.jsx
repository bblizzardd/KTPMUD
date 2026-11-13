import { ExternalLink, Plus, RotateCcw, Wifi, WifiOff, X } from 'lucide-react';
import { useApp } from '../app/AppContext.jsx';
import { href, ROUTES } from '../app/router.js';
import DeviceApp from './DeviceApp.jsx';
import { forgetPairing, setOnline } from './deviceClient.js';
import { addPhone, usePhones } from './phones.js';

export function describePhone(phone) {
  if (!phone.token) return 'chưa ghép nối';
  if (phone.cache?.revoked) return 'đã bị ngắt kết nối';
  const profile = phone.cache?.profile;
  if (!profile) return 'đã ghép nối';
  return profile.role === 'PATIENT' ? `bệnh nhân · ${profile.patientAlias}` : `người nhà ${profile.ownerAlias} · ${profile.patientAlias}`;
}

export function syncMessage(phone, summary) {
  if (!summary) return null;
  const parts = [];
  if (summary.sent) parts.push(`đã gửi ${summary.sent} xác nhận lưu tạm`);
  if (summary.already) parts.push(`${summary.already} cữ đã có người xác nhận trước`);
  if (summary.rejected.length) parts.push(`${summary.rejected.length} xác nhận bị từ chối: ${summary.rejected[0]}`);
  if (summary.revoked) parts.push('thiết bị đã bị thu hồi nên không gửi được');
  if (summary.pending) parts.push(`còn ${summary.pending} xác nhận chờ gửi vì chưa kết nối được máy chủ`);
  if (!parts.length) return null;
  return { tone: summary.rejected.length || summary.revoked || summary.pending ? 'warning' : 'success', title: `${phone.name} có mạng trở lại`, message: parts.join('; ') };
}

export function PhoneFrame({ children }) {
  return (
    <div className="phone-frame">
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">{children}</div>
    </div>
  );
}

/** Thanh điều khiển của bộ mô phỏng: chọn điện thoại, bật/tắt mạng (UC-07 3c), gỡ ghép nối. */
export function PhoneControls({ phones, phone, onSelect, notify, standalone = false }) {
  async function toggleNetwork() {
    const summary = await setOnline(phone, !phone.online);
    const msg = syncMessage(phone, summary);
    if (msg) notify(msg);
  }
  return (
    <div className="phone-controls">
      <label className="sr-only" htmlFor={`phone-pick-${standalone ? 's' : 'd'}`}>
        Chọn điện thoại
      </label>
      <select id={`phone-pick-${standalone ? 's' : 'd'}`} className="select" value={phone.id} onChange={(e) => onSelect(e.target.value)}>
        {phones.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {describePhone(p)}
          </option>
        ))}
      </select>
      <div className="phone-controls-row">
        <button type="button" className={`btn btn-sm ${phone.online ? 'btn-secondary' : 'btn-danger-ghost'}`} onClick={toggleNetwork} aria-pressed={!phone.online} title="Giả lập mất mạng để thử lưu tạm và gửi lại">
          {phone.online ? <Wifi size={15} /> : <WifiOff size={15} />}
          {phone.online ? 'Có mạng' : 'Mất mạng'}
        </button>
        {phone.token && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => forgetPairing(phone)} title="Như gỡ ứng dụng: điện thoại quên token, cần ghép nối lại">
            <RotateCcw size={15} /> Gỡ ghép nối
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSelect(addPhone().id)} title="Thêm một điện thoại chưa ghép nối">
          <Plus size={15} /> Thêm máy
        </button>
        {!standalone && (
          <a className="btn btn-sm btn-ghost" href={href(ROUTES.device, { phone: phone.id })} target="_blank" rel="noreferrer" title="Mở ứng dụng điện thoại trong cửa sổ riêng">
            <ExternalLink size={15} /> Cửa sổ riêng
          </a>
        )}
      </div>
    </div>
  );
}

export default function PhoneDock({ onClose }) {
  const { phoneId, setPhoneId, toast } = useApp();
  const phones = usePhones().filter(p => !p.accountId);
  const phone = phones.find((p) => p.id === phoneId) || phones[0];
  if (!phone) return null;
  return (
    <aside className="phone-dock no-print" aria-label="Điện thoại mô phỏng">
      <div className="phone-dock-head">
        <div>
          <strong>Điện thoại mô phỏng</strong>
          <span>Đăng nhập bệnh nhân / người chăm sóc, hoặc ghép thiết bị bằng mã</span>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Đóng điện thoại mô phỏng">
          <X size={18} />
        </button>
      </div>
      <PhoneControls phones={phones} phone={phone} onSelect={setPhoneId} notify={toast} />
      <div className="phone-stage">
        <PhoneFrame>
          <DeviceApp key={phone.id} phone={phone} />
        </PhoneFrame>
      </div>
    </aside>
  );
}
