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
      <p>Xóa đơn sẽ hủy các cữ đang chờ và sắp tới.</p>
      <p>Lịch sử và lịch tái khám vẫn được giữ. Không thể hoàn tác.</p>
    </ConfirmDialog>
  </>;
}
