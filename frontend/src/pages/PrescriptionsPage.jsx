import { AlertTriangle, ArrowRight, FilePlus2, Pencil, Pill } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { fmtDate, fmtDateTime, toDateKey } from '../lib/time.js';
import { Callout, Card, EmptyState, PageHeader, PageStatus, RxStatusBadge } from '../components/ui.jsx';
import { RxItemsTable } from './prescriptionParts.jsx';
import DeletePrescriptionButton from '../components/DeletePrescriptionButton.jsx';

/** Số cữ của một đơn trong khoảng hiệu lực (để báo "đã sinh / còn sắp tới"). */
export function usePrescriptionDoses(rx) {
  const enabled = Boolean(rx && rx.status !== 'DRAFT' && rx.status !== 'CANCELLED');
  const q = useQuery(
    enabled ? patientKey(rx.patientId, `doses:${rx.startDate}:${rx.nextVisitDate}`) : null,
    () => api.listDoses(rx.patientId, { from: rx.startDate, to: rx.nextVisitDate })
  );
  return q.data ? q.data.filter((d) => d.prescriptionId === rx.id) : null;
}

export default function PrescriptionsPage() {
  const { patient } = useApp();
  const nowMs = useNow(60_000);
  const today = toDateKey(nowMs);
  const listQ = useQuery(patientKey(patient.id, 'rx'), () => api.listPrescriptions(patient.id));
  const list = listQ.data || [];
  const active = list.find((r) => r.status === 'ACTIVE');
  const drafts = list.filter((r) => r.status === 'DRAFT');
  const history = list.filter((r) => !['ACTIVE', 'DRAFT'].includes(r.status));
  const activeDoses = usePrescriptionDoses(active);
  const upcoming = activeDoses ? activeDoses.filter((d) => d.status === 'SCHEDULED').length : null;

  return (
    <>
      <PageHeader
        title="Đơn thuốc"
        actions={
          <a className="btn btn-primary" href={href(ROUTES.prescriptionNew)}>
            <FilePlus2 size={16} aria-hidden="true" /> Thêm đơn thuốc
          </a>
        }
      />

      {!listQ.data && <PageStatus error={listQ.error} onRetry={listQ.reload} />}

      {listQ.data && list.length === 0 && (
        <Card>
          <EmptyState
            icon={Pill}
            title={`${patient.alias} chưa có đơn thuốc nào`}
            action={
              <a className="btn btn-primary" href={href(ROUTES.prescriptionNew)}>
                <FilePlus2 size={16} aria-hidden="true" /> Nhập đơn đầu tiên
              </a>
            }
          />
        </Card>
      )}

      {drafts.map((rx) => (
        <Card
          key={rx.id}
          className="rx-card rx-card-draft"
          title={
            <>
              Đơn nháp ngày kê {fmtDate(rx.issuedDate)} <RxStatusBadge status={rx.status} />
            </>
          }
          subtitle={`Tạo lúc ${fmtDateTime(rx.createdAt)}`}
          actions={
            <>
              <a className="btn btn-sm btn-secondary" href={href(`${ROUTES.prescriptions}/${rx.id}/sua`)}>
                <Pencil size={15} aria-hidden="true" /> Sửa
              </a>
              <a className="btn btn-sm btn-primary" href={href(`${ROUTES.prescriptions}/${rx.id}`)}>
                Xem lại & xác nhận <ArrowRight size={15} aria-hidden="true" />
              </a>
              <DeletePrescriptionButton prescription={rx} />
            </>
          }
        >
          {rx.warnings.length > 0 && (
            <Callout tone="warning" icon={AlertTriangle} title="Cảnh báo trùng hoạt chất" className="mb-12">
              {rx.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </Callout>
          )}
          {rx.nextVisitDate < today && (
            <Callout tone="warning" className="mb-12">
              Ngày tái khám {fmtDate(rx.nextVisitDate)} đã qua nên đơn này không xác nhận được nữa. Hãy sửa ngày hoặc hủy đơn.
            </Callout>
          )}
          <RxItemsTable items={rx.items} />
        </Card>
      ))}

      {active && (
        <Card
          className="rx-card rx-card-active"
          title={
            <>
              Đơn đang hiệu lực <RxStatusBadge status="ACTIVE" />
            </>
          }
          subtitle={`Kê ngày ${fmtDate(active.issuedDate)} · bắt đầu ${fmtDate(active.startDate)} · tái khám ${fmtDate(active.nextVisitDate)}${active.sourceNote ? ` · ${active.sourceNote}` : ''}`}
          actions={
            <>
            <a className="btn btn-sm btn-ghost" href={href(`${ROUTES.prescriptions}/${active.id}`)}>
              Chi tiết <ArrowRight size={15} aria-hidden="true" />
            </a>
            <DeletePrescriptionButton prescription={active} />
            </>
          }
          footer={activeDoses ? `${upcoming} cữ sắp tới` : undefined}
        >
          <RxItemsTable items={active.items} />
        </Card>
      )}

      {history.length > 0 && (
        <Card title="Lịch sử đơn thuốc">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Trạng thái</th>
                  <th>Ngày kê</th>
                  <th>Hiệu lực</th>
                  <th>Thuốc</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((rx) => (
                  <tr key={rx.id}>
                    <td>
                      <RxStatusBadge status={rx.status} />
                    </td>
                    <td className="nowrap">{fmtDate(rx.issuedDate)}</td>
                    <td className="nowrap">
                      {rx.status === 'CANCELLED' ? <span className="muted">Không áp dụng</span> : `${fmtDate(rx.startDate)} → ${rx.status === 'SUPERSEDED' ? fmtDate(rx.updatedAt) : fmtDate(rx.nextVisitDate)}`}
                    </td>
                    <td className="text-sm">{rx.items.map((i) => i.drugNameRaw).join(', ')}</td>
                    <td className="col-num">
                      <a className="btn btn-sm btn-ghost" href={href(`${ROUTES.prescriptions}/${rx.id}`)}>
                        Xem
                      </a>
                      <DeletePrescriptionButton prescription={rx} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
