# An Tâm 1.0 — ReactJS local

Ứng dụng hỗ trợ người chăm sóc theo dõi điều trị ngoại trú cho bệnh nhân đái tháo đường type 2, dựa trên **báo cáo Tuần 5**, cập nhật ngày 13/10/2026 trong thư mục cha.

## Bộ tài liệu bàn giao ngày 20/10/2026

- **[Mở danh mục bàn giao](docs/HANDOFF.md)** — liên kết tới tất cả tệp.
- [Đặc tả SRS v1.0](docs/SRS_v1.0.md), [RTM](docs/RTM.md), [sơ đồ nguồn và ảnh](docs/architecture/README.md).
- [DDL PostgreSQL và từ điển dữ liệu](database/DATA_DICTIONARY.md), [OpenAPI và mock](docs/api/README.md).
- [Kết quả kiểm tra thực tế](docs/TEST_REPORT.md), [cách cài đặt và kiểm tra](docs/DEPLOYMENT.md).

Các tệp thiết kế mục tiêu được đóng gói từ báo cáo tuần 6. Ứng dụng bên dưới vẫn là bản local SQLite; mock/DDL mục tiêu chưa thay thế backend hiện có. Xem [phần khác biệt và việc còn thiếu](docs/GAP_MATRIX.md).

## Chạy trên máy

Yêu cầu Node.js từ 22.13 (khuyến nghị Node 24 hoặc mới hơn). Đã phát triển và kiểm thử trên Windows với Node 25.9.

```powershell
cd C:\Users\Admin\Downloads\KTPMUD\antam-v1
npm install
npm run dev
```

Mở **http://localhost:5173**. Có thể nhấp đúp `start-local.cmd` sau khi đã cài thư viện.

- Nhấn **Trải nghiệm với dữ liệu mẫu** trên trang đăng nhập.
- Hoặc đăng nhập `demo@antam.local` / `AnTamDemo2026!`.
- Hoặc đăng ký tài khoản mới để bắt đầu với hồ sơ trống.
- Dữ liệu mẫu BN-TEST-001 là giả lập; đơn và liều chỉ để thử phần mềm.
- Dừng ứng dụng bằng Ctrl+C tại cửa sổ chạy ứng dụng.

```powershell
npm run build
npm start
npm test
```

`dev` chạy API Express và Vite trên cùng cổng. `start` phục vụ bản React đã build. Ứng dụng chỉ lắng nghe `127.0.0.1`, không công khai ra mạng.

## Chức năng đã triển khai

- Đăng ký/đăng nhập người chăm sóc, mật khẩu bcrypt, cookie HttpOnly SameSite Strict; phiên người chăm sóc 15 phút.
- Nhiều hồ sơ bệnh nhân; mỗi hồ sơ một người chăm sóc, chỉ tên gọi và năm sinh.
- Đơn nháp nhiều thuốc, tên tự do hoặc gợi ý từ danh mục minh họa, giữ tên gốc, kiểm tra ngày/liều/buổi.
- Chỉ sửa đơn nháp, kiểm tra trước khi xác nhận; thay thế đơn cũ và hủy cữ tương lai trong cùng giao dịch.
- Sinh lịch nhóm thuốc theo buổi đến ngày tái khám; không tạo bù cữ trước thời điểm kích hoạt.
- Ghép thiết bị bằng mã 6 chữ số, một lần, hạn 5 phút. Vai trò bệnh nhân hoặc người nhà; thu hồi thiết bị vô hiệu hóa phiên ngay.
- Màn hình bệnh nhân chữ lớn, xác nhận một chạm, phân biệt đúng hạn, xác nhận hộ và muộn. Bấm lặp không tạo thêm bản ghi.
- Đính chính thời điểm tạo bản ghi mới tham chiếu bản cũ; DB chặn UPDATE/DELETE xác nhận và nhật ký.
- Bộ lập lịch chạy mỗi 10 giây, đọc dữ liệu bền vững, phát hiện bỏ lỡ sau khi khởi động lại; cảnh báo không trùng.
- Tổng quan kỳ 7/30/90 ngày; lịch theo ngày và trạng thái; chỉ số HbA1c, đường huyết, lịch tái khám và nhắc trước ngày hẹn.
- Tải PDF tiếng Việt 30 ngày, có công thức tỷ lệ, người xác nhận, chỉ số và đính chính; nhật ký có tìm kiếm.
- Tên thuốc trùng hoạt chất được cảnh báo theo danh mục minh họa, không tự sửa đơn.

## Thử đầy đủ luồng

