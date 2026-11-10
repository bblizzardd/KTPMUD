import { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock, Pencil, Trash2, XCircle } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { useDrugInfo } from '../api/drugs.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { combine, useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { detectDuplicateIngredients, dosesToCancelOnSupersede, planDoses, validatePrescriptionInput } from '../domain/rules.js';
import { fmtDate, fmtDateTime, toDateKey } from '../lib/time.js';
import { Callout, Card, ConfirmDialog, PageHeader, PageStatus, RxStatusBadge, Spinner } from '../components/ui.jsx';
import { RxItemsTable, RxLifecycle } from './prescriptionParts.jsx';
import { usePrescriptionDoses } from './PrescriptionsPage.jsx';

/** Bước 5 của UC-06: xem trước tác động của việc xác nhận, theo đúng quy ước sinh/hủy cữ của Backend. */
function useConfirmPreview(rx, patient, list, nowMs) {
  const today = toDateKey(nowMs);
  const isDraft = rx?.status === 'DRAFT';
  const activeRx = isDraft ? list?.find((r) => r.status === 'ACTIVE' && r.id !== rx.id) || null : null;
  const futureQ = useQuery(
    activeRx ? patientKey(patient.id, `doses:${today}:${activeRx.nextVisitDate}`) : null,
    () => api.listDoses(patient.id, { from: today, to: activeRx.nextVisitDate })
  );
  const apptQ = useQuery(isDraft ? patientKey(patient.id, 'appointments') : null, () => api.listAppointments(patient.id));
  if (!isDraft || !list || !apptQ.data || (activeRx && !futureQ.data)) return null;
  const toCancel = activeRx ? dosesToCancelOnSupersede(futureQ.data, activeRx.id, nowMs) : [];
  const planned = rx.nextVisitDate >= rx.startDate ? planDoses({ prescription: rx, patient }) : [];
  const upcoming = planned.filter((d) => Date.parse(d.scheduledAt) >= nowMs);
  return {
    missing: validatePrescriptionInput(rx, { forConfirm: true, today }),
    activePrescription: activeRx,
    cancelCount: toCancel.length,
    cancelFrom: toCancel[0]?.scheduledAt || null,
    generateCount: planned.length,
    pastCount: planned.length - upcoming.length,
    firstDoseAt: upcoming[0]?.scheduledAt || null,
    lastDate: rx.nextVisitDate,
    hasAppointmentOnVisit: apptQ.data.some((a) => a.visitDate === rx.nextVisitDate)
  };
}

