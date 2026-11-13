# Backend An Tâm

Backend REST chạy thật cho dự án theo dõi điều trị ngoại trú. Thực hiện các endpoint trong [`../docs/api/openapi.yaml`](../docs/api/openapi.yaml) cùng phần mở rộng ghi ở [`docs/openapi-v1-mo-rong.yaml`](docs/openapi-v1-mo-rong.yaml) (thiết bị, cảnh báo đã đọc, lịch sử xác nhận, tải PDF, WebSocket...). Web App trong `../frontend` đã nối hẳn vào API này; khi có bản build (`frontend/dist`), Backend phục vụ luôn giao diện tại `http://127.0.0.1:8080/` (An Tâm v1.0, một cổng duy nhất). Xem [hướng dẫn tích hợp](docs/frontend-integration.md).

## Chạy local

Yêu cầu **Node.js 24 trở lên**. Trong PowerShell:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm start
```

Nếu dùng pnpm, chạy `pnpm install --frozen-lockfile` rồi `pnpm start`. `pnpm-lock.yaml` khóa phiên bản thư viện đã kiểm thử. Không cần cài database riêng cho bản local.

- API: `http://127.0.0.1:8080/api/v1`
- Kiểm tra hoạt động: `http://127.0.0.1:8080/health`
- Hợp đồng OpenAPI gốc: `http://127.0.0.1:8080/openapi.yaml`
- WebSocket cảnh báo: `ws://127.0.0.1:8080/ws/alerts`

Trên máy đang làm dự án, các thư viện đã được cài. Có thể mở `start-backend.cmd`; tệp này tự tìm Node trong runtime Codex nếu PATH của Node trên máy đang bị lỗi. Trên máy khác nên cài Node.js 24 và npm bình thường.

Tạo dữ liệu mẫu tùy chọn:

```powershell
npm run seed         # tạo dữ liệu giả nếu tài khoản demo chưa có
npm run reset-demo   # tắt server trước: xóa database, PDF và đồng hồ kiểm thử rồi seed lại
```

Dữ liệu mẫu đều là dữ liệu **giả**: hai hồ sơ "Bố" và "Mẹ", người nhà được ủy quyền, đơn cũ đã bị thay thế và đơn đang hiệu lực, 45 ngày lịch sử cữ thuốc kèm xác nhận (có một lần đính chính), cảnh báo, xét nghiệm, lịch hẹn, và một đơn nháp trùng hoạt chất. Lịch sử được ghi thẳng vào cơ sở dữ liệu vì API cố ý không nhận xác nhận lùi ngày. Các máy đã tạo ra lịch sử được đánh dấu đã thu hồi; muốn tiếp tục từ hôm nay thì ghép điện thoại mới trên Web App. Email/mật khẩu demo được in ra terminal; có thể đặt trước `DEMO_EMAIL` và `DEMO_PASSWORD` trong `.env`. Chạy lại không ghi đè tài khoản có sẵn. Server không tự tạo tài khoản mặc định khi khởi động.

`ENABLE_DEV_TOOLS=true` (không có tác dụng khi `NODE_ENV=production`) bật `GET/POST /api/v1/dev/clock`. Công cụ này tua đồng hồ server về phía trước rồi chạy ngay bộ lập lịch, để kiểm thử nhắc nhở, bỏ lỡ và cảnh báo mà không phải chờ. Độ lệch lưu ở `data/dev-clock.json`; `reset-demo` đưa đồng hồ về giờ thực.

## Phần đã triển khai

