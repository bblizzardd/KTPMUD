# SRS v1.0 — Nội dung trích từ báo cáo tuần 6

Nguồn: `KTPMUD/output/N01-01_Phùng Tuấn Tài_20_Trần Đức Trí_65_Trần Nguyễn Phúc Bình_Tuần 6.docx`. Ngày chuyển định dạng: 20/10/2026.

**Đây là bản chuyển các bảng đặc tả và ràng buộc có sẵn sang Markdown, không bổ sung yêu cầu hoặc tự hoàn thiện phần còn thiếu.** Nội dung là đặc tả trong báo cáo, chưa đồng nghĩa với chức năng đã triển khai. Hiện trạng ứng dụng xem [README](../README.md); nguồn từng tệp xem [SOURCES.md](SOURCES.md).

Báo cáo có 4 mục tiêu BIZ, 17 US, danh sách 13 UC, 20 FR, 11 NFR và 7 BR. Các mục chi tiết UC dưới đây chỉ gồm những bảng đã có trong báo cáo, không tự soạn thêm bảng cho các UC còn lại.

## Ràng buộc nghiệp vụ

- BR-01. Mỗi người chăm sóc quản lý một hoặc nhiều bệnh nhân; ở phiên bản 1, mỗi bệnh nhân có đúng một người chăm sóc chính.
- BR-02. Tại mỗi thời điểm, một bệnh nhân có tối đa một đơn thuốc ở trạng thái Hiệu lực.
- BR-03. Chỉ đơn ở trạng thái Hiệu lực mới sinh cữ thuốc; khi đơn mới được xác nhận, đơn cũ chuyển sang Bị thay thế và các cữ tương lai của đơn cũ chuyển sang Đã hủy.
- BR-04. Dòng thuốc được phép không liên kết với danh mục (tên tự do), nhưng luôn phải lưu tên gốc như trên đơn.
- BR-05. Bản ghi xác nhận chỉ được thêm, không được sửa hoặc xóa; bấm nhầm được đính chính bằng một bản ghi mới tham chiếu tới bản ghi cũ.
- BR-06. Mỗi xác nhận ghi rõ vai trò và định danh người thực hiện.
- BR-07. Hệ thống không lưu định danh thật: bệnh nhân chỉ có tên gọi trong gia đình và năm sinh.

## Các bên liên quan

*Nguồn: Bảng 9 trong báo cáo tuần 6.*

| Nhóm | Đối tượng | Vai trò với hệ thống | Nỗi đau chính |
| --- | --- | --- | --- |
| Customer | Người con (người chăm sóc chính) | Quyết định sử dụng, thiết lập và quản trị hồ sơ | Không biết bố mẹ đã uống thuốc chưa; phải gọi hỏi lặp lại |
| End-user trực tiếp | Người con | Nhập đơn, giám sát, nhận cảnh báo, xuất báo cáo | Mất thời gian, thông tin thiếu chính xác |
| End-user trực tiếp | Bệnh nhân cao tuổi | Nhận nhắc, xác nhận một chạm | Hay quên liều, ngại công nghệ, sợ làm phiền con |
| End-user trực tiếp | Người nhà sống cùng | Xác nhận hộ, nhận cảnh báo tại chỗ | Nhắc trùng với người khác, không rõ trách nhiệm |
| Hưởng lợi gián tiếp | Bác sĩ điều trị | Đọc báo cáo do người chăm sóc mang tới | Thiếu số liệu tuân thủ khách quan |

## Vai trò trong hệ thống

*Nguồn: Bảng 5 trong báo cáo tuần 6.*

| Người dùng thật | Vai trò trong hệ thống | Use case |
| --- | --- | --- |
| Người con (người chăm sóc chính) | Quản trị hồ sơ; nhập và xác nhận đơn thuốc; giám sát; nhận cảnh báo; xuất báo cáo | UC-01 đến UC-06, UC-09, UC-11, UC-13 |
| Bệnh nhân cao tuổi | Nhận nhắc nhở; xác nhận đã uống | UC-07 |
| Người nhà sống cùng | Xác nhận hộ; nhận cảnh báo tại chỗ | UC-08 |
| Bác sĩ điều trị | Đọc báo cáo do người chăm sóc mang tới; nằm ngoài hệ thống | Không có |
| Bộ lập lịch (tác nhân thời gian) | Kích hoạt nhắc nhở, chuyển trạng thái quá hạn, nhắc tái khám | UC-10, UC-12 |

## Mục tiêu nghiệp vụ

*Nguồn: Bảng 10 trong báo cáo tuần 6.*

| Mã | Mục tiêu nghiệp vụ đo được |
| --- | --- |
| BIZ-01 | Hỗ trợ cải thiện việc ghi nhận và theo dõi cữ thuốc trong chu kỳ 30 ngày. Chỉ tiêu mục tiêu X% và cách tính cần chốt; dữ liệu tự xác nhận không tự chứng minh bệnh nhân đã uống thuốc hoặc hiệu quả điều trị. |
| BIZ-02 | Rút ngắn thời gian người chăm sóc cần để nắm tình hình điều trị, từ gọi điện hỏi nhiều lần mỗi tuần xuống một lần mở ứng dụng. |
| BIZ-03 | Cung cấp lịch sử ghi nhận 30 ngày, phân biệt bệnh nhân tự xác nhận, xác nhận hộ và xác nhận muộn để bác sĩ tham khảo tại tái khám. |
| BIZ-04 | Giảm rào cản công nghệ cho bệnh nhân cao tuổi: không đăng nhập, không nhập liệu, tối đa một thao tác cho mỗi cữ thuốc. |

