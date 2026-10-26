# Kết nối Web App với Backend (An Tâm v1.0)

Web App trong `../../frontend` gọi thẳng API này; không còn lớp mô phỏng `localStorage`. Tài liệu này ghi các quy ước hai bên đã thống nhất khi tích hợp.

## Triển khai

- **Một cổng**: `npm run build` trong `frontend` tạo `frontend/dist`; Backend phục vụ thư mục này tại `/` (đổi bằng `FRONTEND_DIST`). Trình duyệt chỉ làm việc với một origin, nên request cùng origin được chấp nhận mà không cần khai trong `CORS_ORIGINS`.
- **Phát triển**: `npm run dev` trong `frontend` (cổng 5173). Vite chuyển tiếp `/api`, `/health`, `/ws` sang cổng 8080.
- Đặc tả phần mở rộng: [`openapi-v1-mo-rong.yaml`](openapi-v1-mo-rong.yaml).

## Xác thực

- Người chăm sóc: `POST /auth/login` → `{accessToken, refreshToken}`. Web App giữ cặp token trong `sessionStorage` của tab: tải lại trang vẫn còn phiên, đóng tab là hết. Khi gặp 401, Web App gọi `POST /auth/refresh` đúng một lần cho các request cùng lúc, lưu cặp token mới rồi gửi lại request. Refresh bị từ chối thì xóa phiên.
- Điện thoại: đổi mã 6 số qua `POST /devices/pair` (`deviceName` tùy chọn). Token thiết bị chỉ dùng cho `/device/*` và `POST /doses/:id/confirmations`. Khi nhận 401 (máy bị thu hồi hoặc người nhà bị bỏ quyền), ứng dụng hiện màn hình "đã bị ngắt kết nối".
- WebSocket `/ws/alerts`: khung đầu tiên là `{type:'authenticate', token}`. Mất kết nối thì Web App thử lại với độ trễ tăng dần; token hết hạn (mã đóng 4401) thì tự gia hạn token trước khi kết nối lại. Kết nối lại xong, Web App tải lại dữ liệu qua REST để bù sự kiện bị lỡ.

## Cữ thuốc và xác nhận

- Backend tạo **một cữ cho mỗi dòng thuốc × buổi × ngày**. Web App gom các thuốc cùng buổi để hiển thị một nút "Đã uống", nhưng gửi một request cho **từng** `dose.id` và báo riêng cữ nào lỗi.
- Gửi lại xác nhận khi có mạng: giữ nguyên `takenAt` lúc bấm. Lỗi mạng thì giữ phần chưa gửi trong hàng đợi. `409 DOSE_ALREADY_CONFIRMED` được tính là đã có người xác nhận. 401 thì dừng gửi.
- Đính chính: `{takenAt, correctsConfirmationId}` của bản ghi mới nhất. Giờ uống phải từ giờ nhắc tới hiện tại và cùng ngày của cữ; Web App kiểm tra trước bằng `checkConfirmable` trong `frontend/src/domain/rules.js`.
- `lastConfirmation` trong `Dose` và `GET /doses/:id/confirmations` có thêm `actorLabel` (tên gọi chủ máy) để hiển thị "Mẹ xác nhận hộ".

## Đơn thuốc

- Payload chỉ gồm `issuedDate, startDate, nextVisitDate, sourceNote?, items[{drugId?, drugNameRaw, unitsPerDose, unit?, slots, instruction?}]` (`toPrescriptionInput` trong `frontend/src/api/caregiver.js`).
- Trùng hoạt chất chỉ tính trên thuốc đã liên kết danh mục (`drugId`), giống `warnings` của Backend. Web App lấy hoạt chất qua `GET /drugs?q=` và `GET /drugs/:drugId`.
- Bước xem trước khi xác nhận tính theo đúng quy ước của Backend: sinh cữ từ `startDate` tới hết `nextVisitDate` theo giờ nhắc của hồ sơ; hủy những cữ `SCHEDULED` của đơn cũ có giờ sau thời điểm xác nhận.

## Ngày giờ

Cả hai bên tính ngày nghiệp vụ theo UTC+07, không phụ thuộc múi giờ của máy chạy trình duyệt. Web App lấy giờ máy chủ từ `GET /health` (trường `time`) nên giao diện và điện thoại mô phỏng cùng thấy giờ đã tua khi bật công cụ kiểm thử.
