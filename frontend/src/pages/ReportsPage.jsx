import { useState } from 'react';
import { AlertCircle, Download, FileText, Eye, Stethoscope } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { REPORT_PERIODS, REPORT_STATUS } from '../domain/constants.js';
import { fmtDate, fmtDateTime } from '../lib/time.js';
import { Badge, Callout, Card, EmptyState, PageHeader, PageStatus, Segmented, Spinner } from '../components/ui.jsx';

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
    if (res.ok) toast({ tone: 'info', title: 'Đã nhận yêu cầu (202 Accepted)', message: 'Máy chủ đang dựng báo cáo ở chế độ nền, bạn có thể tiếp tục thao tác khác.' });
  }

  return (
    <>
      <PageHeader
        title="Báo cáo PDF cho bác sĩ"
        subtitle={`Tổng hợp lịch sử ghi nhận uống thuốc của ${patient.alias}, phân biệt tự xác nhận, xác nhận hộ và xác nhận muộn, kèm chỉ số xét nghiệm.`}
        req="UC-13 · FR-20 · BIZ-03"
      />

      <Card title="Tạo báo cáo mới" req="POST /patients/{id}/reports">
        <div className="report-request">
          <div className="report-request-text">
            <Stethoscope size={28} className="tone-text-info" aria-hidden="true" />
            <p>
              Bác sĩ không dùng hệ thống. Bạn tải tệp PDF rồi in hoặc mang theo khi đưa {patient.alias} đi tái khám. Báo cáo được máy chủ dựng ở chế độ nền nên không phải chờ.
            </p>
          </div>
          <div className="row">
            <Segmented ariaLabel="Kỳ báo cáo" value={period} onChange={setPeriod} options={REPORT_PERIODS.map((d) => ({ value: d, label: `${d} ngày` }))} />
            <button type="button" className="btn btn-primary" onClick={request} disabled={busy || requesting}>
              {busy || requesting ? <Spinner /> : <FileText size={16} aria-hidden="true" />} {busy ? 'Đang dựng…' : 'Tạo báo cáo'}
            </button>
          </div>
        </div>
      </Card>

      <Card title="Các báo cáo đã tạo" req="GET /reports/{reportId}">
        {!probe.data ? (
          <PageStatus error={probe.error} onRetry={probe.reload} />
        ) : jobs.length === 0 ? (
          <EmptyState icon={FileText} title="Chưa có báo cáo nào">
            Báo cáo 30 ngày là mẫu được dùng nhiều nhất trước mỗi lần tái khám.
          </EmptyState>
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
                          <AlertCircle size={15} aria-hidden="true" /> Dựng lỗi, hãy tạo lại
                        </span>
                      ) : (
                        <span className="muted text-sm row-tight">
                          <Spinner /> Máy chủ đang xử lý
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

      <Callout tone="neutral">
        Báo cáo dùng dữ liệu tự xác nhận của bệnh nhân và người nhà; số liệu không tự chứng minh bệnh nhân đã uống thuốc hay hiệu quả điều trị (BIZ-01). Hồ sơ chỉ có tên gọi và năm sinh, không có định danh thật.
      </Callout>
    </>
  );
}
