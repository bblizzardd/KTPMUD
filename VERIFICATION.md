# Kiểm tra phiên bản 1.0 — 15/10/2026

- Build production React/Vite thành công.
- 12 ca kiểm thử nghiệp vụ đạt: nháp, sinh cữ, thay đơn, chống lặp, tên thuốc, vai trò, thời điểm, đính chính bất biến, scheduler, tỷ lệ, giao dịch và giải quyết cảnh báo.
- 8 ca kiểm thử tích hợp API đạt: tài khoản, phân quyền hồ sơ, đơn thuốc, mã một lần, chỉ số/lịch hẹn, PDF, thu hồi thiết bị và tồn tại dữ liệu sau restart.
- Kiểm tra trình duyệt: đăng nhập mẫu; nhập tên thuốc và chọn gợi ý; lưu/hủy đơn nháp; ghép thiết bị người nhà; xác nhận một chạm; tải PDF.
- Thử ngắt server thật khi xác nhận: giao diện lưu hàng đợi local, khởi động lại server tự đồng bộ, giữ thời điểm bấm 16:01. Tổng quan cập nhật 1/2 cữ hôm nay, ghi nhận muộn với vai trò người nhà.
- Kiểm tra giao diện desktop và chiều rộng di động 390 px: không tràn ngang; có đường vào cài đặt trên màn hình nhỏ.
- Console bản production không có lỗi trong lần kiểm tra cuối.
- PDF mẫu tải từ giao diện: 2 trang, giữ tiếng Việt, tên hồ sơ mẫu, lịch sử xác nhận và thời điểm vừa đồng bộ. Đã đối chiếu nội dung trích xuất và hình trang đầu.

Các tệp kiểm thử và ảnh xem trước nằm trong `test-results/` (không đưa vào Git). Dữ liệu UI thử được giữ trong tài khoản demo: một đơn nháp đã hủy và một thiết bị người nhà đã ghép. Không có dữ liệu bệnh nhân thật.

Chưa đánh giá tải 100 người dùng, coverage 80%, Android thật, push khi đóng tab hoặc đầy đủ NFR trong báo cáo. Phạm vi và các khác biệt kiến trúc được ghi tại README.md.
