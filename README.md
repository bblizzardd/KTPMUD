# An Tâm v1.0

Hệ thống hỗ trợ người chăm sóc theo dõi điều trị ngoại trú bệnh nhân cao tuổi mắc đái tháo đường type 2 (Khoa Nội tiết – ĐTĐ, BV Hữu Nghị). Nhóm N01-01, môn Kỹ thuật phần mềm ứng dụng, ĐHBK Hà Nội.

Gồm hai phần chạy chung trên một cổng:

| Thư mục | Vai trò |
|---|---|
| `backend/` | REST API `/api/v1`, WebSocket `/ws/alerts`, bộ lập lịch cữ thuốc, dựng PDF, SQLite. Phục vụ luôn bản build của Web App. |
| `frontend/` | Web App của người chăm sóc (React + Vite) và ứng dụng điện thoại mô phỏng cho bệnh nhân / người nhà. |
| `docs/api/openapi.yaml` | Đặc tả API gốc theo báo cáo Tuần 6 (24 đường dẫn). Phần mở rộng đã cài đặt: `backend/docs/openapi-v1-mo-rong.yaml`. |

## Chạy để kiểm thử

Cần **Node.js 24 trở lên**. Trên Windows chỉ cần nhấp đúp **`AnTam.cmd`**: tệp này cài thư viện nếu thiếu, tạo cấu hình chạy thử, dựng giao diện, tạo dữ liệu mẫu lần đầu, rồi mở http://127.0.0.1:8080.

Tài khoản demo: `demo@antam.vn` / `AnTam@2026` (trang đăng nhập có nút "Điền sẵn").

Chạy thủ công:

```powershell
cd backend;  npm install; Copy-Item .env.example .env   # rồi thêm DEMO_EMAIL, DEMO_PASSWORD, ENABLE_DEV_TOOLS=true nếu muốn
cd ..\frontend; npm install; npm run build
cd ..\backend; npm run seed; npm start                    # http://127.0.0.1:8080
```

Phát triển giao diện có tải lại nóng: giữ `npm start` ở `backend`, chạy `npm run dev` ở `frontend` rồi mở http://127.0.0.1:5173 (Vite chuyển tiếp `/api`, `/ws`, `/health` sang cổng 8080).

## Kịch bản kiểm thử gợi ý

1. **Tổng quan / Lịch cữ thuốc**: dữ liệu mẫu có 45 ngày lịch sử của "Bố", gồm tự xác nhận, xác nhận hộ, xác nhận muộn, bỏ lỡ và một lần đính chính.
2. **Ghép điện thoại** (Hồ sơ & thiết bị → Tạo mã 6 số → "Nhập mã trên điện thoại mô phỏng"). Máy cũ trong dữ liệu mẫu đã bị thu hồi nên phải ghép máy mới.
3. **Nhắc thuốc**: mở "Công cụ kiểm thử" (góc trái dưới) → "Tới giờ cữ kế tiếp" → điện thoại đổ chuông → bấm ĐÃ UỐNG. Thử "Mất mạng" trước khi bấm để xem lưu tạm rồi gửi lại.
4. **Bỏ lỡ và cảnh báo**: ghép thêm máy cho người nhà "Mẹ", bấm "Cho cữ đang chờ quá hạn". Chuông cảnh báo trên Web App và máy người nhà cùng báo; người nhà có thể xác nhận muộn.
5. **Đơn thuốc**: hồ sơ "Mẹ" có đơn nháp trùng hoạt chất metformin. Xem lại, đánh dấu đã hỏi bác sĩ rồi xác nhận. Thêm đơn mới cho "Bố" để thấy đơn cũ chuyển sang Bị thay thế.
6. **Báo cáo PDF**, **Chỉ số & tái khám**, **Nhật ký thao tác** (thử "Thử xóa nhật ký" → máy chủ trả 405).

Đồng hồ máy chủ chỉ tua tiến. Muốn về giờ thực và dữ liệu mẫu ban đầu: tắt máy chủ, chạy `npm run reset-demo` trong `backend`.

## Kiểm thử tự động

```powershell
cd backend;  npm test    # 31 kiểm thử tích hợp HTTP + nghiệp vụ
cd frontend; npm test    # 18 kiểm thử luật nghiệp vụ phía giao diện + lớp gọi API
```
