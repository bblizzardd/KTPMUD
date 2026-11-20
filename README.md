# An Tâm v1.0

Hệ thống hỗ trợ người chăm sóc theo dõi điều trị ngoại trú bệnh nhân cao tuổi mắc đái tháo đường type 2 (Khoa Nội tiết – ĐTĐ, BV Hữu Nghị). Nhóm N01-01, môn Kỹ thuật phần mềm ứng dụng, ĐHBK Hà Nội.

Gồm hai phần chạy chung trên một cổng:

| Thư mục | Vai trò |
|---|---|
| `backend/` | REST API `/api/v1`, WebSocket `/ws/alerts`, bộ lập lịch cữ thuốc, dựng PDF, SQLite. Phục vụ luôn bản build của Web App. |
| `frontend/` | Giao diện web và app (React + Vite) có đăng nhập cho cả bệnh nhân và người chăm sóc; điện thoại mô phỏng hỗ trợ ghép thiết bị cho bệnh nhân / người nhà. |
| `docs/api/openapi.yaml` | Đặc tả API gốc theo báo cáo Tuần 6 (24 đường dẫn). Phần mở rộng đã cài đặt: `backend/docs/openapi-v1-mo-rong.yaml`. |

## Hướng dẫn sử dụng

### Người chăm sóc

1. Chọn **Tôi là Người Chăm Sóc**, đăng nhập và tạo hồ sơ bằng tên gọi trong gia đình và năm sinh. Nếu quản lý nhiều người, chọn đúng hồ sơ trước khi nhập đơn hoặc ghi nhận uống thuốc.
2. Vào **Hồ sơ & thiết bị → Tạo mã 6 số**. Để liên kết tài khoản bệnh nhân, chọn tên bệnh nhân rồi gửi mã cho họ khi đăng ký. Để người nhà xác nhận hộ trên điện thoại riêng, thêm họ vào **Người nhà được ủy quyền**, tạo mã cho đúng người và ghép máy. Mỗi mã dùng một lần trong 5 phút. Có thể thu hồi máy hoặc quyền tại đây.
3. Vào **Đơn thuốc → Thêm đơn thuốc**. Nhập ngày kê, ngày bắt đầu, ngày tái khám, thuốc, liều và giờ uống theo đơn. Chọn **Lưu nháp và xem lại**, kiểm tra cảnh báo trùng hoạt chất rồi **Xác nhận đơn** để tạo lịch. Nếu thay đơn đang dùng, xem số cữ sẽ bị hủy trước khi xác nhận.
4. Để **xác nhận hộ**, vào **Lịch cữ thuốc**, mở cữ và bấm **Xác nhận hộ** ở thuốc người bệnh vừa uống. Hệ thống ghi tên người bấm và giờ hiện tại. Nếu ghi nhầm giờ, chọn **Sửa giờ → Lưu**. Các lần sửa nằm trong **Lịch sử sửa giờ**.
5. Xem cữ chưa xác nhận và cảnh báo tại **Tổng quan**. **Đã gọi nhắc** đánh dấu đã xử lý cảnh báo. Để ghi nhận người bệnh đã uống, dùng **Xác nhận hộ**.

### Bệnh nhân

Chọn **Tôi là Bệnh Nhân → Đăng ký** và nhập mã liên kết do người chăm sóc cấp. Những lần sau, đăng nhập bằng email và mật khẩu. Web và giao diện app dùng chung tài khoản. Thiết bị cũng có thể ghép bằng mã để nhận lịch.

Xem tên thuốc, liều và giờ của cữ hôm nay. Sau khi uống, bấm **Xác nhận đã uống**. Có thể đổi cỡ chữ bằng nút cạnh lời chào.

Khi có mạng, điện thoại tải lịch hôm nay và 6 ngày tiếp theo. Khi mất mạng, giữ app mở để nhận lời nhắc theo lịch đã tải, kể cả khi sang ngày mới. Xác nhận được lưu trên máy và gửi khi kết nối lại. Nếu thấy **Chưa tải lịch hôm nay**, bật mạng để cập nhật lịch.

### Đọc lịch và chuẩn bị tái khám

| Mục | Cách sử dụng |
|---|---|
| Lịch cữ thuốc | Khoảng đúng giờ tính từ 60 phút trước đến 60 phút sau giờ hẹn. Sau hạn, cữ chưa có xác nhận sẽ hiện **Bỏ lỡ**. Nếu xác nhận sau hạn trong ngày của cữ, hệ thống ghi **Xác nhận muộn**. |
| Tổng quan | Tỷ lệ đúng hạn bằng số cữ tự xác nhận hoặc xác nhận hộ đúng giờ chia cho số cữ đã có kết quả, gồm cả cữ muộn và bỏ lỡ. Mỗi thuốc trong một buổi được tính riêng. |
| Chỉ số & tái khám | Ghi ngày đo, kết quả và đơn vị theo phiếu xét nghiệm. Thêm ngày tái khám, chọn số ngày nhắc trước và đánh dấu khi đã đi khám. |
| Báo cáo | Chọn kỳ 30, 60 hoặc 90 ngày, bấm **Tạo báo cáo**. Khi báo cáo sẵn sàng, chọn **Xem** hoặc **Tải PDF** để mang đi khám. |
| Nhật ký thao tác | Tìm theo người thực hiện hoặc lọc theo thao tác, vai trò. Bấm một dòng khi cần xem chi tiết. |

