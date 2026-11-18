import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deletePrescription } from '../api/caregiver.js';
import { patientKey, useApp } from '../app/AppContext.jsx';
import { fmtDate } from '../lib/time.js';
import { ConfirmDialog } from './ui.jsx';

export default function DeletePrescriptionButton({ prescription, onDeleted, disabled = false }) {
  const { call } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  async function remove() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const result = await call(() => deletePrescription(prescription.id), {
        success: 'Đã xóa đơn thuốc', errorTitle: 'Chưa xóa được đơn thuốc',
        refresh: patientKey(prescription.patientId),
      });
      if (result.ok) { setOpen(false); onDeleted?.(); }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return <>
    <button type="button" className="btn btn-sm btn-danger-ghost" disabled={disabled || busy} onClick={() => setOpen(true)}>
      <Trash2 size={15} aria-hidden="true" /> Xóa đơn
    </button>
    <ConfirmDialog open={open} title={`Xóa đơn kê ngày ${fmtDate(prescription.issuedDate)}?`} tone="danger"
      confirmLabel={busy ? 'Đang xóa…' : 'Xóa đơn thuốc'} confirmDisabled={busy}
      cancelLabel="Giữ lại" onCancel={() => { if (!busy) setOpen(false); }} onConfirm={remove}>
      <p>Đơn sẽ bị xóa khỏi danh sách. Các cữ chưa đến giờ và đang chờ của đơn này sẽ bị hủy, không tiếp tục nhắc thuốc.</p>
      <p>Lịch sử đã uống, cữ đã bỏ lỡ và nhật ký vẫn được giữ. Lịch tái khám đã tạo không bị xóa. Không thể khôi phục đơn trên giao diện.</p>
    </ConfirmDialog>
  </>;
}
