import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../components/ui.jsx';
import PatientFormModal from '../shell/PatientFormModal.jsx';

/** Tài khoản mới chưa có hồ sơ nào: hướng dẫn bắt đầu (UC-02 → UC-03 → UC-05). */
export default function NoPatientPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Chào mừng đến với An Tâm" />
      <Card>
        <EmptyState
          icon={Users}
          title="Chưa có hồ sơ người bệnh"
          action={
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setOpen(true)}>
              <UserPlus size={18} aria-hidden="true" /> Tạo hồ sơ đầu tiên
            </button>
          }
        />
      </Card>
      <PatientFormModal open={open} mode="create" onClose={() => setOpen(false)} />
    </>
  );
}
