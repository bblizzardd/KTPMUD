# Bộ bàn giao An Tâm — SRS v1.0

Đóng gói từ báo cáo tuần 6 ngày 20/10/2026. Đây là bộ tài liệu và khung thiết kế có thể kiểm tra; chưa phải chứng nhận hoàn thành toàn bộ hệ thống mục tiêu.

| Yêu cầu review | Tệp đã có | Trạng thái |
| --- | --- | --- |
| Đặc tả SRS | [SRS_v1.0.md](SRS_v1.0.md) | Đã đóng gói 4 BIZ, 17 US, 13 UC, 20 FR, 11 NFR, 7 BR |
| Chi tiết Use Case | [USE_CASES.md](USE_CASES.md) | Đủ 13 UC, có luồng chính/ngoại lệ |
| RTM | [RTM.md](RTM.md) | Liên kết đủ 20 FR và 11 NFR; không phải tất cả đã PASS |
| Tiêu chí nghiệm thu | [tests/features](../tests/features) | 17 tệp / 34 scenario; parse đạt, BDD chưa chạy |
| C4, DFD, UML, ERD, Activity | [architecture](architecture/README.md) | 19 sơ đồ: 8 bộ ảnh/nguồn gốc của nhóm + 11 sơ đồ bổ sung; nguồn `.puml` hoặc `.dot`, kèm SVG và PNG |
| DDL và dữ liệu mẫu | [schema.sql](../database/schema.sql), [seed.sql](../database/seed.sql) | Thiết kế PostgreSQL 20 bảng; chạy thử đạt trên PGlite |
| Từ điển dữ liệu, giải thích 3NF | [DATA_DICTIONARY.md](../database/DATA_DICTIONARY.md) | Trường, kiểu, nullable, khóa, CHECK và index |
| OpenAPI | [docs/api/openapi.yaml](api/openapi.yaml) | 31 operation; bản tương thích ở `api/openapi.yaml` |
| Khung Gateway / Swagger UI | [gateway/mock.js](../gateway/mock.js) | Chạy `npm run mock`; dữ liệu giả lập |
| Kiểm thử và log | [Test Plan](TEST_PLAN.md), [Test Report](TEST_REPORT.md) | 25 test theo Node đều PASS; build PASS; phạm vi nêu trong báo cáo |
| CI | [ci.yml](../.github/workflows/ci.yml) | Cấu hình chạy trên push/PR; trạng thái thực xem GitHub Actions |
| Triển khai / sử dụng | [DEPLOYMENT.md](DEPLOYMENT.md), [USER_MANUAL.md](USER_MANUAL.md) | Có lệnh cài, chạy, thử, sao lưu, phục hồi và giới hạn |
| Timeline, phân công, rủi ro | [PROJECT_PLAN.md](PROJECT_PLAN.md) | Kế hoạch tuần 8–15; RACI dự kiến; chờ nhóm xác nhận |
| Nguồn và AI | [SOURCES.md](SOURCES.md), [AI_USAGE.md](AI_USAGE.md) | Nêu rõ nguồn và phần biên soạn bổ sung |
| Khoảng trống triển khai | [GAP_MATRIX.md](GAP_MATRIX.md) | Phân biệt local/thiết kế mục tiêu và việc còn thiếu |

## Cách kiểm tra nhanh

```sh
npm ci
npm run check
npm run test:coverage
npm run mock
```

Swagger UI: http://127.0.0.1:5188/docs. Ứng dụng local chạy riêng bằng `npm run dev` tại http://127.0.0.1:5173.

Thư mục `data/`, `test-results/`, `node_modules/`, tệp môi trường và log chạy ứng dụng không nằm trong bộ bàn giao. Không đưa dữ liệu bệnh nhân thật hoặc thông tin đăng nhập cá nhân vào repository.