## Các thực thể dữ liệu

*Nguồn: Bảng 7 trong báo cáo tuần 6.*

| Thực thể | Ý nghĩa | Thuộc tính chính |
| --- | --- | --- |
| Người chăm sóc | Tài khoản người con | email, tên hiển thị, mật khẩu băm |
| Bệnh nhân | Hồ sơ được theo dõi | tên gọi trong gia đình, năm sinh, mốc giờ nhắc, ngưỡng bỏ lỡ |
| Thiết bị | Điện thoại đã ghép nối | vai trò, push token, nền tảng, trạng thái |
| Người nhà ủy quyền | Người được xác nhận hộ | tên gọi, quan hệ, trạng thái hiệu lực |
| Thuốc, Hoạt chất | Danh mục chuẩn | tên biệt dược, số đăng ký; tên hoạt chất, hàm lượng |
| Đơn thuốc | Một lần kê đơn | ngày kê, ngày bắt đầu, ngày tái khám, trạng thái |
| Dòng thuốc | Một thuốc trong đơn | tên gốc trên đơn, liên kết danh mục, số đơn vị mỗi lần, buổi uống |
| Cữ thuốc | Một lần uống dự kiến | thời điểm dự kiến, hạn xác nhận, trạng thái |
| Xác nhận | Một lần bấm xác nhận | vai trò, người thực hiện, thời điểm uống, thời điểm ghi, bản ghi được đính chính |
| Cảnh báo | Thông báo cho người chăm sóc | loại, nội dung, đã đọc |
| Chỉ số, Lịch hẹn | Kết quả xét nghiệm, ngày tái khám | loại xét nghiệm, giá trị, đơn vị, ngày |
| Nhật ký thao tác | Ghi vết | thời điểm, người dùng, loại thao tác, trạng thái, đối tượng |

## Danh sách Use Case

*Nguồn: Bảng 11 trong báo cáo tuần 6.*

| Mã | Tên use case | Tác nhân chính | FR |
| --- | --- | --- | --- |
| UC-01 | Đăng ký, đăng nhập | Người chăm sóc | FR-01 |
| UC-02 | Tạo hồ sơ bệnh nhân | Người chăm sóc | FR-01 |
| UC-03 | Ghép nối thiết bị bệnh nhân | Người chăm sóc, Bệnh nhân | FR-02 |
| UC-04 | Ủy quyền người nhà | Người chăm sóc | FR-03 |
| UC-05 | Nhập đơn thuốc | Người chăm sóc | FR-04, FR-05 |
| UC-06 | Xác nhận đơn thuốc | Người chăm sóc | FR-06, FR-07, FR-08 |
| UC-07 | Xác nhận đã uống thuốc | Bệnh nhân | FR-11, FR-13, FR-14, FR-15 |
| UC-08 | Xác nhận hộ | Người nhà sống cùng | FR-13, FR-15 |
| UC-09 | Theo dõi tổng quan tuân thủ | Người chăm sóc | FR-19 |
| UC-10 | Phát nhắc và phát hiện cữ bỏ lỡ | Bộ lập lịch | FR-09, FR-10, FR-12 |
| UC-11 | Ghi nhận chỉ số xét nghiệm | Người chăm sóc | FR-16 |
| UC-12 | Nhắc lịch tái khám | Bộ lập lịch | FR-17 |
| UC-13 | Xuất báo cáo PDF | Người chăm sóc | FR-20 |

## Đặc tả UC-05 và UC-06

*Nguồn: Bảng 12 trong báo cáo tuần 6.*

| Mục | UC-05 và UC-06: Nhập và xác nhận đơn thuốc |
| --- | --- |
| Tác nhân | Người chăm sóc |
| Tiền điều kiện | Đã đăng nhập; đã có hồ sơ bệnh nhân; người chăm sóc đã tra cứu được đơn thuốc trên hệ thống số hóa của bệnh viện |
| Luồng chính | 1. Người chăm sóc chọn "Thêm đơn thuốc", nhập ngày kê, ngày bắt đầu, ngày tái khám.<br>2. Với mỗi thuốc, người chăm sóc gõ tên; hệ thống gợi ý từ danh mục chuẩn sau hai ký tự.<br>3. Người chăm sóc chọn gợi ý, nhập số đơn vị mỗi lần và các buổi uống.<br>4. Hệ thống lưu đơn ở trạng thái Nháp.<br>5. Người chăm sóc xem lại toàn bộ đơn và chọn "Xác nhận".<br>6. Hệ thống chuyển đơn sang Hiệu lực, chuyển đơn cũ sang Bị thay thế, hủy các cữ tương lai của đơn cũ, và sinh lịch cữ thuốc tới ngày tái khám. |
| Luồng thay thế | 2a. Không có gợi ý phù hợp: người chăm sóc giữ tên tự do; dòng thuốc không liên kết danh mục.<br>5a. Thiếu trường bắt buộc: hệ thống từ chối xác nhận và chỉ rõ trường thiếu.<br>5b. Người chăm sóc hủy đơn nháp: đơn chuyển sang Đã hủy, không sinh cữ. |
| Ngoại lệ | E1. Mất kết nối khi đang nhập: dữ liệu đã nhập được giữ ở trạng thái Nháp, người chăm sóc tiếp tục sau.<br>E2. Đơn đã được xác nhận ở một phiên khác: hệ thống trả mã 409 và hiển thị trạng thái hiện tại của đơn.<br>E3. Danh mục thuốc không phản hồi: hệ thống cho nhập tên tự do và đánh dấu để liên kết danh mục sau. |
| Hậu điều kiện | Có đúng một đơn Hiệu lực; lịch cữ thuốc đã sinh; thao tác được ghi nhật ký |