- Đăng ký, đăng nhập cho cả CAREGIVER và PATIENT trên web/app; JWT 15 phút, refresh token 30 ngày có xoay vòng và chặn dùng lại; mật khẩu băm scrypt. Đăng ký PATIENT cần mã liên kết PATIENT còn hiệu lực; một tài khoản cho mỗi hồ sơ. SQLite tự thêm bảng patientAccounts khi nâng cấp.
- Hồ sơ thuộc từng người chăm sóc; token thiết bị chỉ được đọc cữ hôm nay và xác nhận cho đúng bệnh nhân đã ghép.
- PIN 6 số dùng một lần, hết hạn sau 5 phút; thu hồi thiết bị/người nhà có hiệu lực ngay. Token thiết bị lưu dạng hash, push token mã hóa AES-256-GCM.
- Đơn nháp, kiểm tra trùng hoạt chất, xác nhận/thay thế/hủy; một đơn ACTIVE cho mỗi bệnh nhân, bảo vệ bằng transaction và unique index.
- Sinh cữ theo từng dòng thuốc, từng buổi và từng ngày; scheduler chuyển trạng thái, phát cảnh báo bỏ lỡ một lần và nhắc tái khám.
- Xác nhận PATIENT/DELEGATE, xác nhận muộn/offline, lịch sử đính chính bất biến. SQLite trigger chặn sửa/xóa confirmation và audit ngay cả khi truy cập qua lớp lưu trữ.
- Thống kê 7/30/90 ngày; xét nghiệm, lịch hẹn, cảnh báo đã đọc/chưa đọc, audit có phân trang.
- Báo cáo PDF tiếng Việt 30/60/90 ngày qua hàng đợi lưu trong database; tải file yêu cầu JWT và quyền trên hồ sơ.
- WebSocket chỉ gửi cảnh báo thuộc người chăm sóc đã xác thực. REST là nguồn để lấy lại cảnh báo sau khi mất kết nối.

## Quy ước nghiệp vụ đã chọn

1. Ngày nghiệp vụ theo **UTC+07 (Việt Nam)**; timestamp trả ISO UTC. Mỗi dòng thuốc có `times` để tự chọn giờ theo các buổi trong `slots`. Đơn cũ không có `times` dùng giờ mặc định của hồ sơ (07:00, 11:30, 15:00, 19:00 nếu chưa đổi). Ngưỡng bỏ lỡ cố định **60 phút** sau giờ hẹn.
2. Một `Dose` tương ứng **một dòng thuốc + một buổi + một ngày** đúng schema OpenAPI. UI demo đang gom nhiều thuốc vào một cữ, nên cần ánh xạ khi tích hợp.
3. `takenAt` là giờ uống được ghi nhận; `recordedAt` là thời điểm server nhận. Đúng giờ khi `scheduledAt - 60 phút <= takenAt <= scheduledAt + 60 phút`, kể cả qua nửa đêm; không nhận giờ uống ở tương lai hoặc sớm hơn cửa sổ. Sau cửa sổ là `LATE_CONFIRMED`, chỉ được ghi giờ uống trong ngày của cữ. Chấp nhận gửi lại offline tối đa 72 giờ và phân loại theo `takenAt`. Đúng mốc +60 phút vẫn trong hạn; quá mốc này chưa xác nhận thì `MISSED`. Khi khởi động, hồ sơ và các cữ chưa xác nhận ở trạng thái SCHEDULED/PENDING được cập nhật sang 60 phút, có ghi audit; lịch sử đã ghi nhận được giữ nguyên.
4. Xác nhận lặp trả `409`; đính chính phải tham chiếu xác nhận **mới nhất của cùng cữ**. Đính chính sửa thời điểm đã ghi nhận bằng bản ghi mới; chưa có nghiệp vụ rút lại xác nhận thành “chưa uống”.
5. Tỷ lệ = `(TAKEN + TAKEN_BY_DELEGATE) / (TAKEN + TAKEN_BY_DELEGATE + LATE_CONFIRMED + MISSED)`. Bỏ cữ chưa có kết quả và cữ hủy; không có kết quả thì trả 0. `INCLUDE_LATE_IN_RATE=true` đưa xác nhận muộn vào tử số. Đây là lựa chọn kỹ thuật cho điểm còn mở trong đặc tả.
6. Đổi giờ nhắc/ngưỡng trên hồ sơ áp dụng khi xác nhận đơn tiếp theo; cữ đã sinh giữ nguyên thời điểm để bảo toàn lịch sử.
7. Xác nhận đơn trả `202`; ở bản local, toàn bộ lịch được sinh trong cùng transaction trước khi trả về. Giới hạn 50.000 cữ/đơn. Báo cáo được xử lý bất đồng bộ, tối đa 3 tác vụ mỗi lượt; worker chạy mỗi 15 giây và khi khởi động, tiếp tục tác vụ QUEUED/PROCESSING sau restart.
8. Tên thuốc ngoài danh mục được lưu nguyên văn; không tự suy ra hoạt chất hay chỉnh sửa đơn. Danh mục 5 thuốc đi kèm chỉ là fixture để kiểm thử chức năng, không phải nguồn dữ liệu dược đã xác minh.

