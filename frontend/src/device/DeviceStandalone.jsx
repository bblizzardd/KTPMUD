import { ArrowLeft } from 'lucide-react';
import { useApp } from '../app/AppContext.jsx';
import { usePref } from '../app/hooks.js';
import { href, ROUTES } from '../app/router.js';
import { Toasts } from '../components/ui.jsx';
import DeviceApp from './DeviceApp.jsx';
import { PhoneControls, PhoneFrame } from './PhoneDock.jsx';
import { usePhones } from './phones.js';

/** Ứng dụng điện thoại chạy toàn màn hình (#/thiet-bi): mở trên cửa sổ riêng hoặc điện thoại thật. */
export default function DeviceStandalone({ route }) {
  const { toast } = useApp();
  const [savedId, setSavedId] = usePref('antam.v1.standalonePhone', 'phone-1');
  const phones = usePhones().filter(p => !p.accountId);
  const wanted = route.query.phone || savedId;
  const phone = phones.find((p) => p.id === wanted) || phones[0];

  function select(id) {
    setSavedId(id);
    window.location.hash = href(ROUTES.device, { phone: id, pairing: '1' });
  }

  return (
    <div className="device-standalone">
      <div className="device-standalone-bar">
        <a className="btn btn-sm btn-ghost" href={href(ROUTES.overview)}>
          <ArrowLeft size={15} /> Về trang chính
        </a>
        <a className="btn btn-sm btn-ghost" href={href(ROUTES.login, { surface: 'app' })}>Đăng nhập tài khoản trên app</a>
      </div>
      {phone && (
        <div className="device-standalone-stage">
          <div className="device-standalone-controls">
            <PhoneControls phones={phones} phone={phone} onSelect={select} notify={toast} standalone />
          </div>
          <PhoneFrame>
            <DeviceApp key={phone.id} phone={phone} />
          </PhoneFrame>
        </div>
      )}
      <Toasts />
    </div>
  );
}