## Đặc tả UC-07

*Nguồn: Bảng 13 trong báo cáo tuần 6.*

| Mục | UC-07: Xác nhận đã uống thuốc |
| --- | --- |
| Tác nhân | Bệnh nhân cao tuổi |
| Tiền điều kiện | Thiết bị đã ghép nối với hồ sơ ở vai trò Bệnh nhân; có cữ thuốc ở trạng thái Đang chờ |
| Luồng chính | 1. Đến giờ, thiết bị phát nhắc nhở bằng âm thanh và màn hình chữ lớn.<br>2. Bệnh nhân mở thông báo, màn hình hiển thị tên thuốc, số viên và một nút "Đã uống".<br>3. Bệnh nhân bấm nút.<br>4. Hệ thống ghi xác nhận, chuyển cữ sang Đã uống, hiển thị "Đã uống lúc hh:mm". |
| Luồng thay thế | 3a. Bệnh nhân bấm sau thời hạn: cữ chuyển sang Xác nhận muộn.<br>3b. Cữ đã được xác nhận trước đó: hệ thống hiển thị thời điểm đã uống, không ghi thêm.<br>3c. Không có kết nối mạng: ứng dụng lưu tạm và gửi lại khi có mạng, giữ nguyên thời điểm bấm. |
| Ngoại lệ | E1. Token thiết bị đã bị thu hồi: hệ thống trả mã 401; ứng dụng hướng dẫn liên hệ người chăm sóc để ghép nối lại.<br>E2. Cữ đã bị hủy do đơn bị thay thế: hệ thống trả mã 422; màn hình chuyển sang cữ kế tiếp. |
| Hậu điều kiện | Trạng thái cữ được cập nhật; người chăm sóc thấy kết quả trên trang tổng quan |

## Đặc tả UC-10

*Nguồn: Bảng 14 trong báo cáo tuần 6.*

| Mục | UC-10: Phát nhắc và phát hiện cữ bỏ lỡ |
| --- | --- |
| Tác nhân | Bộ lập lịch (tác nhân thời gian); người nhận: bệnh nhân, người chăm sóc, người nhà |
| Tiền điều kiện | Có đơn ở trạng thái Hiệu lực; cữ thuốc ở trạng thái Đã lên lịch; thiết bị bệnh nhân đã ghép nối |
| Luồng chính | 1. Đến mốc giờ, bộ lập lịch phát sự kiện "cữ đến giờ".<br>2. Hệ thống chuyển cữ sang Đang chờ và gửi nhắc nhở tới thiết bị bệnh nhân.<br>3. Hết thời hạn mà chưa có xác nhận: hệ thống chuyển cữ sang Bỏ lỡ.<br>4. Hệ thống gửi cảnh báo tới người chăm sóc và người nhà được ủy quyền.<br>5. Hệ thống ghi nhật ký và cập nhật số liệu tuân thủ. |
| Luồng thay thế | 3a. Có xác nhận trong thời hạn: kết thúc use case tại bước 2, chuyển sang UC-07 hoặc UC-08.<br>4a. Không có người nhà được ủy quyền: chỉ gửi cảnh báo tới người chăm sóc. |
| Ngoại lệ | E1. Worker khởi động lại giữa chừng: sự kiện chưa xử lý được xử lý lại, không gửi trùng cảnh báo (NFR-07). |
| Hậu điều kiện | Cữ ở một trong các trạng thái Đã uống, Đã uống (hộ), Bỏ lỡ; mọi cảnh báo đã gửi được ghi nhật ký |

## Các Epic

*Nguồn: Bảng 15 trong báo cáo tuần 6.*

| Epic | Tên | User story |
| --- | --- | --- |
| E1 | Quản lý đơn thuốc | US-01, US-02, US-07 |
| E2 | Nhắc và xác nhận | US-08, US-09, US-10, US-11 |
| E3 | Giám sát và cảnh báo | US-03, US-04, US-12, US-16 |
| E4 | Báo cáo và ghi vết | US-05, US-15, US-17 |
| E5 | Tài khoản và ủy quyền | US-06, US-13, US-14 |

## User Story

*Nguồn: Bảng 16 trong báo cáo tuần 6.*