export default function PrescriptionDetailPage({ prescriptionId }) {
  const { patient, call, toast } = useApp();
  const nowMs = useNow(30_000);
  const today = toDateKey(nowMs);
  const [ack, setAck] = useState(false);
  const [addVisit, setAddVisit] = useState(true);
  const [askConfirm, setAskConfirm] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const rxQ = useQuery(patientKey(patient.id, `rx:${prescriptionId}`), () => api.getPrescription(prescriptionId));
  const listQ = useQuery(patientKey(patient.id, 'rx'), () => api.listPrescriptions(patient.id));
  const rx = rxQ.data;
  const drugs = useDrugInfo(rx ? rx.items.map((i) => i.drugId) : []);
  const preview = useConfirmPreview(rx, patient, listQ.data, nowMs);
  const doses = usePrescriptionDoses(rx);
  const state = combine(rxQ, listQ);

  if (rxQ.error && !rx) {
    return (
      <Callout tone="warning" title="Không mở được đơn thuốc này" actions={<a className="btn btn-sm btn-secondary" href={href(ROUTES.prescriptions)}>Về danh sách đơn</a>}>
        {rxQ.error.message}
      </Callout>
    );
  }
  if (!state.ready) return <PageStatus error={state.error} onRetry={state.reload} />;
  if (rx.patientId !== patient.id) {
    return (
      <Callout tone="warning" title="Không mở được đơn thuốc này" actions={<a className="btn btn-sm btn-secondary" href={href(ROUTES.prescriptions)}>Về danh sách đơn</a>}>
        Đơn này không thuộc hồ sơ {patient.alias}.
      </Callout>
    );
  }

  const list = listQ.data;
  const warnings = detectDuplicateIngredients(rx.items, drugs);
  const serverWarnings = warnings.length ? [] : rx.warnings || [];
  const flagged = warnings.flatMap((w) => w.itemIndexes);
  const replacedBy = rx.supersededBy ? list.find((r) => r.id === rx.supersededBy) : null;
  const replaced = list.find((r) => r.supersededBy === rx.id);
  const hasWarnings = warnings.length > 0 || serverWarnings.length > 0;
  const canConfirm = preview && preview.missing.length === 0 && (!hasWarnings || ack) && !busy;
  const refresh = patientKey(patient.id);

  async function confirmNow() {
    setAskConfirm(false);
    setBusy(true);
    const res = await call(() => api.confirmPrescription(rx.id), { errorTitle: 'Chưa xác nhận được đơn', refresh });
    if (res.ok && addVisit && preview && !preview.hasAppointmentOnVisit && rx.nextVisitDate >= today) {
      await call(() => api.createAppointment(patient.id, { visitDate: rx.nextVisitDate, remindDaysBefore: 2, note: 'Tái khám theo đơn thuốc' }), { silent: true, refresh });
    }
    setBusy(false);
    if (!res.ok) return;
    toast({
      title: `Đơn đã áp dụng · sinh ${preview?.generateCount ?? ''} cữ thuốc`,
      message: [
        preview?.activePrescription ? `Đơn cũ chuyển sang Bị thay thế, hủy ${preview.cancelCount} cữ chưa đến giờ.` : '',
        `Lịch nhắc tới hết ngày tái khám ${fmtDate(rx.nextVisitDate)}.`
      ]
        .filter(Boolean)
        .join(' ')
    });
  }

  async function cancelNow() {
    setAskCancel(false);
    await call(() => api.cancelPrescription(rx.id), { success: 'Đã hủy đơn nháp', refresh });
  }

  return (
    <>
      <PageHeader
        back={
          <a className="back-link" href={href(ROUTES.prescriptions)}>
            <ArrowLeft size={15} aria-hidden="true" /> Đơn thuốc
          </a>
        }
        title={`Đơn kê ngày ${fmtDate(rx.issuedDate)}`}
        badge={<RxStatusBadge status={rx.status} size="lg" />}
        subtitle={rx.status === 'DRAFT' ? 'Xem lại toàn bộ đơn, đối chiếu với đơn gốc rồi xác nhận để sinh lịch nhắc.' : rx.sourceNote}
        req="UC-06 · FR-06 · FR-07"
        actions={
          rx.status === 'DRAFT' && (
            <>
              <button type="button" className="btn btn-danger-ghost" onClick={() => setAskCancel(true)}>
                <Trash2 size={16} aria-hidden="true" /> Hủy đơn nháp
              </button>
              <a className="btn btn-secondary" href={href(`${ROUTES.prescriptions}/${rx.id}/sua`)}>
                <Pencil size={16} aria-hidden="true" /> Sửa đơn
              </a>
            </>
          )
        }
      />

      <RxLifecycle status={rx.status} />

      {rx.status === 'SUPERSEDED' && (
        <Callout
          tone="neutral"
          title={`Đã được thay bằng đơn mới lúc ${fmtDateTime(rx.updatedAt)}`}
          actions={replacedBy && <a className="btn btn-sm btn-secondary" href={href(`${ROUTES.prescriptions}/${replacedBy.id}`)}>Xem đơn thay thế <ArrowRight size={15} aria-hidden="true" /></a>}
        >
          Các cữ chưa đến giờ của đơn này đã chuyển sang Đã hủy{doses ? ` (${doses.filter((d) => d.status === 'CANCELLED').length} cữ)` : ''}. Lịch sử uống thuốc trước đó vẫn được giữ.
        </Callout>
      )}
      {rx.status === 'EXPIRED' && <Callout tone="neutral" title="Đơn đã hết hạn">Đơn tự chuyển sang Hết hạn sau ngày tái khám {fmtDate(rx.nextVisitDate)}.</Callout>}
      {rx.status === 'CANCELLED' && <Callout tone="neutral" icon={XCircle} title={`Đơn nháp đã hủy lúc ${fmtDateTime(rx.updatedAt)}`}>Đơn không được áp dụng và không sinh cữ thuốc.</Callout>}

      <Card title="Thông tin đơn">
        <dl className="kv">
          <div>
            <dt>Ngày kê</dt>
            <dd>{fmtDate(rx.issuedDate)}</dd>
          </div>
          <div>
            <dt>Ngày bắt đầu</dt>
            <dd>{fmtDate(rx.startDate)}</dd>
          </div>
          <div>
            <dt>Ngày tái khám</dt>
            <dd>{fmtDate(rx.nextVisitDate)}</dd>
          </div>
          <div>
            <dt>Nguồn tra cứu</dt>
            <dd>{rx.sourceNote || '—'}</dd>
          </div>
          <div>
            <dt>Tạo lúc</dt>
            <dd>{fmtDateTime(rx.createdAt)}</dd>
          </div>
          {rx.confirmedAt && (
            <div>
              <dt>Xác nhận lúc</dt>
              <dd>{fmtDateTime(rx.confirmedAt)}</dd>
            </div>
          )}
          {replaced && (
            <div>
              <dt>Thay cho đơn</dt>
              <dd>
                <a href={href(`${ROUTES.prescriptions}/${replaced.id}`)}>Đơn kê ngày {fmtDate(replaced.issuedDate)}</a>
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <Card title={`Thuốc trong đơn (${rx.items.length})`} req="FR-08 · BR-04">
        <div className="stack">
          {hasWarnings && (
            <Callout tone="warning" icon={AlertTriangle} title="Cảnh báo trùng hoạt chất">
              {warnings.map((w) => (
                <p key={w.ingredient}>{w.message}</p>
              ))}
              {serverWarnings.map((w) => (
                <p key={w}>{w}. Nên hỏi lại bác sĩ trước khi xác nhận đơn; hệ thống không tự sửa đơn.</p>
              ))}
            </Callout>
          )}
          <RxItemsTable items={rx.items} highlight={flagged} />
        </div>
      </Card>

      {rx.status === 'ACTIVE' && (
        <Card
          title="Lịch cữ thuốc của đơn"
          actions={<a className="btn btn-sm btn-secondary" href={href(ROUTES.doses, { from: today, to: today })}><CalendarClock size={15} aria-hidden="true" /> Xem lịch cữ</a>}
        >
          {!doses ? (
            <p className="row">
              <Spinner /> Đang tải lịch cữ thuốc…
            </p>
          ) : (
            <p>
              Đã sinh <strong>{doses.length}</strong> cữ thuốc tới hết ngày tái khám {fmtDate(rx.nextVisitDate)}; còn <strong>{doses.filter((d) => d.status === 'SCHEDULED').length}</strong> cữ chưa đến giờ. Muốn đổi thuốc, hãy thêm đơn mới (BR-02).
            </p>
          )}
        </Card>
      )}

      {rx.status === 'DRAFT' && !preview && (
        <Card title="Kiểm tra trước khi xác nhận">
          <PageStatus compact label="Đang tính tác động của việc xác nhận…" />
        </Card>
      )}

      {preview && (
        <Card title="Kiểm tra trước khi xác nhận" subtitle="Bước 5–6 của UC-06: sau khi xác nhận, đơn không sửa được nữa." req="UC-06 · BR-02 · BR-03">
          <div className="stack">
            {preview.missing.length > 0 ? (
              <Callout tone="danger" title="Đơn còn thiếu hoặc sai thông tin bắt buộc" actions={<a className="btn btn-sm btn-secondary" href={href(`${ROUTES.prescriptions}/${rx.id}/sua`)}>Sửa đơn</a>}>
                <ul>
                  {preview.missing.map((m) => (
                    <li key={`${m.field}-${m.issue}`}>{m.issue}</li>
                  ))}
                </ul>
              </Callout>
            ) : (
              <ul className="impact">
                <li>
                  <CheckCircle2 size={18} className="tone-text-success" aria-hidden="true" /> Đủ các trường bắt buộc: ngày kê, ngày bắt đầu, ngày tái khám, tên thuốc, liều mỗi lần, buổi uống.
                </li>
                <li>
                  {preview.activePrescription ? (
                    <>
                      <AlertTriangle size={18} className="tone-text-warning" aria-hidden="true" />
                      <span>
                        Đơn đang hiệu lực (kê ngày {fmtDate(preview.activePrescription.issuedDate)}) sẽ chuyển sang <strong>Bị thay thế</strong>
                        {preview.cancelCount > 0 ? (
                          <>
                            ; <strong>{preview.cancelCount}</strong> cữ chưa đến giờ của đơn đó (từ {fmtDateTime(preview.cancelFrom)}) sẽ bị hủy.
                          </>
                        ) : (
                          '.'
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} className="tone-text-success" aria-hidden="true" /> {patient.alias} chưa có đơn hiệu lực nên không có đơn nào bị thay thế.
                    </>
                  )}
                </li>
                <li>
                  <CalendarClock size={18} className="tone-text-info" aria-hidden="true" />
                  <span>
                    Sẽ sinh <strong>{preview.generateCount}</strong> cữ thuốc từ ngày bắt đầu {fmtDate(rx.startDate)} tới hết ngày tái khám {fmtDate(preview.lastDate)}
                    {preview.firstDoseAt ? `; cữ sắp tới lúc ${fmtDateTime(preview.firstDoseAt)}` : ''}.
                  </span>
                </li>
                {preview.pastCount > 0 && (
                  <li>
                    <Clock size={18} className="tone-text-warning" aria-hidden="true" />
                    <span>
                      <strong>{preview.pastCount}</strong> cữ có giờ nhắc đã qua (tính từ ngày bắt đầu) cũng được ghi vào lịch. Cữ nào quá hạn mà không được xác nhận muộn trong ngày sẽ chuyển sang Bỏ lỡ và gửi cảnh báo. Nếu{' '}
                      {patient.alias} chưa bắt đầu uống theo đơn này, hãy sửa ngày bắt đầu.
                    </span>
                  </li>
                )}
              </ul>
            )}

            {hasWarnings && preview.missing.length === 0 && (
              <label className="checkbox">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>Tôi đã kiểm tra lại cảnh báo trùng hoạt chất với bác sĩ hoặc dược sĩ và vẫn muốn áp dụng đơn đúng như bác sĩ kê.</span>
              </label>
            )}
            {!preview.hasAppointmentOnVisit && preview.missing.length === 0 && rx.nextVisitDate >= today && (
              <label className="checkbox">
                <input type="checkbox" checked={addVisit} onChange={(e) => setAddVisit(e.target.checked)} />
                <span>Thêm lịch tái khám ngày {fmtDate(rx.nextVisitDate)} và nhắc trước 2 ngày (UC-12).</span>
              </label>
            )}

            <div className="row">
              <button type="button" className="btn btn-primary btn-lg" disabled={!canConfirm} onClick={() => (preview.activePrescription ? setAskConfirm(true) : confirmNow())}>
                {busy ? <Spinner /> : <CheckCircle2 size={18} aria-hidden="true" />} Xác nhận đơn
              </button>
              {hasWarnings && !ack && preview.missing.length === 0 && <span className="muted text-sm">Đánh dấu ô xác nhận ở trên để tiếp tục.</span>}
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog open={askConfirm} title="Thay đơn đang dùng?" confirmLabel="Xác nhận và thay đơn" onCancel={() => setAskConfirm(false)} onConfirm={confirmNow}>
        <p>
          Đơn kê ngày {fmtDate(preview?.activePrescription?.issuedDate)} sẽ chuyển sang Bị thay thế và {preview?.cancelCount ?? 0} cữ chưa đến giờ của đơn đó bị hủy. Lịch nhắc mới bắt đầu theo đơn này.
        </p>
        <p className="muted text-sm">Thao tác được ghi vào nhật ký và không hoàn tác được.</p>
      </ConfirmDialog>
      <ConfirmDialog open={askCancel} title="Hủy đơn nháp?" tone="danger" confirmLabel="Hủy đơn nháp" cancelLabel="Giữ lại" onCancel={() => setAskCancel(false)} onConfirm={cancelNow}>
        <p>Đơn chuyển sang Đã hủy và không sinh cữ thuốc. Đơn vẫn được giữ trong lịch sử để đối chiếu.</p>
      </ConfirmDialog>
    </>
  );
}
