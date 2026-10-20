# Cài đặt và vận hành

## Bản local hiện có
Yêu cầu Node.js 22.13 trở lên (dùng Node 24 trong CI), npm và font TTF tiếng Việt.

```sh
npm ci
npm run build
npm start
```
Mở http://127.0.0.1:5173. Dùng nút trải nghiệm dữ liệu mẫu hoặc tạo tài khoản. Mẫu chỉ để thử; không dùng làm chỉ dẫn điều trị.

Biến cấu hình: PORT, DB_PATH, NO_SEED=1, PDF_FONT. Linux dùng DejaVuSans tại /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf. Không đưa .env, data/ hoặc DB thật lên Git.

Sao lưu: dừng ứng dụng rồi sao chép toàn bộ data/. Phục hồi: dừng ứng dụng, lưu bản dự phòng hiện tại và khôi phục thư mục sao lưu, chạy lại, đối chiếu số hồ sơ/cữ. Không thay SQLite hiện có bằng schema PostgreSQL mục tiêu.

## Bộ thiết kế dữ liệu mục tiêu
```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed.sql
```
Chỉ chạy trên DB trống dành riêng cho demo. DDL và seed không phải migration của data/antam.sqlite. Có thể kiểm tra không cần cài PostgreSQL bằng `npm run verify:handoff` (PGlite trong bộ nhớ).

## Gateway mock và Swagger UI
```sh
npm run mock
```
Mở http://127.0.0.1:5188/docs. Hợp đồng lấy từ docs/api/openapi.yaml. Mọi phản hồi ở đây là giả lập; không kết nối DB của ứng dụng. Dùng `MOCK_PORT` nếu cần đổi cổng. Dừng bằng Ctrl+C.

## Kiểm tra gói bàn giao
```sh
npm run check
```
Lệnh kiểm tra cấu trúc, schema, API, Gherkin, mock; chạy unit/API và build. CI lưu log sau mỗi lần chạy. Xem TEST_REPORT.md để biết phạm vi và kết quả thực tế.
