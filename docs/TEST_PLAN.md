# Kế hoạch kiểm thử

1. Kiểm tra đủ 20 FR, 11 NFR, 17 story và 13 UC; kiểm tra liên kết trong RTM.
2. Parse 17 tệp Gherkin; chỉ kiểm tra cú pháp, không phải chạy BDD.
3. Validate OpenAPI; chạy mock trên cổng riêng; gọi toàn bộ operation và các nhánh lỗi mock.
4. Chạy DDL và seed PostgreSQL trên PGlite trong bộ nhớ; kiểm tra PK/FK, ràng buộc đơn hiệu lực duy nhất, ngày, chống sửa/xóa xác nhận và rollback.
5. Chạy unit/API local bằng node:test với DB thử; kiểm tra quyền, ghép nối, đơn, xác nhận, scheduler, chỉ số, PDF, thu hồi và restart.
6. Đo coverage cho server/domain.js; công bố riêng dòng, nhánh, hàm. Không suy ra độ phủ toàn bộ hệ thống hoặc 39 TC.
7. Build frontend và kiểm tra cú pháp JavaScript.

NFR chưa đo (tải 100 người dùng, p95, push, Android, TLS triển khai, AES-256) phải ghi chưa đo. Trước nghiệm thu, nhóm cần bổ sung step definitions BDD, thử thiết bị và dữ liệu giả lập, review mã/tài liệu độc lập.

Kết quả hiện tại: TEST_REPORT.md và evidence/. Các log chỉ chứa dữ liệu thử.
