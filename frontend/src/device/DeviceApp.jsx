import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BatteryMedium,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Delete,
  HeartPulse,
  Pill,
  Signal,
  Type,
  Unlink,
  Wifi,
  WifiOff
} from 'lucide-react';
import { isNetworkError } from '../api/errors.js';
import { useNow } from '../app/hooks.js';
import { CONFIRMED_STATUSES, SLOT_META } from '../domain/constants.js';
import { checkConfirmable, groupDoses } from '../domain/rules.js';
import { atTime, dayLabel, fmtTime, toDateKey, weekdayOf, fmtDateShort, MINUTE } from '../lib/time.js';
import { fmtNumber } from '../lib/text.js';
import { confirmDoses, correctDoses, forgetPairing, pairPhone, playChime, usePhoneData } from './deviceClient.js';
import { updatePhone } from './phones.js';

const DONE = [...CONFIRMED_STATUSES, 'QUEUED'];

/** Gộp các xác nhận đang chờ gửi (mất mạng) vào danh sách cữ để hiển thị ngay trên máy. */
function applyQueue(doses, queue) {
  if (!queue?.length) return doses;
  return doses.map((dose) => {
    const items = queue.filter((q) => q.doseId === dose.id);
    if (!items.length) return dose;
    const latest = items[items.length - 1];
    if (latest.correctsConfirmationId) {
      return { ...dose, lastConfirmation: { ...dose.lastConfirmation, takenAt: latest.takenAt, pendingSync: true } };
    }
    return { ...dose, status: 'QUEUED', lastConfirmation: { takenAt: latest.takenAt, recordedAt: latest.queuedAt, pendingSync: true } };
  });
}

/** Ai đã xác nhận, nói theo góc nhìn của người đang cầm máy. */
function doneTitle(group, role) {
  const conf = group.lastConfirmation;
  if (!conf?.actorRole || conf.actorRole === role) return role === 'DELEGATE' ? 'Đã xác nhận hộ lúc' : 'Đã uống lúc';
  return conf.actorRole === 'PATIENT' ? `${conf.actorLabel || 'Bệnh nhân'} đã uống lúc` : `${conf.actorLabel || 'Người nhà'} đã xác nhận lúc`;
}

function medsLine(group) {
  return group.doses.map((d) => d.drugDisplayName).join(', ');
}

function StatusBar({ now, online }) {
  return (
    <div className="dev-status" aria-hidden="true">
      <span className="num">{fmtTime(new Date(now).toISOString())}</span>
      <span className="dev-status-icons">
        <Signal size={14} />
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        <BatteryMedium size={16} />
      </span>
    </div>
  );
}

function rowStatus(group, role) {
  const conf = group.lastConfirmation;
  const at = conf ? fmtTime(conf.takenAt) : '';
  switch (group.status) {
    case 'TAKEN':
      return { tone: 'success', text: `Đã uống ${at}` };
    case 'TAKEN_BY_DELEGATE':
      return { tone: 'delegate', text: role === 'DELEGATE' && conf?.actorRole === 'DELEGATE' ? `Đã xác nhận hộ ${at}` : `${conf?.actorLabel || 'Người nhà'} xác nhận ${at}` };
    case 'LATE_CONFIRMED':
      return { tone: 'warning', text: `Uống muộn ${at}` };
    case 'QUEUED':
      return { tone: 'success', text: `Đã ghi ${at} · chờ gửi` };
    case 'PENDING':
      return { tone: 'info', text: 'Đến giờ uống' };
    case 'MISSED':
      return { tone: 'danger', text: 'Chưa xác nhận' };
    default:
      return { tone: 'neutral', text: 'Sắp tới' };
  }
}