1. Đăng nhập mẫu → Gia đình & thiết bị → Ghép nối → chọn vai trò, tên gọi → tạo mã.
2. Mở cửa sổ ẩn danh hoặc trình duyệt khác trên cùng máy, vào URL local → Tôi là bệnh nhân / người nhà → nhập mã.
3. Khi cữ đã đến giờ, nhấn xác nhận. Trang người chăm sóc tự tải lại trong 10 giây.
4. Để thử không phải đợi nhiều giờ: trong Cài đặt hồ sơ, đặt giờ một buổi sau thời điểm hiện tại 1–2 phút. Tạo và xác nhận đơn mới có buổi đó. Giờ/ngưỡng mới chỉ áp dụng cho đơn xác nhận tiếp theo.
5. Duyệt một đơn khác để kiểm tra thay thế; đối chiếu lịch cữ cũ và mới. Xuất PDF trong mục Báo cáo.
6. Thu hồi thiết bị ở màn hình người chăm sóc; mọi yêu cầu tiếp theo từ thiết bị bị từ chối.

## Lưu dữ liệu và kiến trúc

- Frontend: ReactJS, Vite, CSS responsive, Lucide icons.
- Backend: Node.js, Express; SQLite dùng `node:sqlite`, dữ liệu lưu ở `data/antam.sqlite`. WAL giúp lưu dữ liệu qua lần khởi động lại. Không cần Docker.
- Phiên và mã ghép nối chỉ lưu băm SHA-256; token thô chỉ nằm trong cookie thiết bị. Không lưu push token vì chưa tích hợp push.
- Các thao tác nghiệp vụ ở `server/domain.js`; HTTP, xác thực, PDF và lịch nền ở `server/index.js`.
- PDF dùng Arial trên Windows; trên hệ khác đặt `PDF_FONT` đến font TTF có tiếng Việt.
- Sao lưu: dừng server, sao chép toàn bộ thư mục `data`. Không chia sẻ thư mục này như mã nguồn.
- Biến môi trường: `PORT` (mặc định 5173), `DB_PATH`, `NO_SEED=1` để tắt dữ liệu mẫu, `PDF_FONT`.

## Những điểm khác kiến trúc mục tiêu trong báo cáo

Đây là **bản chạy local**, chưa phải bản nghiệm thu toàn bộ NFR/SRS hoặc bản triển khai y tế thực tế:

| Nội dung | Bản local 1.0 |
|---|---|
| PostgreSQL / Redis / RabbitMQ / Worker riêng | SQLite và bộ lập lịch trong tiến trình Node; quét lại sau restart. Chưa có hàng đợi push bên ngoài. |
| Nhắc thuốc trên điện thoại | Thông báo trình duyệt khi tab bệnh nhân đang mở và được cấp quyền. Không có FCM/APNs, app Android hay push khi đóng tab. Chỉ dùng trên máy local. |
| Mất mạng | Xác nhận trên trang đang mở được lưu hàng đợi localStorage theo thiết bị và gửi lại khi online; giữ thời điểm bấm. Chưa có service worker/cache để mở lại ứng dụng hoàn toàn offline. Đơn mới giữ tạm trên trình duyệt. |
| HTTPS, JWT/refresh, email xác minh | HTTP loopback; phiên opaque 15 phút, cần đăng nhập lại khi hết hạn. Không có dịch vụ email hoặc refresh token. |
| Mã hóa token AES-256 | Token phiên lưu dưới dạng băm một chiều, không thể phục hồi; chưa có push token. Không tuyên bố đáp ứng thiết kế AES-256 trong báo cáo. |
| Danh mục thuốc / AI | Danh mục minh họa nhỏ, không phải danh mục chuẩn đã kiểm định. Gợi ý nhập tên và so trùng hoạt chất đơn giản; không dùng AI. |
| 120 phút | Chỉ là ngưỡng kiểm thử, cấu hình theo hồ sơ; cần xác nhận chuyên môn trước khi sử dụng thật. |
| Tỷ lệ tuân thủ | Hiển thị là tỷ lệ **ghi nhận đúng hạn**: (tự xác nhận đúng hạn + xác nhận hộ đúng hạn) / cữ đã đến giờ, loại cữ hủy. Muộn được tách riêng; chưa chứng minh việc uống thuốc. |
| NFR về tải, coverage, bảo mật, Android | Có kiểm thử nghiệp vụ và API; chưa chứng nhận p95/100 người dùng, coverage ≥80%, benchmark, Android hoặc đầy đủ 39 TC. |
| API | Giữ tiền tố `/api/v1`, rút gọn endpoint tổng quan; xử lý duyệt đơn/PDF đồng bộ. Chưa tương thích toàn bộ OpenAPI dự kiến (202/Worker). |

Font giao diện Be Vietnam Pro được tải từ Google Fonts khi có mạng; có font Arial dự phòng. Mọi dữ liệu nghiệp vụ lưu local, không gửi lên dịch vụ bên ngoài.

## Tài liệu kỹ thuật tham khảo

- React: https://react.dev/learn/build-a-react-app-from-scratch
- Vite: https://vite.dev/guide/
