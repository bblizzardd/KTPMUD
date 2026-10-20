# Đặc tả 13 Use Case

Ngày 20/10/2026. Các luồng bổ sung được biên soạn theo báo cáo và mã local; chưa phải biên bản nghiệm thu.

## UC-01 — Đăng ký, đăng nhập

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-01.
- Tiền điều kiện: Chưa đăng nhập.
- Hậu điều kiện: Tài khoản được tạo hoặc phiên hợp lệ được cấp.
- Luồng chính: Nhập email, mật khẩu; hệ thống kiểm tra; tạo tài khoản hoặc phiên.
- Ngoại lệ/luồng phụ: Email trùng, mật khẩu sai hoặc thiếu trường: từ chối; không tạo phiên.

## UC-02 — Tạo hồ sơ bệnh nhân

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-01.
- Tiền điều kiện: Người chăm sóc đã đăng nhập.
- Hậu điều kiện: Hồ sơ gắn đúng người chăm sóc.
- Luồng chính: Nhập tên gọi, năm sinh; kiểm tra dữ liệu; lưu và hiển thị hồ sơ.
- Ngoại lệ/luồng phụ: Năm sinh không hợp lệ hoặc thiếu quyền: từ chối.

## UC-03 — Ghép nối thiết bị bệnh nhân

- Tác nhân: Người chăm sóc, Bệnh nhân.
- Yêu cầu: FR-02.
- Tiền điều kiện: Người chăm sóc sở hữu hồ sơ.
- Hậu điều kiện: Thiết bị gắn đúng hồ sơ và vai trò.
- Luồng chính: Tạo mã một lần; nhập mã trên thiết bị; kiểm tra hạn; cấp token; đánh dấu mã đã dùng.
- Ngoại lệ/luồng phụ: Mã sai, hết hạn hoặc đã dùng: không cấp token.

## UC-04 — Ủy quyền người nhà

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-03.
- Tiền điều kiện: Người chăm sóc sở hữu hồ sơ.
- Hậu điều kiện: Quyền xác nhận hộ được cấp hoặc thu hồi.
- Luồng chính: Chọn người nhà; ghép thiết bị vai trò delegate; khi thu hồi, vô hiệu quyền và phiên.
- Ngoại lệ/luồng phụ: Thiết bị đã bị thu hồi: mọi thao tác xác nhận tiếp theo bị từ chối.

## UC-05 — Nhập đơn thuốc

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-04, FR-05.
- Tiền điều kiện: Người chăm sóc có quyền trên hồ sơ.
- Hậu điều kiện: Đơn nháp được lưu, chưa sinh cữ.
- Luồng chính: Nhập ngày và từng dòng thuốc; gợi ý danh mục hoặc giữ tên gốc; kiểm tra ngày/liều/buổi; lưu nháp.
- Ngoại lệ/luồng phụ: Dữ liệu thiếu hoặc ngày sai: báo lỗi; không lưu đơn không hợp lệ.

## UC-06 — Xác nhận đơn thuốc

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-06, FR-07, FR-08.
- Tiền điều kiện: Đơn hợp lệ, đang nháp; người chăm sóc có quyền.
- Hậu điều kiện: Đơn mới hiệu lực; đơn cũ thay thế; cữ tương lai cũ hủy; cữ mới được lập.
- Luồng chính: Đối chiếu đơn; kiểm tra trùng hoạt chất; xác nhận; cập nhật trạng thái trong giao dịch; sinh lịch.
- Ngoại lệ/luồng phụ: Đơn không còn nháp/gọi lặp: từ chối. Lỗi giao dịch: rollback. Local sinh lịch đồng bộ; mục tiêu worker bất đồng bộ.

## UC-07 — Xác nhận đã uống thuốc

- Tác nhân: Bệnh nhân.
- Yêu cầu: FR-11, FR-13, FR-14, FR-15.
- Tiền điều kiện: Thiết bị bệnh nhân còn quyền, cữ đã tới giờ và chưa hủy.
- Hậu điều kiện: Có ghi nhận tự xác nhận hoặc muộn, giữ người và thời điểm.
- Luồng chính: Hiển thị cữ; bấm Đã uống; kiểm tra quyền; lưu xác nhận; cập nhật trạng thái; trả kết quả.
- Ngoại lệ/luồng phụ: Gửi lặp: trả bản ghi hiện có. Offline: xếp hàng và gửi lại khi có mạng. Đính chính thêm bản mới; không sửa/xóa cũ.

