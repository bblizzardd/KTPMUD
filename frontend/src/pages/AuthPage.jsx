import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, HeartPulse, Pill, ShieldCheck, Smartphone } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { fieldError } from '../api/errors.js';
import { isEmail } from '../domain/rules.js';
import { useApp } from '../app/AppContext.jsx';
import { href, navigate, ROUTES } from '../app/router.js';
import { Callout, Field, Segmented, Spinner, Toasts } from '../components/ui.jsx';

// Gợi ý tài khoản demo chỉ khi build có VITE_DEMO_ACCOUNT="email:mật khẩu" (xem README).
const DEMO_ACCOUNT = (() => {
  const raw = import.meta.env.VITE_DEMO_ACCOUNT || '';
  const at = raw.indexOf(':');
  return at > 0 ? { email: raw.slice(0, at), password: raw.slice(at + 1) } : null;
})();

function PasswordInput({ id, value, onChange, autoComplete, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-with-action">
      <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} aria-invalid={invalid} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export default function AuthPage({ mode = 'login', surface = 'web', initialRole }) {
  const { toast } = useApp();
  const [tab, setTab] = useState(mode);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [reg, setReg] = useState({ displayName: '', email: '', password: '', confirm: '', pairingCode: '' });
  const [role, setRole] = useState(initialRole === 'PATIENT' ? 'PATIENT' : 'CAREGIVER');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(mode === 'register' || Boolean(initialRole));
  const roleLabel = role === 'PATIENT' ? 'bệnh nhân' : 'người chăm sóc';

  function chooseRole(next) {
    setRole(next);
    setShowForm(true);
    setError(null);
  }

  useEffect(() => {
    setTab(mode);
    setError(null);
    if (mode === 'register') setShowForm(true);
  }, [mode]);
  useEffect(() => {
    if (['PATIENT', 'CAREGIVER'].includes(initialRole)) chooseRole(initialRole);
  }, [initialRole]);

  async function run(task) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function submitLogin(e) {
    e.preventDefault();
    run(async () => {
      await api.login({ email: login.email.trim(), password: login.password, role });
      toast({ title: 'Đăng nhập thành công' });
      navigate(role === 'PATIENT' ? ROUTES.patient : ROUTES.overview, { surface });
    });
  }

  function submitRegister(e) {
    e.preventDefault();
    const details = [];
    if (!reg.displayName.trim()) details.push({ field: 'displayName', issue: 'Nhập tên hiển thị.' });
    if (!isEmail(reg.email)) details.push({ field: 'email', issue: 'Email không hợp lệ.' });
    if (role === 'PATIENT' && !/^\d{6}$/.test(reg.pairingCode)) details.push({ field: 'pairingCode', issue: 'Nhập mã liên kết 6 số do người chăm sóc cung cấp.' });
    if (reg.password.length < 8) details.push({ field: 'password', issue: 'Mật khẩu tối thiểu 8 ký tự.' });
    else if (reg.password !== reg.confirm) details.push({ field: 'confirm', issue: 'Mật khẩu nhập lại chưa khớp.' });
    if (details.length) {
      setError({ message: details[0].issue, details });
      return;
    }
    run(async () => {
      const body = { email: reg.email.trim(), password: reg.password, displayName: reg.displayName.trim(), role, ...(role === 'PATIENT' ? { pairingCode: reg.pairingCode } : {}) };
      await api.register(body);
      await api.login(body);
      toast({ title: 'Đã tạo tài khoản', message: role === 'PATIENT' ? 'Bạn có thể dùng tài khoản này trên cả web và app.' : 'Bắt đầu bằng việc tạo hồ sơ người thân.' });
      navigate(role === 'PATIENT' ? ROUTES.patient : ROUTES.overview, { surface });
    });
  }

  const fe = (f) => fieldError(error, f);

  return (
    <div className={`auth-page ${surface === 'app' ? 'auth-app-mode' : ''}`}>
      <main className="auth-main">
        <div className="auth-card">
          <div className="welcome-heading">
            <span className="welcome-logo"><Pill size={38} aria-hidden="true" /></span>
            <h1>Chào mừng đến với An Tâm</h1>
            <p>Ứng dụng theo dõi uống thuốc & chăm sóc sức khỏe cho người cao tuổi</p>
            <div className="auth-surfaces" aria-label="Chọn giao diện">
              <a href={href(ROUTES.login, { surface: 'web', role })} aria-current={surface === 'web' ? 'page' : undefined}>Giao diện web</a>
              <a href={href(ROUTES.login, { surface: 'app', role })} aria-current={surface === 'app' ? 'page' : undefined}>Giao diện app</a>
            </div>
          </div>
          <p className="role-prompt">Vui lòng chọn vai trò để tiếp tục:</p>
          <div className="role-options">
            <button type="button" className="role-option role-patient" aria-pressed={showForm && role === 'PATIENT'} aria-controls="account-auth" onClick={() => chooseRole('PATIENT')} disabled={busy}>
              <span className="role-icon"><HeartPulse size={26} aria-hidden="true" /></span>
              <strong>Tôi là Bệnh Nhân</strong>
              <span>Giao diện chữ to, đơn giản, nhắc giờ uống thuốc rõ ràng.</span>
              <span className="role-action">Đăng nhập bệnh nhân <ArrowRight size={16} aria-hidden="true" /></span>
            </button>
            <button type="button" className="role-option role-caregiver" aria-pressed={showForm && role === 'CAREGIVER'} aria-controls="account-auth" onClick={() => chooseRole('CAREGIVER')} disabled={busy}>
              <span className="role-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
              <strong>Tôi là Người Chăm Sóc</strong>
              <span>Xem tiến độ uống thuốc từ xa, thêm & quản lý đơn thuốc.</span>
              <span className="role-action">Đăng nhập người chăm sóc <ArrowRight size={16} aria-hidden="true" /></span>
            </button>
          </div>
          {showForm && <section id="account-auth" className="caregiver-auth" aria-label={`Tài khoản ${roleLabel}`}>
          <h2>{tab === 'login' ? `Đăng nhập ${roleLabel}` : `Tạo tài khoản ${roleLabel}`}</h2>
          <p className="muted text-sm">Dùng cùng tài khoản trên web và app.</p>
          <Segmented
            ariaLabel="Đăng nhập hoặc đăng ký"
            value={tab}
            onChange={(v) => { if (!busy) { setTab(v); setError(null); } }}
            options={[
              { value: 'login', label: 'Đăng nhập' },
              { value: 'register', label: 'Đăng ký' }
            ]}
          />

          {error && (!error.details?.length || tab === 'login') && (
            <Callout tone="danger" className="mb-12">
              {error.message}
            </Callout>
          )}

          {tab === 'login' ? (
            <form className="stack" onSubmit={submitLogin} noValidate>
              <Field label="Email" htmlFor="login-email">
                <input id="login-email" className="input" type="email" autoComplete="username" value={login.email} onChange={(e) => setLogin((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Mật khẩu" htmlFor="login-password">
                <PasswordInput id="login-password" autoComplete="current-password" value={login.password} onChange={(e) => setLogin((f) => ({ ...f, password: e.target.value }))} />
              </Field>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                {busy && <Spinner />} Đăng nhập
              </button>
              {DEMO_ACCOUNT && role === 'CAREGIVER' && (
                <div className="demo-hint">
                  <span>
                    Tài khoản demo: <span className="mono">{DEMO_ACCOUNT.email}</span> / <span className="mono">{DEMO_ACCOUNT.password}</span>
                  </span>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLogin({ ...DEMO_ACCOUNT })}>
                    Điền sẵn
                  </button>
                </div>
              )}
            </form>
          ) : (
            <form className="stack" onSubmit={submitRegister} noValidate>
              <Field label="Tên hiển thị" required htmlFor="reg-name" error={fe('displayName')} hint={role === 'PATIENT' ? 'Ví dụ: Bố, Mẹ' : 'Ví dụ: Bình (con trai)'}>
                <input id="reg-name" className="input" maxLength={100} autoComplete="nickname" value={reg.displayName} onChange={(e) => setReg((f) => ({ ...f, displayName: e.target.value }))} aria-invalid={Boolean(fe('displayName'))} />
              </Field>
              {role === 'PATIENT' && <Field label="Mã liên kết hồ sơ" required htmlFor="reg-pairing" error={fe('pairingCode')} hint="Chỉ cần khi tạo tài khoản lần đầu. Người chăm sóc lấy mã bệnh nhân tại Hồ sơ & thiết bị → Tạo mã 6 số.">
                <input id="reg-pairing" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={reg.pairingCode} onChange={e => setReg(f => ({ ...f, pairingCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} aria-invalid={Boolean(fe('pairingCode'))} />
              </Field>}
              <Field label="Email" required htmlFor="reg-email" error={fe('email')}>
                <input id="reg-email" className="input" type="email" autoComplete="email" value={reg.email} onChange={(e) => setReg((f) => ({ ...f, email: e.target.value }))} aria-invalid={Boolean(fe('email'))} />
              </Field>
              <div className="grid-2">
                <Field label="Mật khẩu" required htmlFor="reg-pass" error={fe('password')} hint="Tối thiểu 8 ký tự">
                  <PasswordInput id="reg-pass" autoComplete="new-password" value={reg.password} onChange={(e) => setReg((f) => ({ ...f, password: e.target.value }))} invalid={Boolean(fe('password'))} />
                </Field>
                <Field label="Nhập lại mật khẩu" required htmlFor="reg-confirm" error={fe('confirm')}>
                  <PasswordInput id="reg-confirm" autoComplete="new-password" value={reg.confirm} onChange={(e) => setReg((f) => ({ ...f, confirm: e.target.value }))} invalid={Boolean(fe('confirm'))} />
                </Field>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
                {busy && <Spinner />} Tạo tài khoản
              </button>
              <p className="fine-print">Mật khẩu chỉ lưu dạng băm trên máy chủ. Không nhập thông tin định danh thật của người bệnh.</p>
            </form>
          )}

          </section>}
          <div className="auth-device-link">
            <Smartphone size={18} aria-hidden="true" />
            <span>
              Cách kết nối bổ sung: <a href={href(ROUTES.device, { pairing: '1', surface })}>Ghép thiết bị bằng mã 6 số <ArrowRight size={14} aria-hidden="true" /></a>
            </span>
          </div>
        </div>
      </main>
      <Toasts />
    </div>
  );
}
