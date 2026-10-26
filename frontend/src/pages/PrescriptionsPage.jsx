import { AlertTriangle, ArrowRight, FilePlus2, Pencil, Pill } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useNow } from '../app/hooks.js';
import { useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { fmtDate, fmtDateTime, toDateKey } from '../lib/time.js';
import { Callout, Card, EmptyState, PageHeader, PageStatus, RxStatusBadge } from '../components/ui.jsx';
import { RxItemsTable } from './prescriptionParts.jsx';

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
        subtitle="Nhập đơn tra cứu từ hệ thống số hóa của bệnh viện, xem lại rồi xác nhận. Lịch nhắc chỉ sinh từ đơn đã xác nhận."
        req="UC-05 · UC-06 · FR-04..FR-08"
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
          >
            Tra cứu đơn trên hệ thống số hóa của BV Hữu Nghị, sau đó nhập ngày kê, ngày bắt đầu, ngày tái khám và từng thuốc. Ứng dụng gợi ý tên thuốc sau 2 ký tự.
          </EmptyState>
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
          subtitle={`Tạo lúc ${fmtDateTime(rx.createdAt)} · chưa sinh lịch nhắc cho tới khi xác nhận`}
          actions={
            <>
              <a className="btn btn-sm btn-secondary" href={href(`${ROUTES.prescriptions}/${rx.id}/sua`)}>
                <Pencil size={15} aria-hidden="true" /> Sửa
              </a>
              <a className="btn btn-sm btn-primary" href={href(`${ROUTES.prescriptions}/${rx.id}`)}>
                Xem lại & xác nhận <ArrowRight size={15} aria-hidden="true" />
              </a>
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
            <a className="btn btn-sm btn-ghost" href={href(`${ROUTES.prescriptions}/${active.id}`)}>
              Chi tiết <ArrowRight size={15} aria-hidden="true" />
            </a>
          }
          footer={
            <>
              {activeDoses ? `Đã sinh ${activeDoses.length} cữ thuốc, còn ${upcoming} cữ sắp tới. ` : ''}Muốn đổi thuốc: thêm đơn mới; khi xác nhận, đơn này chuyển sang Bị thay thế và các cữ tương lai bị hủy (BR-02, BR-03).
            </>
          }
        >
          <RxItemsTable items={active.items} />
        </Card>
      )}

      {history.length > 0 && (
        <Card title="Lịch sử đơn thuốc" subtitle="Đơn đã thay thế, hết hạn hoặc đã hủy được giữ lại để đối chiếu.">
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
