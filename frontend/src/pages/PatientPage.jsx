import { useEffect, useState } from 'react';
import { LogOut, Monitor, Pill, Smartphone } from 'lucide-react';
import { useApp } from '../app/AppContext.jsx';
import { href, ROUTES } from '../app/router.js';
import { ConfirmDialog, Toasts } from '../components/ui.jsx';
import DeviceApp from '../device/DeviceApp.jsx';
import { ensureAccountPhone, usePhones } from '../device/phones.js';
import { setOnline } from '../device/deviceClient.js';

/** The same patient account and medication workflow on web and app. */
export default function PatientPage({ account, surface = 'web' }) {
  const { logout } = useApp();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const phone = usePhones().find(p => p.accountId === account.id);
  useEffect(() => {
    const current = ensureAccountPhone(account);
    const online = () => { void setOnline(current, true); };
    const offline = () => { void setOnline(current, false); };
    if (navigator.onLine) online();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [account.id]);
  return (
    <div className={`patient-account-page ${surface === 'app' ? 'patient-app-mode' : ''}`}>
      <header className="topbar">
        <a className="topbar-brand" href={href(ROUTES.patient)}><span className="logo-mark"><Pill size={26} /></span><strong>AN TÂM</strong></a>
        <span className="role-badge">Bệnh nhân</span>
        <div className="topbar-right">
          <a className="topbar-phone-btn" href={href(ROUTES.patient, { surface: surface === 'app' ? 'web' : 'app' })}>
            {surface === 'app' ? <Monitor size={18} /> : <Smartphone size={18} />} <span className="label">{surface === 'app' ? 'Giao diện web' : 'Giao diện app'}</span>
          </a>
          <button className="topbar-icon-btn" type="button" aria-label="Đăng xuất" onClick={() => phone?.queue.length ? setConfirmLogout(true) : logout()}><LogOut size={20} /></button>
        </div>
      </header>
      <main className="patient-account-content">
        <p className="patient-account-identity">{account.displayName} · Tài khoản bệnh nhân</p>
        {phone && <DeviceApp key={phone.id} phone={phone} />}
      </main>
      <ConfirmDialog open={confirmLogout} onCancel={() => setConfirmLogout(false)} onConfirm={logout} title="Còn xác nhận chưa gửi" confirmLabel="Đăng xuất">
        Còn {phone?.queue.length || 0} xác nhận đang lưu trên máy. Kết nối mạng để gửi trước khi đăng xuất; nếu tiếp tục, các xác nhận chưa gửi sẽ bị xóa khỏi phiên này.
      </ConfirmDialog>
      <Toasts />
    </div>
  );
}
