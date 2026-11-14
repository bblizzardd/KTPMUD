# An Tâm v1.0 — Web App

Giao diện người chăm sóc và ứng dụng điện thoại mô phỏng (bệnh nhân / người nhà), theo Báo cáo Tuần 6 của nhóm N01-01. Mọi dữ liệu đọc và ghi qua Backend An Tâm (`../backend`). Cách chạy cả hệ thống xem [README ở thư mục gốc](../README.md).

## Lệnh

```powershell
npm install
npm run dev      # http://127.0.0.1:5173, cần Backend đang chạy ở cổng 8080
npm run build    # dist/ — Backend phục vụ bản này tại http://127.0.0.1:8080
npm test         # 18 kiểm thử
```

`.env.local` (không đưa lên Git) có thể đặt `VITE_DEMO_ACCOUNT=email:mật-khẩu` để trang đăng nhập hiện nút "Điền sẵn". Khi phát triển, `ANTAM_BACKEND` đổi địa chỉ Backend cho proxy của Vite.

## Đăng nhập web và app

Cả hai vai trò Bệnh nhân và Người chăm sóc có đăng nhập email/mật khẩu. Thêm `?surface=app` vào đường dẫn hash để dùng giao diện app, hoặc chuyển bằng nút Web/App. Bệnh nhân đăng nhập tới `#/benh-nhan`, người chăm sóc tới `#/tong-quan`. App hiện là giao diện trong trình duyệt.

Bệnh nhân đăng ký lần đầu bằng mã PATIENT 6 số do người chăm sóc cấp trong Hồ sơ & thiết bị để liên kết hồ sơ; các lần đăng nhập sau không cần mã. Bộ đệm và hàng đợi xác nhận của tài khoản bệnh nhân lưu trong sessionStorage của tab và xóa khi đăng xuất; nếu còn xác nhận chưa gửi, giao diện yêu cầu xác nhận trước khi đăng xuất. Thiết bị mô phỏng ghép bằng mã vẫn được hỗ trợ riêng.

## Màn hình theo báo cáo

Chỉ người chăm sóc quản lý hồ sơ được đính chính giờ uống: **Lịch cữ thuốc → mở lịch sử cữ → Đính chính giờ uống** ở từng thuốc. Bệnh nhân/người nhà chỉ bấm xác nhận với thời điểm bấm, không có ô chọn lại giờ. Lưu xác nhận khi offline vẫn giữ thời điểm bấm để đồng bộ; API đính chính dành riêng cho CAREGIVER.

| Màn hình | Chức năng (BPC) | UC / FR |
|---|---|---|
| Đăng nhập / Đăng ký | 1.1 | UC-01, FR-01 |
| Tổng quan | 5.1, 3.4 | UC-09, FR-19 (7/30/90 ngày), FR-12 |
| Lịch cữ thuốc | 3.1–3.4 | FR-09, FR-13–15, Bảng 6, Hình 4 |
| Đơn thuốc (nhập, xem lại, xác nhận) | 2.1–2.3 | UC-05, UC-06, FR-04–08, BR-02–04, Hình 5 |
| Chỉ số & tái khám | 4.1–4.2 | UC-11, UC-12, FR-16–17 |
| Báo cáo PDF (do Backend dựng) | 5.2 | UC-13, FR-20 |
| Nhật ký thao tác | 5.3 | FR-18, NFR-06 |
| Hồ sơ & thiết bị | 1.2–1.4 | UC-02–04, FR-01–03 |
| Điện thoại (`#/thiet-bi` hoặc khung bên phải) | 3.2–3.3 | UC-07, UC-08, NFR-01, US-08–12 |

Chuông cảnh báo trên thanh trên nhận sự kiện qua WebSocket `/ws/alerts` (FR-12, US-03).

## Cấu trúc mã

- `src/api/`: gọi REST. `http.js` lo token (sessionStorage của tab, tự đổi bằng refresh token khi hết hạn) và lỗi theo schema `Error`. `caregiver.js` và `device.js` có mỗi hàm ứng với một endpoint. `drugs.js` là bộ đệm danh mục thuốc.
- `src/app/`:
  - `query.js`: bộ đệm dữ liệu theo khóa `p:<patientId>:…`; thao tác ghi thì làm mới cả nhóm.
  - `realtime.js`: WebSocket cảnh báo.
  - `clock.js`: giờ theo máy chủ.
  - `AppContext.jsx`: phiên đăng nhập, thông báo, hàm `call`.
- `src/domain/rules.js`: luật dùng ở giao diện (xem trước số cữ sinh/hủy khi xác nhận đơn, kiểm tra form, gom cữ theo buổi, trùng hoạt chất), bám đúng quy ước của Backend.
- `src/device/`: ứng dụng điện thoại. Mỗi máy mô phỏng giữ token thiết bị, hàng đợi khi mất mạng và bản lưu lịch gần nhất trong `localStorage`, như bộ nhớ của một điện thoại thật.
- `src/lib/time.js`: ngày giờ tính theo giờ Việt Nam (UTC+07) giống Backend, không phụ thuộc múi giờ của máy.

## Lưu ý

- Ngày giờ hiển thị theo giờ máy chủ. Khi Backend bật `ENABLE_DEV_TOOLS=true`, "Công cụ kiểm thử" tua được đồng hồ máy chủ và thanh trên hiện chip "Giờ mô phỏng".
- Một cữ trên giao diện gom các thuốc cùng buổi. Mỗi thuốc vẫn là một cữ riêng trên máy chủ: bấm "Đã uống" gửi một xác nhận cho từng thuốc và báo lỗi riêng nếu có.
- Máy điện thoại thật sẽ nhận nhắc bằng FCM/APNs. Backend chưa gửi push, nên ứng dụng mô phỏng hỏi lại máy chủ mỗi 10 giây rồi tự đổ chuông khi đến giờ.
