# Báo cáo kiểm tra gói bàn giao — 20/10/2026

## Môi trường
Windows, Node.js 25.9.0, npm, PostgreSQL nhúng PGlite trong bộ nhớ; API local dùng SQLite thử độc lập. Lệnh `npm run check` và `npm run test:coverage` chạy từ thư mục gốc repo. Dữ liệu toàn bộ là giả lập.

## Kết quả thực tế

| Nội dung | Kết quả | Minh chứng |
| --- | --- | --- |
| Kiểm tra cú pháp JavaScript | PASS | [Log check](evidence/check-2026-10-20.txt) |
| Unit/API và gói bàn giao | 25 test theo số đếm của Node, 25 PASS, 0 FAIL | [Log check](evidence/check-2026-10-20.txt) |
| Build React | PASS | Cuối log check |
| OpenAPI | PASS, 31 operation; hai đường dẫn spec đồng nhất | Test Handoff trong log |
| Gateway mock | Gọi đủ 31 operation, kiểm tra status/body, lỗi giả lập, Swagger UI và nhãn mock: PASS | Test Handoff trong log |
| Gherkin | Parse 17 tệp / 34 scenario thành công | Test Handoff; đây chỉ là kiểm tra cú pháp |
| DDL/seed PostgreSQL | PASS trên PGlite; 20 bảng, FK, một đơn hiệu lực, bất biến và rollback | Test Handoff trong log |
| Coverage server/domain.js | Dòng 100%; nhánh 96,23%; hàm 95,12% | [Log coverage](evidence/coverage-2026-10-20.txt) |
| Sơ đồ | 19 sơ đồ: 16 nguồn PlantUML + 3 Graphviz, cùng SVG/PNG; 8 ảnh gốc của nhóm được giữ nguyên | [Danh mục sơ đồ](architecture/README.md) |

25 là số đếm gồm 12 test domain, 8 test API con, 1 test API cha và 4 test gói bàn giao. Không được diễn đạt thành 25 yêu cầu đã nghiệm thu. Coverage chỉ đo `server/domain.js`, không đo frontend, Gateway, toàn bộ backend hay 39 TC nguồn.

## Chưa kiểm chứng / cần làm tiếp
- 34 scenario Gherkin chưa có step definitions để chạy BDD; trạng thái nghiệm thu AC: NOT RUN.
- TC-01…TC-39 trong báo cáo chưa có bộ kết quả nghiệm thu riêng; giữ mã để đối chiếu, không suy ra PASS từ các test local.
- Chưa kiểm thử tải 100 người dùng, p95, độ trễ push trên thiết bị thật, Android, TLS production, AES-256 theo NFR-10, retry queue thật hoặc benchmark NFR-11.
- DDL đã chạy trên PostgreSQL nhúng; chưa áp dụng vào server PostgreSQL triển khai, chưa có migration dữ liệu local.
- Chưa có review độc lập bởi thành viên khác và chưa nghiệm thu với người dùng/giảng viên.
- CI GitHub phải xem trạng thái lần chạy sau khi push; kết quả Windows local không được gọi là CI GitHub đã xanh.

Một lượt thử đầu bị môi trường hạn chế kết nối loopback nên không dùng làm bằng chứng nghiệm thu. Đã chạy lại với kết nối local được phép và lưu log thành công ở trên. Sửa test API để luôn dọn tiến trình kể cả khởi động thất bại; không thay đổi nghiệp vụ ứng dụng.

## Kiểm tra cập nhật nguồn sơ đồ

Đã chạy lại kiểm tra liên kết, Gherkin và danh mục sơ đồ sau khi nhập nguồn nhóm: PASS ([log](evidence/diagrams-source-2026-10-20.txt)). Danh mục có 19 nguồn sơ đồ; mỗi nguồn có PNG/SVG. Kiểm tra SHA-256 xác nhận 8 PNG gốc, 5 `.puml`, 3 `.dot` và 3 tệp thư viện C4 không thay đổi. PlantUML và Graphviz đã xuất SVG thành công; JavaScript kiểm tra cú pháp đạt. Kiểm tra nghiệp vụ/coverage trước đó không bị sửa; GitHub CI tiếp tục chạy toàn bộ trên commit mới.