## Cấu hình và dữ liệu

Xem `.env.example`. Dữ liệu mặc định lưu ở `data/antam.sqlite`, PDF ở `data/reports/`. Khóa ngẫu nhiên local lưu tại `data/local-keys.json` để token không bị mất hiệu lực mỗi lần restart. Thư mục dữ liệu, `.env` và thư viện đều nằm trong `.gitignore`.

`JWT_SECRET` tối thiểu 32 ký tự; `TOKEN_ENCRYPTION_KEY` là 64 ký tự hex. `NODE_ENV=production` yêu cầu khai báo cả hai qua môi trường. Không đưa khóa hoặc dữ liệu bệnh nhân vào Git. Nếu đổi cổng/host công khai phải đổi `BASE_URL` tương ứng để link PDF chính xác. `CORS_ORIGINS` là danh sách origin frontend cách nhau bằng dấu phẩy.

PDF cần font hỗ trợ tiếng Việt: mặc định Arial trên Windows, DejaVu Sans trên Linux. Có thể đặt `PDF_FONT_PATH`; thiếu font thì job chuyển FAILED và ghi audit.

## Kiểm thử

```powershell
npm test
```

Bộ kiểm thử gọi HTTP thật vào ứng dụng với database tách biệt, kiểm tra phân quyền, refresh replay, dùng lại PIN, thu hồi thiết bị, thay thế đơn, xác nhận đồng thời, offline, mốc deadline, UTC+07, bất biến audit/confirmation, PDF và các luật nghiệp vụ. Kiểm thử không ghi vào database local của bạn.

## Cấu trúc

```text
src/app.js          Ghép routes, CORS, lỗi chuẩn, context ứng dụng
src/accounts.js     Auth, hồ sơ, người nhà, thiết bị
src/security.js     JWT, scrypt, token hash, AES-GCM
src/medication.js   Đơn thuốc, cữ, xác nhận, scheduler, thống kê
src/clinical.js     Xét nghiệm, lịch hẹn, cảnh báo, audit, PDF worker
src/realtime.js     WebSocket và xác thực kết nối
src/db.js           SQLite, migration, transaction, index, trigger
src/server.js       HTTP server, vòng worker và shutdown
src/devtools.js     Đồng hồ kiểm thử (chỉ khi ENABLE_DEV_TOOLS=true)
scripts/seed.js     Tạo dữ liệu demo tùy chọn
scripts/reset-demo.js  Xóa dữ liệu local rồi seed lại
test/              Kiểm thử tích hợp và nghiệp vụ
```

## Phạm vi của bản local

Kiến trúc C4 dự kiến PostgreSQL, Redis và RabbitMQ. Bản này dùng SQLite với các bảng theo thực thể và payload JSON có khóa ngoại/index, chưa phải mô hình PostgreSQL 3NF của báo cáo; chưa có adapter hay migration sang PostgreSQL. Scheduler và PDF worker chạy cùng một tiến trình Node. Nên triển khai một instance cho giai đoạn tích hợp/demo.

Push token đã có cơ chế lưu trữ bảo vệ, nhưng **chưa tích hợp gửi FCM/APNs hoặc email**, chưa có AI chuẩn hóa thuốc và chưa kiểm chứng tải/độ trễ theo NFR. Thông báo hiện có qua REST/WebSocket; ứng dụng điện thoại mô phỏng trên Web App hỏi lại `/device/doses/today` mỗi 10 giây và tự đổ chuông. Các phần PostgreSQL/queue/push cần hoàn thiện trước khi chuyển sang triển khai nhiều máy chủ và vận hành thực tế.

Điểm nghiệp vụ cần nhóm chốt: khi xác nhận đơn, lịch cữ được sinh từ **ngày bắt đầu** (kể cả các buổi đã qua giờ trong ngày đó). Vì vậy nếu nhập đơn vào buổi tối với ngày bắt đầu là hôm nay, các cữ sáng/trưa chưa được xác nhận sẽ chuyển ngay sang Bỏ lỡ và gửi cảnh báo. Web App cảnh báo trước điều này ở bước xem trước khi xác nhận đơn.

Tài liệu kỹ thuật tham chiếu: [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [Express error handling](https://expressjs.com/en/guide/error-handling/).
