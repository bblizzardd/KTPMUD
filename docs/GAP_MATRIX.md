# Đối chiếu đặc tả và hiện trạng



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



## Bổ sung từ việc đóng gói
- Bộ DDL 3NF và OpenAPI mục tiêu được bổ sung riêng. Ứng dụng vẫn dùng SQLite JSON và API local hiện có; chưa có migration chuyển dữ liệu thực tế.
- Gateway mock không xác thực thật, không lưu giao dịch và không gửi thông báo. Có nhãn mock trong phản hồi; chỉ lắng nghe loopback.
- Audit local chứa tên gọi và chi tiết. Chưa có cơ chế tự kiểm tra người dùng nhập tên thật; NFR-05 cần review thêm.
- Chưa có triển khai Android/native, push thật, HTTPS production, tải 100 người dùng, AES-256 token theo thiết kế, thử phục hồi queue thật hoặc khảo sát nghiệm thu người dùng.
- TC-01…39 được giữ làm mã tham chiếu. AC mới chưa chạy BDD tự động. Unit/API local không thay thế nghiệm thu tất cả tiêu chí.

## Đối chiếu sơ đồ gốc mới bổ sung

Sơ đồ cữ thuốc còn ghi chú chưa chốt trạng thái muộn, trong khi FR-14 và mã local đã tách muộn. Sơ đồ đơn thuốc có trạng thái Hết hạn; DDL và mã local chưa có expired riêng. Các ảnh được giữ nguyên theo nguồn nhóm cung cấp; xem [ghi chú đối chiếu](architecture/README.md).
