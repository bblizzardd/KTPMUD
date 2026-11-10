import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Lock, Search } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useDebounced } from '../app/hooks.js';
import { useQuery } from '../app/query.js';
import { AUDIT_ACTIONS, ERROR_CODES, ROLE_META } from '../domain/constants.js';
import { fmtDate, fmtTimeSec } from '../lib/time.js';
import { shortId } from '../lib/text.js';
import { Badge, Callout, Card, EmptyState, PageHeader, PageStatus } from '../components/ui.jsx';

const ROLE_TONE = { CAREGIVER: 'primary', PATIENT: 'success', DELEGATE: 'delegate', SYSTEM: 'neutral' };
const PAGE_SIZE = 20;
const EMPTY_PAGE = { items: [], page: 1, size: PAGE_SIZE, total: 0 };

/** Cột chi tiết: Backend ghi mã lỗi cho dòng Thất bại, số lượng cho một số thao tác hàng loạt. */
function auditDetail(log) {
  const detail = log.detail;
  if (detail && typeof detail === 'object') {
    if (log.actionType === 'DOSES_GENERATED' && detail.count !== undefined) return `Sinh ${detail.count} cữ thuốc`;
    return Object.entries(detail)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  if (log.status === 'FAILURE' && detail) return ERROR_CODES[detail] ? `${ERROR_CODES[detail]} (${detail})` : detail;
  if (log.actionType === 'ALERTS_READ' && detail) return `${detail} cảnh báo`;
  return detail || '';
}

export default function AuditPage() {
  const { patient } = useApp();
  const [q, setQ] = useState('');
  const [actionType, setActionType] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const query = useDebounced(q, 200);

  const filters = { page, size: PAGE_SIZE, q: query.trim(), actionType, actorRole };
  const auditQ = useQuery(patientKey(patient.id, `audit:${JSON.stringify(filters)}`), () => api.listAuditLogs(patient.id, filters));
  const result = auditQ.data || EMPTY_PAGE;
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const start = result.total ? (result.page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(result.page * PAGE_SIZE, result.total);
  const resetPage = (fn) => (value) => {
    fn(value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Nhật ký thao tác"
        subtitle={`Ai đã làm gì trên hồ sơ ${patient.alias} và lúc nào. Mọi thao tác ghi dữ liệu đều được ghi lại; nhật ký chỉ được thêm, không sửa hay xóa.`}
        req="FR-18 · US-17 · NFR-06"
      />

      <Callout tone="neutral" icon={Lock}>
        Mỗi dòng có đủ cấu trúc [Timestamp, User UUID, Action Type, Status]. Kể cả các lần bị từ chối (ví dụ bấm xác nhận lặp, sửa đơn đã áp dụng) cũng được ghi với trạng thái Thất bại kèm mã lỗi.
      </Callout>

      <Card>
        <div className="filters-row">
          <div className="input-with-icon audit-search">
            <Search size={16} aria-hidden="true" />
            <label className="sr-only" htmlFor="audit-q">
              Tìm trong nhật ký
            </label>
            <input id="audit-q" className="input" placeholder="Tìm theo nội dung, người thực hiện, mã…" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="audit-action">
            Loại thao tác
          </label>
          <select id="audit-action" className="select audit-select" value={actionType} onChange={(e) => resetPage(setActionType)(e.target.value)}>
            <option value="">Mọi thao tác</option>
            {Object.entries(AUDIT_ACTIONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="audit-role">
            Vai trò
          </label>
          <select id="audit-role" className="select audit-select" value={actorRole} onChange={(e) => resetPage(setActorRole)(e.target.value)}>
            <option value="">Mọi vai trò</option>
            {Object.entries(ROLE_META).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card bodyClassName="flush">
        {!auditQ.data ? (
          <PageStatus error={auditQ.error} onRetry={auditQ.reload} />
        ) : result.items.length === 0 ? (
          <EmptyState icon={History} title="Không có dòng nhật ký nào khớp bộ lọc" />
        ) : (
          <div className="table-wrap">
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Thao tác</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((log) => (
                  <Fragment key={log.id}>
                    <tr className="audit-row" onClick={() => setOpenId(openId === log.id ? null : log.id)}>
                      <td className="nowrap">
                        <button
                          type="button"
                          className="audit-toggle"
                          aria-expanded={openId === log.id}
                          aria-label={`Xem đủ trường của dòng lúc ${fmtTimeSec(log.timestamp)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(openId === log.id ? null : log.id);
                          }}
                        >
                          <span className="num strong">{fmtTimeSec(log.timestamp)}</span>
                          <span className="muted text-xs">{fmtDate(log.timestamp)}</span>
                        </button>
                      </td>
                      <td>
                        <div className="strong">{log.actorLabel}</div>
                        <Badge tone={ROLE_TONE[log.actorRole] || 'neutral'}>{ROLE_META[log.actorRole]?.label || log.actorRole}</Badge>
                      </td>
                      <td>
                        <div>{AUDIT_ACTIONS[log.actionType] || log.actionType}</div>
                        <code className="faint">{log.actionType}</code>
                      </td>
                      <td>
                        <Badge tone={log.status === 'SUCCESS' ? 'success' : 'danger'}>{log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}</Badge>
                      </td>
                      <td className="text-sm audit-detail">{auditDetail(log)}</td>
                    </tr>
                    {openId === log.id && (
                      <tr className="audit-raw">
                        <td colSpan={5}>
                          <dl className="kv kv-mono">
                            <div>
                              <dt>Timestamp</dt>
                              <dd>{log.timestamp}</dd>
                            </div>
                            <div>
                              <dt>User UUID</dt>
                              <dd>{log.userId}</dd>
                            </div>
                            <div>
                              <dt>Action Type</dt>
                              <dd>{log.actionType}</dd>
                            </div>
                            <div>
                              <dt>Status</dt>
                              <dd>{log.status}</dd>
                            </div>
                            <div>
                              <dt>Đối tượng</dt>
                              <dd>
                                {log.targetType}
                                {log.targetId ? ` #${shortId(log.targetId)}` : ''}
                              </dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <span className="muted text-sm">
            {start}–{end} / {result.total} dòng · bấm một dòng để xem đủ trường
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm num">
            Trang {result.page}/{pages}
          </span>
          <button type="button" className="btn btn-sm btn-secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau">
            <ChevronRight size={16} />
          </button>
        </div>
      </Card>
    </>
  );
}
