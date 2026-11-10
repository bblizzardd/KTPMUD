import { useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import * as api from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { useQuery } from '../app/query.js';
import { href, ROUTES } from '../app/router.js';
import { fmtDate, fmtDateTime } from '../lib/time.js';
import { Callout, PageStatus } from '../components/ui.jsx';
import { saveReportPdf } from './ReportsPage.jsx';

/** Xem tệp PDF do máy chủ dựng (FR-20). Tệp tải bằng JWT rồi hiển thị trong khung nhúng. */
export default function ReportViewPage({ reportId }) {
  const { patient, call } = useApp();
  const jobQ = useQuery(patientKey(patient.id, `report:${reportId}`), () => api.getReport(reportId));
  const job = jobQ.data;
  const [file, setFile] = useState({ url: null, error: null });

  useEffect(() => {
    if (job?.status !== 'READY') return undefined;
    let url = null;
    let alive = true;
    api.downloadReport(job.id).then(
      (blob) => {
        url = URL.createObjectURL(blob);
        if (alive) setFile({ url, error: null });
        else URL.revokeObjectURL(url);
      },
      (error) => alive && setFile({ url: null, error })
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [job?.id, job?.status]);

  if (!job) return <PageStatus error={jobQ.error} onRetry={jobQ.reload} />;
  if (job.patientId !== patient.id || job.status !== 'READY') {
    return (
      <Callout tone="warning" title="Không mở được báo cáo" actions={<a className="btn btn-sm btn-secondary" href={href(ROUTES.reports)}>Về trang báo cáo</a>}>
        {job.patientId !== patient.id ? `Báo cáo này không thuộc hồ sơ ${patient.alias}.` : 'Báo cáo chưa sẵn sàng hoặc dựng lỗi.'}
      </Callout>
    );
  }

  return (
    <div className="report-viewer">
      <div className="report-toolbar no-print">
        <a className="back-link" href={href(ROUTES.reports)}>
          <ArrowLeft size={15} aria-hidden="true" /> Báo cáo PDF
        </a>
        <span className="muted text-sm">
          Báo cáo {job.periodDays} ngày{job.fromDate ? ` · ${fmtDate(job.fromDate)} – ${fmtDate(job.toDate)}` : ''} · dựng lúc {fmtDateTime(job.completedAt || job.createdAt)}
        </span>
        <span className="spacer" />
        {file.url && (
          <a className="btn btn-secondary" href={file.url} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Mở trong tab mới
          </a>
        )}
        <button type="button" className="btn btn-primary" onClick={() => call(() => saveReportPdf(job), { errorTitle: 'Không tải được PDF' })}>
          <Download size={16} aria-hidden="true" /> Tải PDF
        </button>
      </div>
      {file.url ? (
        <iframe className="report-frame" src={file.url} title={`Báo cáo PDF ${job.periodDays} ngày của ${patient.alias}`} />
      ) : (
        <PageStatus error={file.error} label="Đang tải tệp PDF…" />
      )}
    </div>
  );
}
