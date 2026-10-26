import { useEffect, useState } from 'react';
import { BellRing, Building2, Eye, EyeOff, FileText, HeartPulse, ShieldCheck, Smartphone } from 'lucide-react';
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

export default function AuthPage({ mode = 'login' }) {
  const { toast } = useApp();
  const [tab, setTab] = useState(mode);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [reg, setReg] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(mode);
    setError(null);
  }, [mode]);

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
      await api.login({ email: login.email.trim(), password: login.password });
      toast({ title: 'Đăng nhập thành công' });
      navigate(ROUTES.overview);
    });
  }

  function submitRegister(e) {
    e.preventDefault();
    const details = [];
    if (!reg.displayName.trim()) details.push({ field: 'displayName', issue: 'Nhập tên hiển thị.' });
    if (!isEmail(reg.email)) details.push({ field: 'email', issue: 'Email không hợp lệ.' });
    if (reg.password.length < 8) details.push({ field: 'password', issue: 'Mật khẩu tối thiểu 8 ký tự.' });
    else if (reg.password !== reg.confirm) details.push({ field: 'confirm', issue: 'Mật khẩu nhập lại chưa khớp.' });
    if (details.length) {
      setError({ message: details[0].issue, details });
      return;
    }
    run(async () => {
      const body = { email: reg.email.trim(), password: reg.password, displayName: reg.displayName.trim() };
      await api.register(body);
      await api.login(body);
      toast({ title: 'Đã tạo tài khoản', message: 'Bắt đầu bằng việc tạo hồ sơ người thân.' });
      navigate(ROUTES.overview);
    });
  }

  const fe = (f) => fieldError(error, f);

  return (
    <div className="auth-page">
      <section className="auth-brand">
        <div className="auth-logo">
          <span className="logo-mark">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          An Tâm
        </div>
        <div>
          <h1>Biết bố mẹ đã uống thuốc chưa — không cần gọi hỏi nhiều lần.</h1>
          <p className="lead">Hỗ trợ người chăm sóc theo dõi điều trị ngoại trú đái tháo đường type 2 cho người thân cao tuổi.</p>
        </div>
        <div className="auth-points">
          <div className="auth-point">
            <span className="auth-point-icon">
              <BellRing size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>Nhắc đúng giờ, một nút “Đã uống”</strong>
              <span>Chữ lớn, không cần đăng nhập trên điện thoại của bố mẹ.</span>
            </div>
          </div>
          <div className="auth-point">
            <span className="auth-point-icon">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>Cảnh báo khi bỏ lỡ cữ</strong>
              <span>Gửi tới bạn và người nhà sống cùng được ủy quyền.</span>
            </div>
          </div>
          <div className="auth-point">
            <span className="auth-point-icon">
              <FileText size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>Báo cáo 30 ngày cho bác sĩ</strong>
              <span>Phân biệt tự xác nhận, xác nhận hộ và xác nhận muộn.</span>
            </div>
          </div>
        </div>
        <div className="auth-scope">
          <Building2 size={15} aria-hidden="true" /> Phạm vi: Khoa Nội tiết – Đái tháo đường, Bệnh viện Hữu Nghị
        </div>
      </section>

      <main className="auth-main">
        <div className="auth-card">
          <h2>{tab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản người chăm sóc'}</h2>
          <p className="muted text-sm">Dành cho người con / người chăm sóc chính.</p>
          <Segmented
            ariaLabel="Đăng nhập hoặc đăng ký"
            value={tab}
            onChange={(v) => navigate(v === 'login' ? ROUTES.login : ROUTES.register)}
            options={[
              { value: 'login', label: 'Đăng nhập' },
              { value: 'register', label: 'Đăng ký' }
            ]}
          />

          {error && !error.details?.length && (
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
              {DEMO_ACCOUNT && (
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
              <Field label="Tên hiển thị" required htmlFor="reg-name" error={fe('displayName')} hint="Ví dụ: Bình (con trai)">
                <input id="reg-name" className="input" maxLength={100} autoComplete="nickname" value={reg.displayName} onChange={(e) => setReg((f) => ({ ...f, displayName: e.target.value }))} aria-invalid={Boolean(fe('displayName'))} />
              </Field>
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

          <div className="auth-device-link">
            <Smartphone size={18} aria-hidden="true" />
            <span>
              Bạn là bệnh nhân hoặc người nhà? <a href={href(ROUTES.device)}>Mở ứng dụng trên điện thoại</a>
            </span>
          </div>
        </div>
      </main>
      <Toasts />
    </div>
  );
}