| Mã | Là | Tôi muốn | Để | Ưu tiên | FR |
| --- | --- | --- | --- | --- | --- |
| US-01 | người con | nhập đơn thuốc có gợi ý tên từ danh mục | không gõ sai tên thuốc | M | FR-04, FR-05 |
| US-02 | người con | duyệt đơn trước khi đơn được áp dụng | lịch nhắc luôn khớp đơn mới nhất | M | FR-06, FR-07, FR-09 |
| US-03 | người con | nhận cảnh báo khi bố bỏ lỡ cữ thuốc | gọi nhắc bố kịp thời | M | FR-12 |
| US-04 | người con | xem tỷ lệ tuân thủ theo kỳ 7, 30, 90 ngày | không phải gọi hỏi hằng ngày | M | FR-19 |
| US-05 | người con | xuất báo cáo PDF 30 ngày | bác sĩ có lịch sử ghi nhận để tham khảo tại tái khám | S | FR-20 |
| US-06 | người con | ủy quyền cho người nhà sống cùng xác nhận hộ | có người hỗ trợ ngay tại nhà | S | FR-03 |
| US-07 | người con | được cảnh báo khi hai thuốc trong đơn trùng hoạt chất | kiểm tra lại đơn với bác sĩ khi có cảnh báo | C | FR-08 |
| US-08 | bệnh nhân | nghe nhắc to và thấy chữ lớn đúng giờ uống | không lỡ giờ uống thuốc | M | FR-10 |
| US-09 | bệnh nhân | bấm một nút "Đã uống" để xác nhận | xác nhận mà không cần đăng nhập hay nhập liệu | M | FR-11, FR-14, FR-15 |
| US-10 | bệnh nhân | thấy giờ mình đã uống cữ gần nhất | không uống trùng liều | M | FR-11 |
| US-11 | người nhà sống cùng | xác nhận hộ khi bệnh nhân quên bấm | bổ sung ghi nhận khi bệnh nhân đã uống nhưng quên bấm | S | FR-13, FR-15 |
| US-12 | người nhà sống cùng | nhận cảnh báo khi cữ thuốc bị bỏ lỡ | nhắc bệnh nhân ngay tại nhà | M | FR-12 |
| US-13 | người con | tạo hồ sơ bệnh nhân chỉ với tên gọi và năm sinh | không phải khai thông tin định danh thật | M | FR-01 |
| US-14 | người con | ghép điện thoại của bố bằng mã một lần | bố dùng được ứng dụng mà không cần đăng nhập | M | FR-02 |
| US-15 | người con | ghi chỉ số xét nghiệm sau mỗi đợt khám | theo dõi xu hướng đường huyết của bố | S | FR-16 |
| US-16 | người con | được nhắc trước ngày tái khám | kịp sắp xếp đưa bố đi khám | S | FR-17 |
| US-17 | người con | xem lại nhật ký ai đã làm gì trên hồ sơ | tin tưởng dữ liệu tuân thủ | M | FR-18 |

## Đối chiếu INVEST

*Nguồn: Bảng 17 trong báo cáo tuần 6.*

| Story | I | N | V | E | S | T | Hướng xử lý |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-02 | ✓ | ✓ | ✓ | ✓ | △ | ✓ | Gồm cả thay thế đơn cũ và sinh cữ; ứng viên tách thành 2 story nếu ước lượng vượt 5 điểm |
| US-05 | ✓ | ✓ | ✓ | ✓ | △ | ✓ | Ứng viên tách: tổng hợp số liệu 30 ngày và dựng tệp PDF |
| US-07 | ✗ | ✓ | ✓ | △ | ✓ | ✓ | Phụ thuộc module AI chuẩn hóa tên thuốc; cần spike ước lượng; để Sprint 3 |
| US-11 | △ | ✓ | ✓ | ✓ | ✓ | ✓ | Phụ thuộc US-06 (phải có ủy quyền trước) |
| US-12 | △ | ✓ | ✓ | ✓ | ✓ | ✓ | Phụ thuộc US-06 và US-03. Phải có ủy quyền trước khi thử cảnh báo người nhà; điều chỉnh thứ tự backlog Sprint 2. |

## Yêu cầu chức năng

*Nguồn: Bảng 18 trong báo cáo tuần 6.*

