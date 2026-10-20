# SRS v1.0 — An Tâm

Ngày đóng gói: 20/10/2026 · Trạng thái: đặc tả mục tiêu và đối chiếu bản local; chờ nhóm review.

## 1. Giới thiệu

### 1.1 Mục đích
Đặc tả hệ thống hỗ trợ người chăm sóc theo dõi điều trị ngoại trú cho bệnh nhân đái tháo đường type 2. Tài liệu dùng làm cơ sở thiết kế, triển khai và kiểm thử; không phải xác nhận mọi yêu cầu đã đạt.

### 1.2 Phạm vi
Người chăm sóc nhập và xác nhận đơn, quản lý hồ sơ, ghép thiết bị, theo dõi ghi nhận, chỉ số và lịch tái khám. Bệnh nhân tự xác nhận; người nhà được ủy quyền xác nhận hộ. Hệ thống nhắc và cảnh báo, xuất lịch sử 30 ngày. Không OCR, không tích hợp dữ liệu bệnh viện, không tự sửa đơn hoặc đưa ra quyết định điều trị. AI chỉ là hướng nghiên cứu dự kiến; bản local chưa dùng AI.

### 1.3 Thuật ngữ
BIZ: mục tiêu nghiệp vụ; US: câu chuyện người dùng; UC: ca sử dụng; FR: yêu cầu chức năng; NFR: yêu cầu chất lượng; BR: ràng buộc nghiệp vụ; RTM: ma trận truy vết; NCS: người chăm sóc. M/S/C là Must/Should/Could.

### 1.4 Nguồn
[SOURCES.md](SOURCES.md) ghi tên báo cáo, dấu kiểm tra tệp và nguồn bổ sung. [README](../README.md) mô tả bản chạy thực tế.

## 2. Mô tả tổng quan

Bản local: React + Express + SQLite, cookie phiên, lịch nền cùng tiến trình; chỉ chạy loopback. Thiết kế mục tiêu: web/mobile, Gateway, backend, PostgreSQL, hàng đợi và worker. Không đồng nhất hai trạng thái này. [Gap Matrix](GAP_MATRIX.md) mô tả các phần chưa đạt.

### 2.1 Các bên liên quan
| Nhóm | Đối tượng | Vai trò với hệ thống | Nỗi đau chính |
| --- | --- | --- | --- |
| Customer | Người con (người chăm sóc chính) | Quyết định sử dụng, thiết lập và quản trị hồ sơ | Không biết bố mẹ đã uống thuốc chưa; phải gọi hỏi lặp lại |
| End-user trực tiếp | Người con | Nhập đơn, giám sát, nhận cảnh báo, xuất báo cáo | Mất thời gian, thông tin thiếu chính xác |
| End-user trực tiếp | Bệnh nhân cao tuổi | Nhận nhắc, xác nhận một chạm | Hay quên liều, ngại công nghệ, sợ làm phiền con |
| End-user trực tiếp | Người nhà sống cùng | Xác nhận hộ, nhận cảnh báo tại chỗ | Nhắc trùng với người khác, không rõ trách nhiệm |
| Hưởng lợi gián tiếp | Bác sĩ điều trị | Đọc báo cáo do người chăm sóc mang tới | Thiếu số liệu tuân thủ khách quan |

### 2.2 Vai trò
| Người dùng thật | Vai trò trong hệ thống | Use case |
| --- | --- | --- |
| Người con (người chăm sóc chính) | Quản trị hồ sơ; nhập và xác nhận đơn thuốc; giám sát; nhận cảnh báo; xuất báo cáo | UC-01 đến UC-06, UC-09, UC-11, UC-13 |
| Bệnh nhân cao tuổi | Nhận nhắc nhở; xác nhận đã uống | UC-07 |
| Người nhà sống cùng | Xác nhận hộ; nhận cảnh báo tại chỗ | UC-08 |
| Bác sĩ điều trị | Đọc báo cáo do người chăm sóc mang tới; nằm ngoài hệ thống | Không có |
| Bộ lập lịch (tác nhân thời gian) | Kích hoạt nhắc nhở, chuyển trạng thái quá hạn, nhắc tái khám | UC-10, UC-12 |

### 2.3 Mục tiêu nghiệp vụ
| Mã | Mục tiêu nghiệp vụ đo được |
| --- | --- |
| BIZ-01 | Hỗ trợ cải thiện việc ghi nhận và theo dõi cữ thuốc trong chu kỳ 30 ngày. Chỉ tiêu mục tiêu X% và cách tính cần chốt; dữ liệu tự xác nhận không tự chứng minh bệnh nhân đã uống thuốc hoặc hiệu quả điều trị. |
| BIZ-02 | Rút ngắn thời gian người chăm sóc cần để nắm tình hình điều trị, từ gọi điện hỏi nhiều lần mỗi tuần xuống một lần mở ứng dụng. |
| BIZ-03 | Cung cấp lịch sử ghi nhận 30 ngày, phân biệt bệnh nhân tự xác nhận, xác nhận hộ và xác nhận muộn để bác sĩ tham khảo tại tái khám. |
| BIZ-04 | Giảm rào cản công nghệ cho bệnh nhân cao tuổi: không đăng nhập, không nhập liệu, tối đa một thao tác cho mỗi cữ thuốc. |