## UC-08 — Xác nhận hộ

- Tác nhân: Người nhà sống cùng.
- Yêu cầu: FR-13, FR-15.
- Tiền điều kiện: Thiết bị người nhà còn ủy quyền.
- Hậu điều kiện: Xác nhận ghi vai trò người nhà; phân biệt đúng hạn/muộn.
- Luồng chính: Chọn cữ đã đến; bấm xác nhận hộ; kiểm tra quyền; ghi người, vai trò, thời điểm.
- Ngoại lệ/luồng phụ: Thu hồi quyền, sai hồ sơ hoặc trước giờ: từ chối.

## UC-09 — Theo dõi tổng quan tuân thủ

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-19.
- Tiền điều kiện: Người chăm sóc có quyền xem hồ sơ.
- Hậu điều kiện: Hiển thị kỳ chọn và công thức tỷ lệ.
- Luồng chính: Chọn kỳ 7/30/90 ngày; lấy cữ đã đến; loại cữ hủy; phân nhóm; tính tỷ lệ đúng hạn.
- Ngoại lệ/luồng phụ: Không có cữ hợp lệ: hiển thị chưa có dữ liệu, không chia cho 0.

## UC-10 — Phát nhắc và phát hiện cữ bỏ lỡ

- Tác nhân: Bộ lập lịch.
- Yêu cầu: FR-09, FR-10, FR-12.
- Tiền điều kiện: Đơn hiệu lực, có cữ và mốc nhắc.
- Hậu điều kiện: Nhắc hoặc cảnh báo được ghi; không tạo cảnh báo trùng.
- Luồng chính: Quét cữ; tới giờ thì nhắc; quá hạn chưa xác nhận thì đánh dấu bỏ lỡ; cảnh báo người có quyền.
- Ngoại lệ/luồng phụ: Khởi động lại: đọc cữ bền vững; xử lý lũy đẳng. Push ngoài ứng dụng chưa có trong bản local.

## UC-11 — Ghi nhận chỉ số xét nghiệm

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-16.
- Tiền điều kiện: Người chăm sóc có quyền.
- Hậu điều kiện: Chỉ số được lưu kèm loại, giá trị, đơn vị, ngày.
- Luồng chính: Chọn loại; nhập số và ngày; kiểm tra; lưu; hiển thị lịch sử.
- Ngoại lệ/luồng phụ: Sai đơn vị, giá trị không hợp lệ hoặc ngày tương lai: từ chối.

## UC-12 — Nhắc lịch tái khám

- Tác nhân: Bộ lập lịch.
- Yêu cầu: FR-17.
- Tiền điều kiện: Có lịch tái khám và số ngày nhắc trước.
- Hậu điều kiện: Có nhắc lịch trong khoảng đã cấu hình.
- Luồng chính: Lưu lịch; bộ lập lịch kiểm tra; tạo nhắc; đánh dấu tránh trùng.
- Ngoại lệ/luồng phụ: Lịch sai ngày hoặc số ngày nhắc âm: từ chối; đơn bị thay thế không tiếp tục nhắc lịch của đơn đó.

## UC-13 — Xuất báo cáo PDF

- Tác nhân: Người chăm sóc.
- Yêu cầu: FR-20.
- Tiền điều kiện: Người chăm sóc có quyền và chức năng xuất báo cáo sẵn sàng.
- Hậu điều kiện: PDF có lịch sử 30 ngày, tỷ lệ, vai trò xác nhận và chỉ số.
- Luồng chính: Chọn xuất; lấy dữ liệu trong kỳ; dựng PDF; trả tệp; ghi nhật ký.
- Ngoại lệ/luồng phụ: Không có quyền: từ chối. Không có dữ liệu: báo cáo rỗng rõ ràng. Thiếu font/lỗi tạo tệp: báo lỗi, không trả thành công.