| Mã | Mô tả | Ưu tiên | Vấn đề |
| --- | --- | --- | --- |
| FR-01 | Hệ thống phải cho phép người chăm sóc tạo tài khoản và tạo hồ sơ bệnh nhân chỉ gồm tên gọi trong gia đình và năm sinh. | M | P4 |
| FR-02 | Hệ thống phải sinh mã ghép nối một lần để ghép thiết bị của bệnh nhân hoặc người nhà vào hồ sơ; sau khi ghép, thiết bị hoạt động không cần đăng nhập. | M | P7 |
| FR-03 | Hệ thống phải cho phép người chăm sóc ủy quyền và thu hồi quyền xác nhận hộ của người nhà. | S | P5 |
| FR-04 | Hệ thống phải cho phép nhập đơn thuốc gồm ngày kê, ngày bắt đầu, ngày tái khám và các dòng thuốc (tên thuốc, số đơn vị mỗi lần, buổi uống, ghi chú). | M | P1 |
| FR-05 | Hệ thống phải gợi ý tên thuốc từ danh mục chuẩn khi người dùng gõ từ hai ký tự, đồng thời cho phép giữ tên tự do. | M | P3 |
| FR-06 | Hệ thống chỉ sinh cữ thuốc từ đơn đã được người chăm sóc xác nhận; đơn chỉ sửa được khi còn ở trạng thái Nháp. | M | P1 |
| FR-07 | Khi đơn mới được xác nhận, hệ thống phải chuyển đơn cũ sang Bị thay thế và hủy các cữ tương lai của đơn cũ. | M | P2 |
| FR-08 | Hệ thống nên cảnh báo khi hai dòng thuốc trong cùng đơn có cùng hoạt chất, kèm khuyến nghị hỏi lại bác sĩ; hệ thống không tự sửa đơn. | C | P3 |
| FR-09 | Hệ thống phải tự sinh cữ thuốc hằng ngày từ đơn Hiệu lực tới ngày tái khám. | M | P1 |
| FR-10 | Hệ thống phải gửi nhắc nhở tới thiết bị bệnh nhân tại từng mốc giờ đã cấu hình. | M | P2 |
| FR-11 | Hệ thống phải cho phép bệnh nhân xác nhận đã uống bằng một thao tác và hiển thị lại thời điểm đã uống. | M | P2, P7 |
| FR-12 | Hệ thống phải chuyển cữ sang Bỏ lỡ khi quá ngưỡng cấu hình và cảnh báo người chăm sóc, người nhà có ủy quyền. Ngưỡng mặc định cần ý kiến chuyên môn; 120 phút chỉ dùng làm giả định kiểm thử. | M | P4 |
| FR-13 | Hệ thống phải ghi rõ mỗi xác nhận do bệnh nhân hay người được ủy quyền thực hiện và thể hiện trong báo cáo. | M | P6 |
| FR-14 | Hệ thống nên ghi nhận xác nhận sau thời hạn với trạng thái Xác nhận muộn. | S | P6 |
| FR-15 | Hệ thống không cho sửa hoặc xóa bản ghi xác nhận; đính chính bằng bản ghi mới tham chiếu bản ghi cũ. | M | P6 |
| FR-16 | Hệ thống nên cho phép nhập chỉ số xét nghiệm kèm loại, giá trị, đơn vị và ngày thực hiện. | S | P6 |
| FR-17 | Hệ thống nên nhắc lịch tái khám trước ngày hẹn một số ngày cấu hình được. | S | P1 |
| FR-18 | Hệ thống phải ghi nhật ký có cấu trúc [Timestamp, User UUID, Action Type, Status] cho mọi thao tác ghi dữ liệu. | M | P6 |
| FR-19 | Hệ thống phải hiển thị tổng quan tuân thủ theo kỳ 7, 30, 90 ngày. | M | P4 |
| FR-20 | Hệ thống nên xuất báo cáo PDF 30 ngày gồm tỷ lệ tuân thủ, người xác nhận và lịch sử chỉ số. | S | P6 |

## Yêu cầu phi chức năng

*Nguồn: Bảng 19 trong báo cáo tuần 6.*

| Mã | Đặc tính ISO/IEC 25010 | Yêu cầu định lượng | Cơ sở của chỉ số | Kiểm chứng |
| --- | --- | --- | --- | --- |
| NFR-01 | Khả dụng và khả năng tương tác | Chế độ bệnh nhân: tối đa 1 thao tác cho mỗi cữ; cỡ chữ tối thiểu 20sp; vùng chạm tối thiểu 48dp; không nhập văn bản | BIZ-04, khảo sát G4; 20sp và 48dp là mục tiêu giao diện cần thử trên thiết bị và với người dùng. | Kiểm thử chấp nhận với người dùng thật |
| NFR-02 | Hiệu năng: thời gian xử lý | Nhắc nhở được gửi trong vòng 60 giây kể từ mốc giờ | Mục tiêu độ trễ kỹ thuật của nhóm, cần đo trên thiết bị thật và xác nhận phù hợp nhu cầu người dùng. | Đo độ trễ tại Worker |
| NFR-03 | Hiệu năng: thời gian phản hồi, dung lượng | API đọc có p95 dưới 500 ms với 100 người dùng đồng thời; gợi ý tên thuốc dưới 300 ms | Ước lượng quy mô demo; gợi ý khi gõ cần phản hồi gần tức thời | Kiểm thử tải |
| NFR-04 | Bảo mật: tính bảo mật, xác thực | HTTPS toàn bộ; mật khẩu băm bằng bcrypt hoặc Argon2; access token sống 15 phút; token thiết bị thu hồi được | Thực hành phổ biến về xác thực web | Rà soát cấu hình, kiểm thử |
| NFR-05 | Bảo mật: quyền riêng tư | Không lưu họ tên thật, số định danh, số BHYT; dữ liệu kiểm thử dùng mã giả lập BN-TEST-xxx | Ràng buộc dữ liệu của đề tài; mã giả lập được dùng cho dữ liệu mẫu và kiểm thử. | Rà soát schema và dữ liệu mẫu |
| NFR-06 | Bảo mật: tính toàn vẹn, trách nhiệm giải trình | Bản ghi xác nhận và nhật ký chỉ thêm, không sửa, không xóa; nhật ký có cấu trúc [Timestamp, User_UUID, Action_Type, Status] | Nguyên tắc Audit Trail bất biến của học phần | Ràng buộc CSDL, unit test |
| NFR-07 | Độ tin cậy: khả năng chịu lỗi | Không mất sự kiện nhắc khi Worker khởi động lại; xử lý sự kiện có tính lũy đẳng | Nhắc nhở là chức năng lõi (BIZ-01) | Kiểm thử khởi động lại Worker |
| NFR-08 | Bảo trì: khả năng kiểm thử | Độ phủ unit test của Rule Engine tối thiểu 80%; CI kiểm tra lint, schema và tệp OpenAPI | Mục tiêu kiểm thử của nhóm theo bản đặc tả cập nhật. | Báo cáo coverage, CI |
| NFR-09 | Tương thích | Hỗ trợ Android; phiên bản tối thiểu cần chốt sau khi kiểm kê điện thoại bệnh nhân. | Khảo sát G4: bệnh nhân dùng điện thoại Android | Kiểm thử trên thiết bị thật |
| NFR-10 | Bảo mật: mã hóa dữ liệu nhạy cảm | Token thiết bị và push token được mã hóa AES-256 khi lưu | Mục tiêu bảo vệ token theo bản đặc tả cập nhật; cần chốt quản lý khóa và cách lưu trên thiết bị. | Rà soát schema, kiểm thử |
| NFR-11 | Hiệu năng: độ trễ Rule Engine | Rule Engine đánh giá một sự kiện cữ thuốc dưới 100 ms trên server | Ngưỡng kỹ thuật của bản đặc tả cập nhật, cần chốt môi trường benchmark. | Benchmark trong CI |

