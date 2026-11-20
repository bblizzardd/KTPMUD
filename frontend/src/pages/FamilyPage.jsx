import { useRef, useState } from 'react';
import { KeyRound, Pencil, Smartphone, UserMinus, UserPlus } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { fieldError } from '../api/errors.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { combine, useQuery } from '../app/query.js';
import { SLOTS, SLOT_META, PAIRING_CODE_TTL_MINUTES } from '../domain/constants.js';
import { ageFromBirthYear, fmtDate, fmtDateTime, fmtTime, pad2 } from '../lib/time.js';
import { Badge, Callout, Card, ConfirmDialog, EmptyState, Field, PageHeader, PageStatus, Spinner } from '../components/ui.jsx';
import PatientFormModal from '../shell/PatientFormModal.jsx';
import { addPhone, listPhones } from '../device/phones.js';

function PairingCard({ patient, delegates, devices }) {
  const { call, pairingCodes, setPairingCodes, setPhoneOpen, setPhoneId } = useApp();
  const nowMs = useNow(1_000);
  const [target, setTarget] = useState('PATIENT');
  const [busy, setBusy] = useState(false);
  const generating = useRef(false);
  const active = delegates.filter((d) => d.active);
  const current = pairingCodes[patient.id];
  const remaining = current ? Date.parse(current.expiresAt) - nowMs : 0;
  const codeQ = useQuery(current?.codeId ? patientKey(patient.id, `pairing:${current.codeId}`) : null,
    () => api.getPairingCodeStatus(patient.id, current.codeId), { refreshMs: 3000 });
  // Match the exact code, not a device timestamp from a previous login or simulated clock.
  const pairedDevice = current
    ? devices
        .filter((d) => d.pairingCodeId === current.codeId)
        .sort((a, b) => b.pairedAt.localeCompare(a.pairedAt))[0]
    : null;
  const accountLinked = current?.role === 'PATIENT' && current.hadLoginAccount === false && patient.hasLoginAccount;
  const valid = current && !pairedDevice && !accountLinked && !codeQ.data?.used && remaining > 0;
  // Trong lúc mã còn hiệu lực, hỏi lại danh sách thiết bị để thấy ngay khi điện thoại ghép xong.
  useQuery(valid ? patientKey(patient.id, 'devices') : null, () => api.listDevices(patient.id), { refreshMs: 3000 });
  useQuery(valid && current.role === 'PATIENT' ? 'patients' : null, api.listPatients, { refreshMs: 3000 });

  async function generate(forTarget = target) {
    if (generating.current) return;
    generating.current = true;
    const isPatient = forTarget === 'PATIENT';
    const body = isPatient ? { role: 'PATIENT' } : { role: 'DELEGATE', delegateId: forTarget };
    setBusy(true);
    const res = await call(() => api.createPairingCode(patient.id, body), { errorTitle: 'Chưa tạo được mã', refresh: patientKey(patient.id, 'audit') });
    generating.current = false;
    setBusy(false);
    if (!res.ok) return;
    const who = isPatient ? `điện thoại của ${patient.alias}` : `điện thoại của ${active.find((d) => d.id === forTarget)?.alias} (người nhà)`;
    setTarget(forTarget);
    setPairingCodes((map) => ({ ...map, [patient.id]: { ...res.result, ...body, who, hadLoginAccount: Boolean(patient.hasLoginAccount) } }));
  }

  function openSimulator() {
    const free = listPhones().find((p) => !p.token) || addPhone();
    setPhoneId(free.id);
    setPhoneOpen(true);
  }

  const clear = () => setPairingCodes((map) => ({ ...map, [patient.id]: undefined }));

  return (
    <Card title="Liên kết tài khoản & thiết bị">
      {valid ? (
        <div className="pair-active">
          <div className="pair-code" aria-live="polite">
            <span className="pair-for">Mã cho {current.who}</span>
            <div className="pair-digits" aria-label={`Mã ghép nối ${current.code.split('').join(' ')}`}>
              {current.code.split('').map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </div>
            <div className="pair-timer">
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${Math.max(0, (remaining / (PAIRING_CODE_TTL_MINUTES * 60_000)) * 100)}%` }} />
              </div>
              <span className="num">
                Hết hạn sau {Math.floor(remaining / 60_000)}:{pad2(Math.floor((remaining % 60_000) / 1000))}
              </span>
            </div>
          </div>
          <p className="muted text-sm">{current.role === 'PATIENT' && !patient.hasLoginAccount ? 'Nhập mã khi đăng ký tài khoản bệnh nhân hoặc ghép điện thoại.' : 'Nhập mã trên điện thoại cần ghép.'}</p>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={openSimulator}>
              <Smartphone size={16} aria-hidden="true" /> Nhập mã trên điện thoại mô phỏng
            </button>
            <button type="button" className="btn btn-ghost" onClick={clear}>
              Đóng mã
            </button>
            <button type="button" className="btn btn-primary" onClick={() => generate(current.role === 'PATIENT' ? 'PATIENT' : current.delegateId)} disabled={busy}>
              {busy ? <Spinner /> : <KeyRound size={16} aria-hidden="true" />} Tạo lại mã
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          {accountLinked && <Callout tone="success" title="Đã liên kết tài khoản bệnh nhân" actions={<button type="button" className="btn btn-sm btn-secondary" onClick={clear}>Đóng</button>} />}
          {current && pairedDevice && (
            <Callout tone="success" title={`Đã ghép nối lúc ${fmtTime(pairedDevice.pairedAt)}`} actions={<button type="button" className="btn btn-sm btn-secondary" onClick={clear}>Đóng</button>}>
              {pairedDevice.deviceName} của {pairedDevice.ownerAlias} đã được ghép với vai trò {pairedDevice.role === 'PATIENT' ? 'Bệnh nhân' : 'Người nhà'}.
            </Callout>
          )}
          {current && !pairedDevice && !accountLinked && (
            <Callout tone="warning" title={codeQ.data?.replaced ? 'Mã đã được thay thế' : codeQ.data?.used ? 'Mã đã được sử dụng' : 'Mã đã hết hạn'} actions={<button type="button" className="btn btn-sm btn-secondary" onClick={clear}>Đóng</button>}>
              Tạo mã mới cho {current.who}.
            </Callout>
          )}
          <div className="pair-form">
            <Field label="Tạo mã cho" htmlFor="pair-target">
              <select id="pair-target" className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="PATIENT">{patient.alias} (bệnh nhân · tài khoản hoặc thiết bị)</option>
                {active.map((d) => (
                  <option key={d.id} value={d.id}>
                    Điện thoại của {d.alias} (người nhà · {d.relation})
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" className="btn btn-primary" onClick={() => generate()} disabled={busy}>
              {busy ? <Spinner /> : <KeyRound size={16} aria-hidden="true" />} {current ? 'Tạo lại mã' : 'Tạo mã 6 số'}
            </button>
          </div>
          {active.length === 0 && <p className="muted text-sm">Ủy quyền người nhà trước khi ghép máy cho họ.</p>}
        </div>
      )}
    </Card>
  );
}

export default function FamilyPage() {
  const { patient, call, toast } = useApp();
  const nowMs = useNow(30_000);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ alias: '', relation: '' });
  const [formError, setFormError] = useState(null);
  const [revokeDev, setRevokeDev] = useState(null);
  const [revokeDel, setRevokeDel] = useState(null);
  const [adding, setAdding] = useState(false);
  const devicesQ = useQuery(patientKey(patient.id, 'devices'), () => api.listDevices(patient.id));
  const delegatesQ = useQuery(patientKey(patient.id, 'delegates'), () => api.listDelegates(patient.id));
  const state = combine(devicesQ, delegatesQ);
  const refresh = patientKey(patient.id);

  if (!state.ready) {
    return (
      <>
        <PageHeader title="Hồ sơ & thiết bị" />
        <PageStatus error={state.error} onRetry={state.reload} />
      </>
    );
  }

  const devices = [...devicesQ.data].sort((a, b) => Number(b.active) - Number(a.active) || b.pairedAt.localeCompare(a.pairedAt));
  const delegates = delegatesQ.data;
  const delegateName = (id) => delegates.find((d) => d.id === id)?.alias;

  async function addDelegate(e) {
    e.preventDefault();
    if (adding) return;
    const body = { alias: form.alias.trim(), relation: form.relation.trim() };
    const details = [];
    if (!body.alias) details.push({ field: 'alias', issue: 'Nhập tên gọi người nhà.' });
    if (!body.relation) details.push({ field: 'relation', issue: 'Nhập quan hệ với bệnh nhân.' });
    if (details.length) {
      setFormError({ message: details[0].issue, details });
      return;
    }
    setAdding(true);
    const res = await call(() => api.createDelegate(patient.id, body), { silent: true, refresh });
    setAdding(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setFormError(null);
    setForm({ alias: '', relation: '' });
    toast({ title: `Đã ủy quyền "${res.result.alias}" xác nhận hộ`, message: 'Bước tiếp theo: tạo mã ghép nối cho điện thoại của người nhà.' });
  }

  return (
    <>
      <PageHeader title="Hồ sơ & thiết bị" />

      <Card
        title="Hồ sơ bệnh nhân"
        actions={
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>
            <Pencil size={15} aria-hidden="true" /> Sửa hồ sơ & giờ nhắc
          </button>
        }
      >
        <div className="stack">
          <dl className="kv">
            <div>
              <dt>Tên gọi trong gia đình</dt>
              <dd>{patient.alias}</dd>
            </div>

            <div>
              <dt>Năm sinh</dt>
              <dd>
                {patient.birthYear} ({ageFromBirthYear(patient.birthYear, nowMs)} tuổi)
              </dd>
            </div>
            <div>
              <dt>Ngưỡng chuyển sang Bỏ lỡ</dt>
              <dd>{patient.missedThresholdMinutes} phút sau giờ nhắc</dd>
            </div>
            <div>
              <dt>Tạo hồ sơ</dt>
              <dd>{fmtDate(patient.createdAt)}</dd>
            </div>
          </dl>
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>
              Giờ nhắc theo buổi
            </div>
            <div className="chips">
              {SLOTS.map((s) => (
                <span key={s} className="chip chip-static">
                  {SLOT_META[s].long} <span className="chip-sub num">{patient.reminderTimes.find((r) => r.slot === s)?.time}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <PairingCard patient={patient} delegates={delegates} devices={devices} />

      <Card title={`Thiết bị đã ghép nối (${devices.filter((d) => d.active).length} đang hoạt động)`}>
        {devices.length === 0 ? (
          <EmptyState icon={Smartphone} title="Chưa ghép điện thoại nào">
            Tạo mã ở mục Ghép nối điện thoại rồi nhập trên điện thoại của {patient.alias}.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thiết bị</th>
                  <th>Vai trò</th>
                  <th>Ghép nối lúc</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="strong">{d.deviceName}</div>
                      <div className="muted text-xs">
                        {d.platform === 'IOS' ? 'iOS' : 'Android'}
                      </div>
                    </td>
                    <td>{d.role === 'PATIENT' ? <Badge tone="success">Bệnh nhân · {patient.alias}</Badge> : <Badge tone="delegate">Người nhà · {delegateName(d.delegateId)}</Badge>}</td>
                    <td className="nowrap">{fmtDateTime(d.pairedAt)}</td>
                    <td>
                      {d.active && Date.parse(d.expiresAt) > nowMs ? (
                        <Badge tone="success" dot>
                          Đang hoạt động
                        </Badge>
                      ) : d.active ? (
                        <Badge tone="muted">Token hết hạn {fmtDate(d.expiresAt)}</Badge>
                      ) : (
                        <Badge tone="muted">Đã thu hồi{d.revokedAt ? ` ${fmtDate(d.revokedAt)}` : ''}</Badge>
                      )}
                    </td>
                    <td className="col-num">
                      {d.active && (
                        <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => setRevokeDev(d)}>
                          Thu hồi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Người nhà được ủy quyền">
        <div className="stack">
          {delegates.length === 0 ? (
            <p className="muted">Chưa có người nhà được ủy quyền.</p>
          ) : (
            <ul className="delegate-list">
              {delegates.map((d) => {
                const count = devices.filter((x) => x.delegateId === d.id && x.active).length;
                return (
                  <li key={d.id} className={d.active ? '' : 'is-revoked'}>
                    <span className="avatar">{d.alias[0]?.toUpperCase()}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong">
                        {d.alias} <span className="muted text-sm">· {d.relation}</span>
                      </div>
                      <div className="muted text-xs">
                        {d.active ? `Ủy quyền từ ${fmtDate(d.createdAt)} · ${count} điện thoại đang hoạt động` : 'Đã thu hồi quyền xác nhận hộ'}
                      </div>
                    </div>
                    {d.active ? (
                      <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => setRevokeDel(d)}>
                        <UserMinus size={15} aria-hidden="true" /> Thu hồi quyền
                      </button>
                    ) : (
                      <Badge tone="muted">Đã thu hồi</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <form className="delegate-form" onSubmit={addDelegate} noValidate>
            <Field label="Tên gọi người nhà" required htmlFor="del-alias" error={fieldError(formError, 'alias')}>
              <input id="del-alias" className="input" maxLength={50} placeholder="Ví dụ: Mẹ, Cô Út" value={form.alias} onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))} />
            </Field>
            <Field label="Quan hệ với bệnh nhân" required htmlFor="del-relation" error={fieldError(formError, 'relation')}>
              <input id="del-relation" className="input" maxLength={50} placeholder="Ví dụ: Vợ, sống cùng nhà" value={form.relation} onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))} />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? <Spinner /> : <UserPlus size={16} aria-hidden="true" />} Ủy quyền
            </button>
          </form>
        </div>
      </Card>

      <PatientFormModal open={editing} mode="edit" patient={patient} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={Boolean(revokeDev)}
        title="Thu hồi thiết bị?"
        tone="danger"
        confirmLabel="Thu hồi"
        onCancel={() => setRevokeDev(null)}
        onConfirm={() => {
          call(() => api.revokeDevice(patient.id, revokeDev.id), { success: `Đã thu hồi ${revokeDev.deviceName}`, refresh });
          setRevokeDev(null);
        }}
      >
        <p>
          {revokeDev?.deviceName} sẽ không nhận nhắc nhở và không xác nhận được nữa. Muốn dùng lại phải ghép nối bằng mã mới.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(revokeDel)}
        title={`Thu hồi quyền của ${revokeDel?.alias}?`}
        tone="danger"
        confirmLabel="Thu hồi quyền"
        onCancel={() => setRevokeDel(null)}
        onConfirm={() => {
          call(() => api.revokeDelegate(patient.id, revokeDel.id), { success: `Đã thu hồi quyền xác nhận hộ của ${revokeDel.alias}`, refresh });
          setRevokeDel(null);
        }}
      >
        <p>
          {revokeDel?.alias} không xác nhận hộ được nữa và các điện thoại của {revokeDel?.alias} bị ngắt kết nối. Khi bỏ lỡ cữ, chỉ bạn nhận cảnh báo.
        </p>
      </ConfirmDialog>
    </>
  );
}
