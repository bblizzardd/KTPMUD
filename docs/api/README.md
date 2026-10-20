# API mục tiêu và API local

`openapi.yaml` là hợp đồng mục tiêu được đóng gói từ danh sách endpoint trong báo cáo tuần 6. Tệp dùng cú pháp JSON (hợp lệ trong YAML 1.2) để giữ kiểm tra nhất quán. `api/openapi.yaml` ở gốc là bản tương thích checklist; bộ kiểm tra buộc hai bản giống nhau.

`npm run mock` → http://127.0.0.1:5188/docs mở Swagger UI đóng gói sẵn, không cần CDN. `X-Mock-Only: true` đánh dấu phản hồi. Header `X-Mock-Status: 400` (hoặc 401, 403, 404, 409, 410, 422, 500) giả lập lỗi. Mock không kiểm tra token thật, không có DB, không xác nhận đã đạt nghiệp vụ.

| Nội dung | Hợp đồng mục tiêu | Ứng dụng local hiện có |
| --- | --- | --- |
| Xác thực | Bearer JWT/token thiết bị | Cookie phiên opaque |
| Tổng quan | Nhiều endpoint riêng | GET /patients/:id/overview |
| Chỉ số | /lab-results | /labs |
| PDF | POST /reports trả 202, truy vấn trạng thái | GET /patients/:id/report.pdf trả PDF đồng bộ |
| Xác nhận đơn | 202 và worker | 200, sinh lịch trong giao dịch đồng bộ |
| Ủy quyền | /delegates | Mã ghép vai trò delegate, DELETE /devices/:id |
| Tên trường | nickname, issuedOn, originalName… | name, issued, items[].name… |
| Làm mới phiên | /auth/refresh | Chưa có, đăng nhập lại |

Không trỏ frontend local sang mock để sử dụng thực tế. Đây là khung cho frontend thử hợp đồng mục tiêu. Các quy tắc BR và authorization phải được hiện thực ở backend thật trước nghiệm thu.
