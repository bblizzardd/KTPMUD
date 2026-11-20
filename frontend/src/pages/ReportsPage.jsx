import { useState } from 'react';
import { AlertCircle, Download, FileText, Eye } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { REPORT_PERIODS, REPORT_STATUS } from '../domain/constants.js';
import { fmtDate, fmtDateTime } from '../lib/time.js';
import { Badge, Card, EmptyState, PageHeader, PageStatus, Segmented, Spinner } from '../components/ui.jsx';

/** Tải tệp PDF (yêu cầu JWT nên không dùng được thẻ <a href> trực tiếp). */
export async function saveReportPdf(job) {
  const blob = await api.downloadReport(job.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AnTam_bao-cao-${job.periodDays}-ngay_${job.toDate || fmtDate(job.createdAt)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function ReportsPage() {
  const { patient, call, toast } = useApp();
  const [period, setPeriod] = useState(30);
  const [requesting, setRequesting] = useState(false);
  const key = patientKey(patient.id, 'reports');
  const probe = useQuery(key, () => api.listReports(patient.id));
  const busy = (probe.data || []).some((j) => j.status === 'QUEUED' || j.status === 'PROCESSING');
  // Trong lúc máy chủ dựng PDF thì hỏi lại trạng thái mỗi 2 giây.
  useQuery(busy ? key : null, () => api.listReports(patient.id), { refreshMs: 2000 });
  const jobs = probe.data || [];

  async function request() {
    setRequesting(true);
    const res = await call(() => api.requestReport(patient.id, period), { errorTitle: 'Chưa tạo được báo cáo', refresh: key });
    setRequesting(false);
    if (res.ok) toast({ tone: 'info', title: 'Đang tạo báo cáo' });
  }

  return (
    <>
      <PageHeader
        title="Báo cáo PDF cho bác sĩ"
      />

      <Card title="Tạo báo cáo mới">
        <div className="report-request">
          <div className="row">
            <Segmented ariaLabel="Kỳ báo cáo" value={period} onChange={setPeriod} options={REPORT_PERIODS.map((d) => ({ value: d, label: `${d} ngày` }))} />
            <button type="button" className="btn btn-primary" onClick={request} disabled={busy || requesting}>
              {busy || requesting ? <Spinner /> : <FileText size={16} aria-hidden="true" />} {busy ? 'Đang tạo…' : 'Tạo báo cáo'}
            </button>
          </div>
        </div>
      </Card>

      <Card title="Các báo cáo đã tạo">
        {!probe.data ? (
          <PageStatus error={probe.error} onRetry={probe.reload} />
        ) : jobs.length === 0 ? (
          <EmptyState icon={FileText} title="Chưa có báo cáo" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tạo lúc</th>
                  <th>Kỳ</th>
                  <th>Khoảng ngày</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="nowrap">{fmtDateTime(job.createdAt)}</td>
                    <td>{job.periodDays} ngày</td>
                    <td className="nowrap">{job.fromDate ? `${fmtDate(job.fromDate)} – ${fmtDate(job.toDate)}` : '—'}</td>
                    <td>
                      <Badge tone={REPORT_STATUS[job.status]?.tone || 'neutral'} dot={job.status !== 'READY'}>
                        {REPORT_STATUS[job.status]?.label || job.status}
                      </Badge>
                    </td>
                    <td className="col-num">
                      {job.status === 'READY' ? (
                        <span className="row-tight" style={{ justifyContent: 'flex-end' }}>
                          <a className="btn btn-sm btn-secondary" href={href(`${ROUTES.reports}/${job.id}`)}>
                            <Eye size={15} aria-hidden="true" /> Xem
                          </a>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => call(() => saveReportPdf(job), { errorTitle: 'Không tải được PDF' })}>
                            <Download size={15} aria-hidden="true" /> Tải PDF
                          </button>
                        </span>
                      ) : job.status === 'FAILED' ? (
                        <span className="tone-text-danger text-sm row-tight">
                          <AlertCircle size={15} aria-hidden="true" /> Tạo báo cáo thất bại
                        </span>
                      ) : (
                        <span className="muted text-sm row-tight">
                          <Spinner /> Đang xử lý
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </>
  );
}