## RTM yêu cầu chức năng

*Nguồn: Bảng 20 trong báo cáo tuần 6.*

| FR | BIZ | User story | Use case | Module | Kịch bản |
| --- | --- | --- | --- | --- | --- |
| FR-01 | BIZ-02 | US-13 | UC-01, UC-02 | Backend: Auth, Hồ sơ | TC-30, 31 |
| FR-02 | BIZ-04 | US-14 | UC-03 | Backend: Thiết bị | TC-32, 33 |
| FR-03 | BIZ-01 | US-06 | UC-04 | Backend: Thiết bị | TC-13, 14, 15 |
| FR-04 | BIZ-01 | US-01 | UC-05 | Backend: Đơn thuốc | TC-01, 02 |
| FR-05 | BIZ-01 | US-01 | UC-05 | Backend: Đơn thuốc; Cache | TC-01, 03 |
| FR-06 | BIZ-01 | US-02 | UC-06 | Backend: Đơn thuốc | TC-05, 06 |
| FR-07 | BIZ-01 | US-02 | UC-06 | Backend: Đơn thuốc; Worker | TC-04 |
| FR-08 | BIZ-01 | US-07 | UC-06 | Rule Engine; AI service | TC-16, 17 |
| FR-09 | BIZ-01 | US-02 | UC-10 | Worker: Scheduler | TC-04 |
| FR-10 | BIZ-01 | US-08 | UC-10 | Worker: Notifier; Mobile App | TC-18, 19 |
| FR-11 | BIZ-04 | US-09, US-10 | UC-07 | Backend: Tuân thủ; Mobile App | TC-20, 23, 24 |
| FR-12 | BIZ-02 | US-03, US-12 | UC-10 | Worker; Rule Engine | TC-07, 08, 28, 29 |
| FR-13 | BIZ-03 | US-10, US-11 | UC-07, UC-08 | Backend: Tuân thủ | TC-25, 26 |
| FR-14 | BIZ-03 | US-09 | UC-07 | Rule Engine | TC-22 |
| FR-15 | BIZ-03 | US-09, US-11 | UC-07, UC-08 | Backend: Tuân thủ | TC-21, TC-27 (bấm lặp);  |
| FR-16 | BIZ-03 | US-15 | UC-11 | Backend: Chỉ số | TC-34, 35 |
| FR-17 | BIZ-02 | US-16 | UC-12 | Worker: Scheduler | TC-36, 37 |
| FR-18 | BIZ-03 | US-17 | Mọi UC ghi dữ liệu | Backend: Audit | TC-38, 39 |
| FR-19 | BIZ-02 | US-04 | UC-09 | Backend: Tuân thủ; Cache | TC-09, 10 |
| FR-20 | BIZ-03 | US-05 | UC-13 | Worker: PDF; Cloud Storage | TC-11, 12 |

## Ánh xạ FR tới API và dữ liệu

*Nguồn: Bảng 21 trong báo cáo tuần 6.*