function MedList({ group }) {
  return (
    <ul className="dev-meds">
      {group.doses.map((d) => (
        <li key={d.id}>
          <Pill size={22} aria-hidden="true" className="dev-med-icon" />
          <div>
            <div className="dev-med-name">{d.drugDisplayName}</div>
            <div className="dev-med-dose">
              Uống {fmtNumber(d.unitsPerDose)} {d.unit || 'viên'}
              {d.instruction ? ` · ${d.instruction}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function pairingError(err) {
  if (err?.status === 410) return 'Mã không đúng, đã hết hạn hoặc đã được dùng. Hãy kiểm tra lại hoặc nhờ con tạo mã mới.';
  if (err?.status === 400) return 'Mã gồm đúng 6 chữ số. Hãy kiểm tra lại.';
  if (err?.status === 429) return 'Nhập sai quá nhiều lần. Hãy đợi 1 phút rồi thử lại.';
  if (isNetworkError(err)) return 'Không kết nối được máy chủ. Hãy kiểm tra mạng.';
  return err?.message || 'Không ghép nối được.';
}

function PairingScreen({ phone, result, onPaired, onDone }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    if (busy) return;
    setError('');
    if (!phone.online) {
      setError('Điện thoại đang mất mạng. Cần có mạng để ghép nối.');
      return;
    }
    setBusy(true);
    try {
      onPaired(await pairPhone(phone, code));
    } catch (err) {
      setError(pairingError(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="dev-screen dev-center">
        <CheckCircle2 size={72} className="tone-text-success" aria-hidden="true" />
        <h2 className="dev-h1">Đã ghép nối</h2>
        <p className="dev-text">
          {result.role === 'PATIENT'
            ? `Điện thoại này sẽ nhắc ${result.patientAlias} uống thuốc đúng giờ.`
            : `${result.ownerAlias} có thể xác nhận hộ và nhận cảnh báo cho ${result.patientAlias}.`}
        </p>
        <p className="dev-text-sm">Không cần mật khẩu. Không cần đăng nhập lại.</p>
        <button type="button" className="dev-btn dev-btn-confirm" onClick={onDone}>
          BẮT ĐẦU
        </button>
      </div>
    );
  }

  const press = (digit) => {
    setError('');
    setCode((c) => (c.length < 6 ? c + digit : c));
  };

  return (
    <form className="dev-screen" onSubmit={submit}>
      <div className="dev-brand">
        <HeartPulse size={26} aria-hidden="true" /> An Tâm
      </div>
      <h2 className="dev-h1">Nhập mã ghép nối</h2>
      <p className="dev-text-sm">Mã gồm 6 số do con (người chăm sóc) tạo trên ứng dụng An Tâm. Mã chỉ dùng một lần.</p>
      <label className="sr-only" htmlFor={`pair-${phone.id}`}>
        Mã ghép nối 6 số
      </label>
      <input
        id={`pair-${phone.id}`}
        className="dev-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setError('');
          setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
        }}
        placeholder="______"
        aria-invalid={Boolean(error)}
      />
      {error && (
        <p className="dev-error" role="alert">
          {error}
        </p>
      )}
      <div className="dev-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="dev-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="dev-key dev-key-muted" onClick={() => setCode((c) => c.slice(0, -1))} aria-label="Xóa một số">
          <Delete size={24} />
        </button>
        <button type="button" className="dev-key" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="dev-key dev-key-muted" onClick={() => setCode('')} aria-label="Xóa hết">
          C
        </button>
      </div>
      <button type="submit" className="dev-btn dev-btn-confirm" disabled={code.length !== 6 || busy}>
        {busy ? 'ĐANG GHÉP NỐI…' : 'GHÉP NỐI'}
      </button>
    </form>
  );
}

function RevokedScreen({ phone }) {
  return (
    <div className="dev-screen dev-center">
      <Unlink size={64} className="tone-text-danger" aria-hidden="true" />
      <h2 className="dev-h1">Điện thoại đã bị ngắt kết nối</h2>
      <p className="dev-text">Hãy nhờ con (người chăm sóc) tạo mã ghép nối mới, rồi nhập lại mã trên điện thoại này.</p>
      <button type="button" className="dev-btn dev-btn-confirm" onClick={() => forgetPairing(phone)}>
        NHẬP MÃ MỚI
      </button>
    </div>
  );
}

function CorrectionSheet({ group, onCancel, onSave, nowMs }) {
  const original = group.lastConfirmation?.takenAt;
  const [time, setTime] = useState(original ? fmtTime(original) : '');
  const [error, setError] = useState('');
  function save() {
    const iso = atTime(group.date, time);
    const check = checkConfirmable(group.doses.find((d) => d.lastConfirmation) || group.doses[0], { takenAt: iso, nowMs, correction: true });
    if (!check.ok) {
      setError(check.message);
      return;
    }
    onSave(iso);
  }
  return (
    <div className="dev-sheet" role="dialog" aria-label="Sửa giờ uống">
      <h3 className="dev-h2">Sửa giờ đã uống</h3>
      <p className="dev-text-sm">Chỉ sửa khi bấm nhầm giờ. Bản ghi cũ vẫn được giữ lại để đối chiếu.</p>
      <input type="time" className="dev-time-input" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Giờ uống đúng" />
      {error && <p className="dev-error">{error}</p>}
      <button type="button" className="dev-btn dev-btn-confirm" onClick={save} disabled={!time}>
        LƯU GIỜ ĐÚNG
      </button>
      <button type="button" className="dev-btn dev-btn-ghost" onClick={onCancel}>
        Thôi
      </button>
    </div>
  );
}

function HomeScreen({ phone, data, nowMs, flash, reload }) {
  const role = data.profile.role;
  const isPatient = role === 'PATIENT';
  const alias = data.profile.patientAlias;
  const doses = applyQueue(data.doses, phone.queue);
  const groups = groupDoses(doses);
  const [justDone, setJustDone] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const [ringing, setRinging] = useState(null);
  const [sending, setSending] = useState(false);
  const seen = useRef(null);

  const pending = groups.filter((g) => g.status === 'PENDING');
  const missed = groups.filter((g) => g.status === 'MISSED');
  // Máy người nhà: cữ quá hạn chưa xác nhận là cảnh báo cần nhắc bệnh nhân (US-12).
  const unresolved = isPatient
    ? []
    : missed
        .filter((g) => !(phone.acked || []).includes(g.key))
        .map((g) => ({ id: g.key, message: `${alias} chưa xác nhận ${SLOT_META[g.slot].long.toLowerCase()} ${fmtTime(g.scheduledAt)} (${medsLine(g)}).` }));
  const ack = (key) => updatePhone(phone.id, (p) => ({ acked: [...(p.acked || []).slice(-50), key] }));

  // Nhắc nhở (FR-10, US-08) trên máy bệnh nhân; cảnh báo bỏ lỡ (US-12) trên máy người nhà
  const ringKeys = isPatient ? pending.map((g) => `p:${g.key}`) : unresolved.map((n) => `n:${n.id}`);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(ringKeys);
      return;
    }
    const fresh = ringKeys.find((k) => !seen.current.has(k));
    ringKeys.forEach((k) => seen.current.add(k));
    if (fresh) {
      setRinging(fresh);
      playChime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringKeys.join('|')]);

  async function doConfirm(group) {
    if (sending) return;
    setRinging(null);
    setSending(true);
    const res = await confirmDoses(phone, group.doses.filter((d) => d.status === 'PENDING' || d.status === 'MISSED'));
    setSending(false);
    if (res.queued) {
      setJustDone(group.key);
      flash({ tone: 'warning', text: `Đã ghi nhận lúc ${fmtTime(res.takenAt)}. Sẽ tự gửi khi có mạng.` });
      return;
    }
    await reload();
    const failed = res.results.filter((r) => !r.ok);
    if (failed.length === 0) {
      setJustDone(group.key);
      return;
    }
    const err = failed[0].error;
    const part = failed.length < res.results.length ? `Đã ghi ${res.results.length - failed.length}/${res.results.length} thuốc. ` : '';
    if (err?.status === 401) flash({ tone: 'danger', text: 'Điện thoại đã bị ngắt kết nối.' });
    else if (err?.code === 'DOSE_ALREADY_CONFIRMED') flash({ tone: 'info', text: `${part}Cữ này đã có người xác nhận trước đó.` });
    else if (err?.code === 'DOSE_CANCELLED') flash({ tone: 'warning', text: 'Cữ này đã được thay bằng đơn thuốc mới.' });
    else if (isNetworkError(err)) flash({ tone: 'danger', text: `${part}Không kết nối được máy chủ, hãy thử lại.` });
    else flash({ tone: 'danger', text: `${part}${err?.message || 'Chưa ghi nhận được, hãy thử lại.'}` });
  }

  async function doCorrect(group, iso) {
    setCorrecting(null);
    const res = await correctDoses(phone, group.doses, iso);
    if (!res.queued) await reload();
    const failed = res.results.filter((r) => !r.ok);
    if (failed.length) flash({ tone: 'danger', text: failed[0].error?.message || 'Chưa sửa được.' });
    else flash({ tone: 'success', text: res.queued ? `Đã sửa thành ${fmtTime(iso)}, sẽ gửi khi có mạng.` : `Đã sửa giờ uống thành ${fmtTime(iso)}.` });
  }

  // Thẻ chính: việc cần làm ngay (tối đa một thao tác cho mỗi cữ)
  const done = justDone ? groups.find((g) => g.key === justDone && DONE.includes(g.status)) : null;
  const recent = [...groups].reverse().find((g) => DONE.includes(g.status) && g.lastConfirmation && nowMs - Date.parse(g.lastConfirmation.recordedAt || g.lastConfirmation.takenAt) < 45 * MINUTE);
  const next = groups.find((g) => g.status === 'SCHEDULED');
  let focus;
  if (pending.length) focus = { kind: 'PENDING', group: pending[0] };
  else if (done) focus = { kind: 'DONE', group: done };
  else if (missed.length) focus = { kind: 'MISSED', group: missed[missed.length - 1] };
  else if (recent) focus = { kind: 'DONE', group: recent };
  else if (next) focus = { kind: 'NEXT', group: next };
  else focus = { kind: groups.length ? 'ALL_DONE' : 'NONE' };

  const today = toDateKey(new Date(nowMs));
  const queuedLast = [...(phone.queue || [])].filter((q) => !q.correctsConfirmationId).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  const last = queuedLast && (!data.last || queuedLast.takenAt > data.last.takenAt)
    ? { takenAt: queuedLast.takenAt, slot: doses.find((d) => d.id === queuedLast.doseId)?.slot, date: today, pendingSync: true }
    : data.last;

  const ringingGroup = ringing?.startsWith('p:') ? groups.find((g) => `p:${g.key}` === ringing && g.status === 'PENDING') : null;
  const ringingNote = ringing?.startsWith('n:') ? unresolved.find((n) => `n:${n.id}` === ringing) : null;
  const confirmLabel = isPatient ? 'ĐÃ UỐNG' : `XÁC NHẬN HỘ: ${alias.toUpperCase()} ĐÃ UỐNG`;

  return (
    <div className="dev-screen">
      <div className="dev-hello">
        <div>
          <h2 className="dev-h1">{isPatient ? `Chào ${alias}` : `Chào ${data.profile.ownerAlias}`}</h2>
          <p className="dev-text-sm">
            {weekdayOf(today)}, {fmtDateShort(today)}
            {!isPatient && ` · Người nhà của ${alias}`}
          </p>
        </div>
        <button
          type="button"
          className="dev-icon-btn"
          aria-pressed={phone.largeText}
          aria-label={phone.largeText ? 'Cỡ chữ lớn' : 'Cỡ chữ rất lớn'}
          title="Đổi cỡ chữ"
          onClick={() => updatePhone(phone.id, { largeText: !phone.largeText })}
        >
          <Type size={22} />
        </button>
      </div>

      {!isPatient && unresolved.length > 0 && (
        <div className="dev-alerts">
          {unresolved.map((n) => (
            <div key={n.id} className="dev-alert" role="alert">
              <AlertTriangle size={26} aria-hidden="true" />
              <div className="dev-alert-body">
                <strong>{n.message}</strong>
                <div className="dev-alert-actions">
                  <button type="button" className="dev-pill" onClick={() => ack(n.id)}>
                    Đã nhắc {alias}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {focus.kind === 'PENDING' && (
        <section className="dev-card dev-card-pending" aria-label="Cữ thuốc cần uống bây giờ">
          <div className="dev-when">
            <span className="dev-time num">{fmtTime(focus.group.scheduledAt)}</span>
            <span className="dev-slot">{SLOT_META[focus.group.slot].long}</span>
          </div>
          <MedList group={focus.group} />
          <button type="button" className={`dev-btn ${isPatient ? 'dev-btn-confirm' : 'dev-btn-delegate'}`} onClick={() => doConfirm(focus.group)} disabled={sending}>
            <Check size={30} strokeWidth={3} aria-hidden="true" /> {confirmLabel}
          </button>
          <p className="dev-hint">
            {isPatient ? 'Bấm một lần sau khi uống xong.' : `Chỉ bấm khi ${alias} đã uống mà quên bấm.`} Hạn xác nhận {fmtTime(focus.group.deadlineAt)}.
          </p>
        </section>
      )}

      {focus.kind === 'MISSED' && (
        <section className="dev-card dev-card-missed" aria-label="Cữ thuốc đã quá giờ">
          <div className="dev-when">
            <span className="dev-time num">{fmtTime(focus.group.scheduledAt)}</span>
            <span className="dev-slot">{SLOT_META[focus.group.slot].long} · quá giờ</span>
          </div>
          <p className="dev-text">{isPatient ? `Cữ này chưa được xác nhận. ${alias} đã uống chưa?` : `${alias} chưa xác nhận cữ này.`}</p>
          <MedList group={focus.group} />
          <button type="button" className="dev-btn dev-btn-late" onClick={() => doConfirm(focus.group)} disabled={sending}>
            <Check size={28} strokeWidth={3} aria-hidden="true" /> {isPatient ? 'TÔI ĐÃ UỐNG RỒI' : `${alias.toUpperCase()} ĐÃ UỐNG RỒI`}
          </button>
          <p className="dev-hint">Sẽ ghi là xác nhận muộn. Nếu chưa uống, hãy hỏi con hoặc bác sĩ trước khi uống bù.</p>
        </section>
      )}

      {focus.kind === 'DONE' && (
        <section className="dev-card dev-card-done" aria-live="polite">
          <CheckCircle2 size={60} aria-hidden="true" />
          <div className="dev-done-title">
            {doneTitle(focus.group, role)}{' '}
            <span className="num">{fmtTime(focus.group.lastConfirmation?.takenAt)}</span>
          </div>
          <div className="dev-text-sm">
            {SLOT_META[focus.group.slot].long} · {medsLine(focus.group)}
          </div>
          {focus.group.status === 'QUEUED' && <div className="dev-queued">Đang mất mạng — sẽ tự gửi khi có mạng</div>}
          {focus.group.status === 'LATE_CONFIRMED' && <div className="dev-text-sm">Đã ghi là xác nhận muộn.</div>}
          {focus.group.status !== 'QUEUED' && focus.group.lastConfirmation?.actorRole === role && (
            <button type="button" className="dev-link" onClick={() => setCorrecting(focus.group)}>
              Bấm nhầm giờ? Sửa giờ uống
            </button>
          )}
          {justDone && (
            <button type="button" className="dev-btn dev-btn-secondary" onClick={() => setJustDone(null)}>
              XONG
            </button>
          )}
        </section>
      )}

      {focus.kind === 'NEXT' && (
        <section className="dev-card" aria-label="Cữ thuốc tiếp theo">
          <div className="dev-label">Cữ tiếp theo</div>
          <div className="dev-when">
            <span className="dev-time num">{fmtTime(focus.group.scheduledAt)}</span>
            <span className="dev-slot">{SLOT_META[focus.group.slot].long}</span>
          </div>
          <MedList group={focus.group} />
          <p className="dev-hint">
            <Clock size={18} aria-hidden="true" /> Điện thoại sẽ đổ chuông khi đến giờ.
          </p>
        </section>
      )}

      {(focus.kind === 'ALL_DONE' || focus.kind === 'NONE') && (
        <section className="dev-card dev-card-done">
          <CheckCircle2 size={56} aria-hidden="true" />
          <div className="dev-done-title">{focus.kind === 'NONE' ? 'Hôm nay không có cữ thuốc' : 'Hôm nay đã xong các cữ thuốc'}</div>
        </section>
      )}

      <div className="dev-last" aria-label="Lần uống gần nhất">
        <span className="dev-label">Lần uống gần nhất</span>
        {last ? (
          <span>
            {SLOT_META[last.slot]?.long || 'Cữ'} {dayLabel(last.date, nowMs).toLowerCase()}, lúc <strong className="num">{fmtTime(last.takenAt)}</strong>
            {last.pendingSync ? ' (chờ gửi)' : ''}
          </span>
        ) : (
          <span>Chưa có</span>
        )}
      </div>

      <div className="dev-section-title">Hôm nay</div>
      {groups.length === 0 ? (
        <p className="dev-text-sm">Không có cữ thuốc nào hôm nay.</p>
      ) : (
        <ul className="dev-list">
          {groups.map((g) => {
            const st = rowStatus(g, role);
            return (
              <li key={g.key} className={`dev-row tone-row-${st.tone}`}>
                <span className="dev-row-time num">{fmtTime(g.scheduledAt)}</span>
                <span className="dev-row-main">
                  <span className="dev-row-slot">{SLOT_META[g.slot].label}</span>
                  <span className="dev-row-meds">{medsLine(g)}</span>
                </span>
                <span className={`dev-row-status tone-text-${st.tone}`}>{st.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      {correcting && <CorrectionSheet group={correcting} nowMs={nowMs} onCancel={() => setCorrecting(null)} onSave={(iso) => doCorrect(correcting, iso)} />}

      {ringingGroup && (
        <div className="dev-ring" role="alertdialog" aria-label="Đến giờ uống thuốc">
          <BellRing size={64} className="dev-ring-bell" aria-hidden="true" />
          <div className="dev-ring-title">ĐẾN GIỜ UỐNG THUỐC</div>
          <div className="dev-when dev-when-center">
            <span className="dev-time num">{fmtTime(ringingGroup.scheduledAt)}</span>
            <span className="dev-slot">{SLOT_META[ringingGroup.slot].long}</span>
          </div>
          <MedList group={ringingGroup} />
          <button type="button" className="dev-btn dev-btn-confirm" onClick={() => doConfirm(ringingGroup)}>
            <Check size={30} strokeWidth={3} aria-hidden="true" /> ĐÃ UỐNG
          </button>
          <button type="button" className="dev-btn dev-btn-ghost" onClick={() => setRinging(null)}>
            Để sau
          </button>
        </div>
      )}

      {ringingNote && (
        <div className="dev-ring dev-ring-alert" role="alertdialog" aria-label="Cảnh báo bỏ lỡ cữ thuốc">
          <AlertTriangle size={64} aria-hidden="true" />
          <div className="dev-ring-title">{alias.toUpperCase()} CHƯA UỐNG THUỐC</div>
          <p className="dev-text">{ringingNote.message}</p>
          <button
            type="button"
            className="dev-btn dev-btn-delegate"
            onClick={() => {
              ack(ringingNote.id);
              setRinging(null);
            }}
          >
            ĐÃ NHẮC {alias.toUpperCase()}
          </button>
          <button type="button" className="dev-btn dev-btn-ghost" onClick={() => setRinging(null)}>
            Để sau
          </button>
        </div>
      )}
    </div>
  );
}

/** Ứng dụng điện thoại (Mobile App, deviceAuth): chế độ bệnh nhân và chế độ người nhà. */
export default function DeviceApp({ phone }) {
  const nowMs = useNow(10_000);
  const [message, setMessage] = useState(null);
  // Giữ màn hình "Đã ghép nối" cho tới khi người dùng bấm BẮT ĐẦU, kể cả khi lịch đã tải xong.
  const [paired, setPaired] = useState(null);
  const timer = useRef(null);
  const data = usePhoneData(phone);

  const flash = (msg) => {
    clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 5000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  let screen;
  if (paired || data.state === 'UNPAIRED') screen = <PairingScreen phone={phone} result={paired} onPaired={setPaired} onDone={() => setPaired(null)} />;
  else if (data.state === 'REVOKED') screen = <RevokedScreen phone={phone} />;
  else if (data.state === 'OFFLINE_NO_CACHE')
    screen = (
      <div className="dev-screen dev-center">
        <WifiOff size={64} className="muted" aria-hidden="true" />
        <h2 className="dev-h1">Không có mạng</h2>
        <p className="dev-text">Hãy bật Wi-Fi hoặc dữ liệu di động để tải lịch uống thuốc.</p>
      </div>
    );
  else if (data.state === 'READY') screen = <HomeScreen key={`${phone.id}-${data.profile.deviceId}`} phone={phone} data={data} nowMs={nowMs} flash={flash} reload={data.reload} />;
  else if (data.state === 'LOADING')
    screen = (
      <div className="dev-screen dev-center">
        <HeartPulse size={56} className="tone-text-info" aria-hidden="true" />
        <p className="dev-text">Đang tải lịch uống thuốc…</p>
      </div>
    );
  else
    screen = (
      <div className="dev-screen dev-center">
        <AlertTriangle size={56} aria-hidden="true" />
        <p className="dev-text">{isNetworkError(data.error) ? 'Không kết nối được máy chủ An Tâm.' : data.error?.message || 'Có lỗi xảy ra.'}</p>
        <button type="button" className="dev-btn dev-btn-secondary" onClick={data.reload}>
          THỬ LẠI
        </button>
      </div>
    );

  return (
    <div className={`dev-app ${phone.largeText ? 'dev-xl' : ''}`}>
      <StatusBar now={nowMs} online={phone.online} />
      {phone.online && data.serverDown && (
        <div className="dev-offline" role="status">
          <WifiOff size={18} aria-hidden="true" />
          <span>Không kết nối được máy chủ. Đang hiển thị lịch đã tải lúc {fmtTime(data.savedAt)}.</span>
        </div>
      )}
      {!phone.online && data.state === 'READY' && (
        <div className="dev-offline" role="status">
          <WifiOff size={18} aria-hidden="true" />
          <span>
            Mất mạng. Bấm vẫn được ghi lại và tự gửi khi có mạng
            {phone.queue?.length ? ` (${phone.queue.length} chờ gửi)` : ''}.
          </span>
        </div>
      )}
      <div className="dev-scroll">{screen}</div>
      {message && (
        <div className={`dev-flash tone-${message.tone}`} role="status">
          {message.text}
        </div>
      )}
    </div>
  );
}