### 2.4 Ràng buộc nghiệp vụ
- BR-01. Mỗi người chăm sóc quản lý một hoặc nhiều bệnh nhân; ở phiên bản 1, mỗi bệnh nhân có đúng một người chăm sóc chính.
- BR-02. Tại mỗi thời điểm, một bệnh nhân có tối đa một đơn thuốc ở trạng thái Hiệu lực.
- BR-03. Chỉ đơn ở trạng thái Hiệu lực mới sinh cữ thuốc; khi đơn mới được xác nhận, đơn cũ chuyển sang Bị thay thế và các cữ tương lai của đơn cũ chuyển sang Đã hủy.
- BR-04. Dòng thuốc được phép không liên kết với danh mục (tên tự do), nhưng luôn phải lưu tên gốc như trên đơn.
- BR-05. Bản ghi xác nhận chỉ được thêm, không được sửa hoặc xóa; bấm nhầm được đính chính bằng một bản ghi mới tham chiếu tới bản ghi cũ.
- BR-06. Mỗi xác nhận ghi rõ vai trò và định danh người thực hiện.
- BR-07. Hệ thống không lưu định danh thật: bệnh nhân chỉ có tên gọi trong gia đình và năm sinh.

### 2.5 Giả định và giới hạn
Ngưỡng 120 phút là dữ liệu thử; mục tiêu X% chưa được chốt. Khảo sát nhỏ mang tính định hướng, chưa có ý kiến bác sĩ/dược sĩ. Không suy diễn tự xác nhận thành bằng chứng đã uống thuốc. Token, push, Android, hiệu năng và độ phủ cần kết quả đo. Lịch Sprint cần nhóm thống nhất với giảng viên.

## 3. Yêu cầu cụ thể
### 3.1 User story
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

### 3.2 Use case
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

Chi tiết tiền/hậu điều kiện, luồng chính và ngoại lệ: [USE_CASES.md](USE_CASES.md).

### 3.3 Yêu cầu chức năng
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

### 3.4 Yêu cầu phi chức năng
Các giá trị dưới đây là mục tiêu, không phải số liệu đã đạt.

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

### 3.5 Mô hình dữ liệu
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

DDL PostgreSQL chuẩn hóa: [schema.sql](../database/schema.sql); [từ điển dữ liệu](../database/DATA_DICTIONARY.md). Đây là thiết kế mục tiêu độc lập, chưa thay thế SQLite dạng JSON của ứng dụng local.

### 3.6 Giao diện bên ngoài
Giao diện người chăm sóc: đăng nhập, chọn hồ sơ, nhập đơn, theo dõi, báo cáo. Giao diện bệnh nhân/người nhà: ghép mã, nhận nhắc, xác nhận. [UI flow](architecture/ui-flow.svg).

[OpenAPI mục tiêu](api/openapi.yaml) là hợp đồng chính; mock tại cổng 5188 chỉ trả dữ liệu giả lập, không thực thi nghiệp vụ. Các API đang chạy local ở cổng 5173 được mô tả trong [đối chiếu API](api/README.md).

### 3.7 Tiêu chí nghiệm thu
Mỗi US có kịch bản chuẩn và ngoại lệ trong [tests/features](../tests/features). Đây là đặc tả Gherkin, chưa gắn step definitions để chạy BDD tự động. Kiểm thử mã local được chạy riêng. [RTM](RTM.md) liên kết mục tiêu, yêu cầu, UC, module, dữ liệu và ca kiểm thử.

## 4. Kiến trúc và thiết kế
[Sơ đồ nguồn và ảnh](architecture/README.md): C4 C1/C2, DFD, use case theo vai trò, activity, class, 3 sequence và ERD.

## 5. Kiểm chứng và bàn giao
[Test Plan](TEST_PLAN.md), [Test Report](TEST_REPORT.md), [hướng dẫn triển khai](DEPLOYMENT.md), [hướng dẫn sử dụng](USER_MANUAL.md), [kế hoạch](PROJECT_PLAN.md), [danh mục bàn giao](HANDOFF.md).

Không công nhận NFR đã đạt từ việc có tài liệu hoặc mock. Người review chéo, tỷ lệ đóng góp và nghiệm thu cuối kỳ do nhóm thực hiện và ghi nhận sau.