| FR | API hoặc sự kiện | Bảng dữ liệu |
| --- | --- | --- |
| FR-01 | POST /auth/register<br>POST /patients | caregivers, patients |
| FR-02 | POST /patients/{patientId}/pairing-codes<br>POST /devices/pair | devices, pairing_codes |
| FR-03 | POST, DELETE /patients/{patientId}/delegates | delegates |
| FR-04 | POST /patients/{patientId}/prescriptions | prescriptions, prescription_items |
| FR-05 | GET /drugs | drugs |
| FR-06 | PUT /prescriptions/{prescriptionId}<br>POST /prescriptions/{prescriptionId}/confirm | prescriptions |
| FR-07 | POST /prescriptions/{prescriptionId}/confirm | prescriptions, doses |
| FR-08 | GET /prescriptions/{prescriptionId} | drug_ingredients |
| FR-09 | Sự kiện nội bộ | doses |
| FR-10 | GET /device/doses/today | doses, devices |
| FR-11 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-12 | GET /patients/{patientId}/alerts | doses, alerts |
| FR-13 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-14 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-15 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-16 | POST /patients/{patientId}/lab-results | lab_results |
| FR-17 | POST /patients/{patientId}/appointments | appointments |
| FR-18 | GET /patients/{patientId}/audit-logs | audit_logs |
| FR-19 | GET /patients/{patientId}/adherence/summary | doses |
| FR-20 | POST /patients/{patientId}/reports<br>GET /reports/{reportId} | reports |

## RTM yêu cầu phi chức năng

*Nguồn: Bảng 22 trong báo cáo tuần 6.*

| NFR | User story | Use case | Module thiết kế | Ca kiểm thử |
| --- | --- | --- | --- | --- |
| NFR-01 | US-08, US-09 | UC-07 | Mobile App | TC-18, 20 |
| NFR-02 | US-08 | UC-10 | Worker: Notifier | TC-07, 18 |
| NFR-05 | US-13 | UC-02 | Schema CSDL | TC-30 |
| NFR-06 | US-09, US-17 | Mọi UC ghi dữ liệu | Backend: Audit; CSDL | TC-21, 39 |
| NFR-11 | US-03 | UC-10 | Rule Engine | Benchmark CI |
| NFR-03 | US-01, US-04 | UC-05, UC-09 | Backend, Cache | Kiểm thử tải theo p95 và độ trễ gợi ý |
| NFR-04 | US-13, US-14 | UC-01, UC-03 | Gateway, Auth, Thiết bị | Rà soát HTTPS, mật khẩu băm, hạn và thu hồi token |
| NFR-07 | US-03, US-08 | UC-10 | Worker, RabbitMQ | Khởi động lại Worker và kiểm tra xử lý lũy đẳng |
| NFR-08 | Mọi story có Rule Engine | UC-06, UC-10 | Rule Engine, CI | Báo cáo coverage và pipeline |
| NFR-09 | US-08, US-09 | UC-07 | Mobile App | Thử trên phiên bản Android nhóm chọn |
| NFR-10 | US-14 | UC-03 | Backend, lưu trữ token | Kiểm tra mã hóa và quản lý khóa |

## Các hệ thống bên ngoài

*Nguồn: Bảng 24 trong báo cáo tuần 6.*

| Hệ thống ngoài | Vai trò | Ghi chú |
| --- | --- | --- |
| Dịch vụ thông báo đẩy | Chuyển nhắc nhở và cảnh báo tới thiết bị | Bắt buộc; FCM cho Android, APNs cho iOS |
| Dịch vụ Email | Xác thực tài khoản, gửi báo cáo | Chỉ phục vụ người chăm sóc |
| Cloud Storage | Lưu tệp báo cáo PDF | Có thể thay bằng lưu trữ nội bộ ở môi trường demo |
| Danh mục thuốc công khai | Nguồn dữ liệu chuẩn cho gợi ý và chuẩn hóa tên thuốc | Nạp định kỳ từ tệp, không gọi trực tuyến |
| Hệ thống số hóa BV Hữu Nghị | Nơi người chăm sóc tra cứu đơn thuốc | Không tích hợp; nằm ngoài ranh giới hệ thống |

## Các container

*Nguồn: Bảng 25 trong báo cáo tuần 6.*

| Container | Công nghệ | Trách nhiệm | Giao tiếp |
| --- | --- | --- | --- |
| Web App | SPA; framework cần chốt | Trang tổng quan, nhập đơn, báo cáo cho người chăm sóc | HTTPS/REST, WSS |
| Mobile App | Framework cần chốt | Chế độ bệnh nhân và chế độ người nhà | HTTPS/REST; nhận push |
| API Gateway | Reverse proxy | Định tuyến /api/v1, kiểm tra token, giới hạn tần suất, TLS | HTTPS vào, HTTP ra |
| Backend API | Modular monolith; | Nghiệp vụ hồ sơ, đơn thuốc, tuân thủ, chỉ số, báo cáo; Rule Engine; ghi nhật ký | SQL, RESP, AMQP, gRPC |
| Background Worker | Consumer và scheduler | Sinh cữ thuốc, phát nhắc, chuyển trạng thái quá hạn, dựng PDF | AMQP, SQL, HTTPS |
| AI Normalization Service | Dự kiến Sprint 3 | Chuẩn hóa tên biệt dược về hoạt chất và hàm lượng | gRPC |
| Relational Database | PostgreSQL | Lưu toàn bộ dữ liệu nghiệp vụ và nhật ký | SQL/TCP |
| Cache | Redis | Phiên, gợi ý danh mục thuốc, số liệu tổng hợp | RESP |
| Message Broker | RabbitMQ | Hàng đợi sự kiện giữa Backend API và Worker | AMQP |

