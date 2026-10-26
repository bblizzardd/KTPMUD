import { useState } from 'react';
import { Pill, Smartphone, UserPlus, Users } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../components/ui.jsx';
import PatientFormModal from '../shell/PatientFormModal.jsx';

/** Tài khoản mới chưa có hồ sơ nào: hướng dẫn bắt đầu (UC-02 → UC-03 → UC-05). */
export default function NoPatientPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Chào mừng đến với An Tâm" subtitle="Bắt đầu bằng việc tạo hồ sơ cho người thân bạn chăm sóc." req="UC-02 · US-13" />
      <Card>
        <EmptyState
          icon={Users}
          title="Chưa có hồ sơ người bệnh"
          action={
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setOpen(true)}>
              <UserPlus size={18} aria-hidden="true" /> Tạo hồ sơ đầu tiên
            </button>
          }
        >
          Hồ sơ chỉ cần tên gọi trong gia đình (ví dụ “Bố”) và năm sinh. Bạn có thể theo dõi nhiều người thân bằng một tài khoản.
        </EmptyState>
        <ol className="onboard-steps">
          <li>
            <UserPlus size={20} aria-hidden="true" />
            <strong>Tạo hồ sơ</strong>
            <span>Tên gọi và năm sinh, không cần thông tin định danh thật.</span>
          </li>
          <li>
            <Smartphone size={20} aria-hidden="true" />
            <strong>Ghép điện thoại</strong>
            <span>Tạo mã 6 số, nhập trên điện thoại của bố mẹ. Không cần mật khẩu.</span>
          </li>
          <li>
            <Pill size={20} aria-hidden="true" />
            <strong>Nhập đơn thuốc</strong>
            <span>Xem lại và xác nhận đơn để hệ thống bắt đầu nhắc đúng giờ.</span>
          </li>
        </ol>
      </Card>
      <PatientFormModal open={open} mode="create" onClose={() => setOpen(false)} />
    </>
  );
}