Các tình huống như quên xác nhận, mất mạng hoặc đổi điện thoại có trong [hướng dẫn chi tiết](docs/HUONG_DAN_SU_DUNG.md#tra-cuu).

## Chạy để kiểm thử

Cần **Node.js 22 trở lên**. Trên Windows chỉ cần nhấp đúp **`AnTam.cmd`**: tệp này cài thư viện nếu thiếu, tạo cấu hình chạy thử, dựng giao diện, tạo dữ liệu mẫu lần đầu, rồi mở http://127.0.0.1:8080.

Tài khoản demo: `demo@antam.vn` / `AnTam@2026` (trang đăng nhập có nút "Điền sẵn").

Chạy thủ công:

Tại thư mục gốc **`dev`**, có thể chạy cả frontend và backend trong một terminal:

```powershell
npm run setup   # chỉ cần khi chưa cài thư viện
npm run dev    # mở http://127.0.0.1:5173, tự chạy cả backend ở cổng 8080
```

Hoặc chạy `npm start` tại `dev` để build giao diện và phục vụ cả ứng dụng tại **http://127.0.0.1:8080**. Nhấn `Ctrl+C` để dừng. Các lệnh này sử dụng cấu hình `backend/.env` và dữ liệu hiện có; không tự đặt lại dữ liệu. Nếu cần tạo dữ liệu mẫu lần đầu, dùng `AnTam.cmd` hoặc lệnh seed bên dưới.

Các lệnh riêng cho từng thư mục:

```powershell
cd backend;  npm install; Copy-Item .env.example .env   # rồi thêm DEMO_EMAIL, DEMO_PASSWORD, ENABLE_DEV_TOOLS=true nếu muốn
cd ..\frontend; npm install; npm run build
cd ..\backend; npm run seed; npm start                    # http://127.0.0.1:8080
```

Phát triển giao diện có tải lại nóng: giữ `npm start` ở `backend`, chạy `npm run dev` ở `frontend` rồi mở http://127.0.0.1:5173 (Vite chuyển tiếp `/api`, `/ws`, `/health` sang cổng 8080).

## Kịch bản kiểm thử gợi ý

1. **Tổng quan / Lịch cữ thuốc**: dữ liệu mẫu có 45 ngày lịch sử của "Bố", gồm tự xác nhận, xác nhận hộ, xác nhận muộn, bỏ lỡ và một lần đính chính.
2. **Ghép điện thoại** (Hồ sơ & thiết bị → Tạo mã 6 số → "Nhập mã trên điện thoại mô phỏng"). Máy cũ trong dữ liệu mẫu đã bị thu hồi nên phải ghép máy mới.
3. **Nhắc thuốc**: mở "Mô phỏng thời gian" (góc trái dưới) → "Tới cữ tiếp theo" → điện thoại đổ chuông → bấm XÁC NHẬN ĐÃ UỐNG. Thử "Mất mạng" trước khi bấm để xem lưu tạm rồi gửi lại.
4. **Bỏ lỡ và cảnh báo**: ghép thêm máy cho người nhà "Mẹ", bấm "Skip quá giờ" để tua tới một phút sau hạn xác nhận của cữ chưa uống gần nhất. Chuông cảnh báo trên Web App và máy người nhà cùng báo; người nhà có thể xác nhận muộn.
5. **Đơn thuốc**: hồ sơ "Mẹ" có đơn nháp trùng hoạt chất metformin. Xem lại, đánh dấu đã hỏi bác sĩ rồi xác nhận. Thêm đơn mới cho "Bố" để thấy đơn cũ chuyển sang Bị thay thế.
6. **Báo cáo PDF**, **Chỉ số & tái khám**, **Nhật ký thao tác**.

Mỗi lần khởi động backend ở chế độ mô phỏng, đồng hồ bắt đầu lúc **06:00 ngày hiện tại tại Việt Nam (UTC+07)**, sau đó chạy theo thời gian thực và các lần tua tiến. Không lưu độ lệch giữa các lần khởi động. Khởi động lại không xóa hồ sơ, đơn thuốc, xác nhận hoặc trạng thái cữ đã lưu; muốn chạy lại toàn bộ kịch bản từ dữ liệu mẫu, tắt máy chủ rồi chạy `npm run reset-demo` trong `backend` (lệnh này xóa dữ liệu demo hiện tại). Giờ nhập và hiển thị thống nhất dạng **HH:mm, 24h**. Mô phỏng bật mặc định khi chạy local, có thể tắt bằng `ENABLE_DEV_TOOLS=false`; môi trường production dùng giờ thực.

## Kiểm thử tự động

Quy tắc giờ uống đã chốt: **±60 phút** quanh giờ hẹn được tính đúng giờ (gồm cả hai mốc); sau giờ hẹn hơn 60 phút chưa xác nhận sẽ tính bỏ lỡ. Khi nhập/sửa đơn nháp, chọn buổi và tự chọn giờ cho từng thuốc. Khởi động lại backend sau khi cập nhật mã để áp dụng ngưỡng mới cho các cữ đang chờ/chưa đến giờ; không cần đặt lại dữ liệu.

```powershell
cd backend;  npm test    # 31 kiểm thử tích hợp HTTP + nghiệp vụ
cd frontend; npm test    # 18 kiểm thử luật nghiệp vụ phía giao diện + lớp gọi API
```