## Các quyết định kiến trúc

*Nguồn: Bảng 26 trong báo cáo tuần 6.*

| Quyết định | Phương án chọn | Lý do | Đánh đổi |
| --- | --- | --- | --- |
| Kiểu kiến trúc backend | Modular monolith | Nhóm 3 người; một đơn vị triển khai giảm chi phí vận hành | Khó mở rộng độc lập từng module |
| Tác vụ theo thời gian | Worker riêng qua RabbitMQ | Nhắc và quá hạn không phụ thuộc request; hàng đợi bền vững và xử lý lũy đẳng hỗ trợ phục hồi, cần kiểm thử khởi động lại. | Thêm một thành phần cần vận hành |
| Xác thực phía bệnh nhân | Ghép nối thiết bị bằng mã một lần | Đáp ứng ràng buộc không đăng nhập (FR-02, NFR-01) | Mất thiết bị phải ghép nối lại |
| Module AI | Service tách riêng, gọi qua gRPC | Thay đổi mô hình không ảnh hưởng Backend; phát triển song song | Cần xử lý khi service không phản hồi |
| Nguồn dữ liệu đơn thuốc | Nhập tay có gợi ý, không tích hợp bệnh viện | Không có quyền truy cập hệ thống bệnh viện; giữ ranh giới rõ ràng | Người chăm sóc tốn công nhập |

## Danh sách endpoint

*Nguồn: Bảng 27 trong báo cáo tuần 6.*

| Nhóm | Phương thức | Đường dẫn | Mô tả | Xác thực | UC |
| --- | --- | --- | --- | --- | --- |
| Auth | POST | /auth/register | Đăng ký người chăm sóc | Không | UC-01 |
| Auth | POST | /auth/login | Đăng nhập | Không | UC-01 |
| Auth | POST | /auth/refresh | Làm mới token | Không | UC-01 |
| Patients | GET, POST | /patients | Danh sách, tạo hồ sơ | NCS | UC-02 |
| Patients | GET, PATCH | /patients/{patientId} | Xem, cập nhật hồ sơ | NCS | UC-02 |
| Devices | POST | /patients/{patientId}/pairing-codes | Sinh mã ghép nối | NCS | UC-03 |
| Devices | POST | /devices/pair | Đổi mã lấy token thiết bị | Không | UC-03 |
| Delegates | GET, POST | /patients/{patientId}/delegates | Danh sách, ủy quyền | NCS | UC-04 |
| Delegates | DELETE | /patients/{patientId}/delegates/{delegateId} | Thu hồi ủy quyền | NCS | UC-04 |
| Drugs | GET | /drugs?q= | Gợi ý tên thuốc | NCS | UC-05 |
| Đơn thuốc | GET, POST | /patients/{patientId}/prescriptions | Danh sách, tạo đơn nháp | NCS | UC-05 |
| Đơn thuốc | GET, PUT | /prescriptions/{prescriptionId} | Xem, sửa đơn nháp | NCS | UC-05 |
| Đơn thuốc | POST | /prescriptions/{prescriptionId}/confirm | Xác nhận đơn, sinh cữ | NCS | UC-06 |
| Đơn thuốc | POST | /prescriptions/{prescriptionId}/cancel | Hủy đơn nháp | NCS | UC-06 |
| Doses | GET | /patients/{patientId}/doses | Tra cứu cữ thuốc | NCS | UC-09 |
| Doses | GET | /device/doses/today | Cữ hôm nay trên thiết bị | Device | UC-07 |
| Doses | POST | /doses/{doseId}/confirmations | Xác nhận đã uống, xác nhận hộ | Device | UC-07, UC-08 |
| Adherence | GET | /patients/{patientId}/adherence/summary | Tổng hợp tuân thủ | NCS | UC-09 |
| Adherence | GET | /patients/{patientId}/alerts | Danh sách cảnh báo | NCS | UC-10 |
| Clinical | GET, POST | /patients/{patientId}/lab-results | Chỉ số xét nghiệm | NCS | UC-11 |
| Clinical | GET, POST | /patients/{patientId}/appointments | Lịch tái khám | NCS | UC-12 |
| Reports | POST | /patients/{patientId}/reports | Yêu cầu dựng PDF | NCS | UC-13 |
| Reports | GET | /reports/{reportId} | Trạng thái, tải báo cáo | NCS | UC-13 |
| Audit | GET | /patients/{patientId}/audit-logs | Tra cứu nhật ký | NCS | UC-09 |

## Tệp thiết kế gốc

- [Ảnh và nguồn sơ đồ của nhóm](architecture/README.md).
- [OpenAPI gốc](api/openapi.yaml), sao chép nguyên tệp từ `KTPMUD/docs/api/openapi.yaml`.
- [RTM trích từ báo cáo](RTM.md).

Các mã TC trong bảng RTM là mã tham chiếu của báo cáo. Bản chuyển định dạng này không tạo thêm kịch bản Given/When/Then, kết quả kiểm thử hoặc bằng chứng nghiệm thu.
