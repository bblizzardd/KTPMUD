# AN TÂM — HƯỚNG DẪN SỬ DỤNG VÀ TỔNG HỢP TÍNH NĂNG

Phiên bản tài liệu: 1.0 · Ngày cập nhật: 18/11/2026.

Tài liệu mô tả các chức năng hiện có trong dự án An Tâm, chia thành hai phần: **người con (người chăm sóc)** và **bệnh nhân**.

## Trước khi bắt đầu

An Tâm hỗ trợ gia đình theo dõi việc uống thuốc, quản lý đơn thuốc, ghi chỉ số xét nghiệm và chuẩn bị thông tin cho lần tái khám của người bệnh.

- **Người con:** chọn vai trò **Tôi là Người Chăm Sóc** khi đăng nhập; quản lý các hồ sơ người thân thuộc tài khoản của mình.
- **Bệnh nhân:** chọn **Tôi là Bệnh Nhân**; xem lịch và xác nhận việc uống thuốc của chính mình.
- **Người nhà được ủy quyền:** người được người con thêm vào một hồ sơ và ghép thiết bị để nhận cảnh báo, xác nhận hộ. Đây là quyền riêng, không đồng nghĩa với tài khoản người chăm sóc.

Hai lựa chọn **Giao diện web** và **Giao diện app** dùng chung tài khoản và dữ liệu. Giao diện app hiện chạy trong trình duyệt, chưa phải ứng dụng Android/iOS cài từ cửa hàng. Chuông nhắc phụ thuộc vào trang đang hoạt động và khả năng phát âm thanh của trình duyệt; không nên hiểu là thông báo nền khi đã đóng ứng dụng.

Để mở bản chạy thử trên Windows, máy cần Node.js 22 trở lên; nhấp đúp `AnTam.cmd` tại thư mục gốc dự án, chờ khởi động rồi mở địa chỉ `http://127.0.0.1:8080` trên chính máy đó. Nếu hệ thống đã được triển khai, dùng đường dẫn do người quản lý cung cấp. Cách cài đặt chi tiết xem [README của dự án](../README.md).

### Mục lục

- [Phần I — Dành cho người con](#phan-nguoi-con)
- [Phần II — Dành cho bệnh nhân](#phan-benh-nhan)
- [Tra cứu trạng thái và lỗi thường gặp](#tra-cuu)

<a id="phan-nguoi-con"></a>

## PHẦN I — DÀNH CHO NGƯỜI CON (NGƯỜI CHĂM SÓC)

### 1. Tổng hợp tính năng

| Nhóm tính năng | Người con có thể làm gì? | Nơi thao tác |
|---|---|---|
| Tài khoản | Đăng ký, đăng nhập, đăng xuất; chuyển giao diện web/app | Màn hình đăng nhập, thanh trên cùng |
| Hồ sơ người thân | Tạo nhiều hồ sơ, chuyển hồ sơ đang theo dõi, sửa tên gọi, năm sinh và giờ nhắc theo buổi | Bộ chọn hồ sơ; Hồ sơ & thiết bị |
| Liên kết bệnh nhân | Tạo mã để bệnh nhân đăng ký tài khoản gắn với đúng hồ sơ hoặc ghép thiết bị | Hồ sơ & thiết bị |
| Quản lý thiết bị | Xem thiết bị đã ghép, thu hồi thiết bị khi đổi hoặc mất máy | Hồ sơ & thiết bị |
| Ủy quyền người nhà | Thêm người nhà, ghép thiết bị cho họ, thu hồi quyền xác nhận hộ | Hồ sơ & thiết bị |
| Đơn thuốc | Nhập tên thuốc, số viên mỗi lần, buổi và giờ uống. Có thể sửa, hủy hoặc xác nhận đơn nháp. | Đơn thuốc |
| Kiểm tra trùng hoạt chất | Xem cảnh báo khi các thuốc trong đơn trùng hoạt chất | Màn hình nhập và chi tiết đơn |
| Theo dõi hằng ngày | Xem lịch hôm nay, lần uống gần nhất, tỷ lệ tuân thủ và diễn biến theo ngày | Tổng quan |
| Lịch sử cữ thuốc | Lọc theo ngày hoặc trạng thái, xem giờ uống và người xác nhận | Lịch cữ thuốc |
| Xác nhận hộ | Ghi nhận người bệnh vừa uống từng thuốc trong cữ | Chi tiết cữ trong Lịch cữ thuốc |
| Đính chính | Sửa giờ uống của một xác nhận đã có bằng bản ghi đính chính, giữ bản gốc | Chi tiết cữ trong Lịch cữ thuốc |
| Cảnh báo | Xem cữ chưa có xác nhận sau 30 phút, cữ bỏ lỡ, lịch tái khám và cảnh báo trùng hoạt chất | Biểu tượng chuông |
| Chỉ số xét nghiệm | Ghi HbA1c, đường huyết lúc đói, đường huyết sau ăn và chỉ số khác; xem xu hướng | Chỉ số & tái khám |
| Lịch tái khám | Thêm ngày hẹn, thời điểm nhắc trước, ghi chú; đánh dấu đã khám | Chỉ số & tái khám |
| Báo cáo | Tạo, xem và tải báo cáo PDF kỳ 30, 60 hoặc 90 ngày | Báo cáo |
| Nhật ký | Tra cứu người thực hiện, thao tác, thời gian và kết quả | Nhật ký thao tác |

### 2. Đăng ký và đăng nhập

1. Mở An Tâm, chọn **Tôi là Người Chăm Sóc**.
2. Nếu chưa có tài khoản, chọn **Đăng ký**.
3. Nhập tên hiển thị, email, mật khẩu ít nhất 8 ký tự và nhập lại mật khẩu.
4. Bấm **Tạo tài khoản**. Sau khi tạo thành công, hệ thống đưa bạn vào giao diện quản lý.
5. Những lần sau, chọn đúng vai trò, nhập email và mật khẩu rồi bấm **Đăng nhập**.

### 3. Thiết lập hồ sơ lần đầu

Thực hiện theo thứ tự: **tạo hồ sơ → liên kết bệnh nhân → nhập và xác nhận đơn thuốc → kiểm tra lịch trên giao diện bệnh nhân**.

1. Tạo hồ sơ người thân từ màn hình chưa có hồ sơ hoặc bộ chọn hồ sơ.
2. Nhập **Tên gọi trong gia đình**, chẳng hạn “Bố”, “Mẹ”, và **Năm sinh**.
3. Chọn giờ nhắc trong khung của từng buổi. Sáng từ **00:00–09:59**, trưa từ **10:00–14:59**, chiều từ **15:00–17:59** và tối từ **18:00–23:59**. Giờ riêng của từng thuốc trong đơn cũng dùng các khung này.
4. Lưu hồ sơ và kiểm tra tên người thân đang được chọn.
5. Khi quản lý nhiều người, chọn đúng hồ sơ trước khi nhập đơn, ghi chỉ số hoặc tạo báo cáo.

Để cập nhật sau khi tạo, bấm **Sửa hồ sơ** ngay cạnh tên hồ sơ đang chọn ở thanh trên, hoặc vào **Hồ sơ & thiết bị → Sửa hồ sơ & giờ nhắc**. Bạn có thể sửa tên gọi, năm sinh (1920–2010) và giờ nhắc rồi bấm **Lưu thay đổi**. Giờ nhắc mới áp dụng cho đơn được xác nhận sau khi thay đổi; không tự đổi lịch đã sinh từ đơn cũ. Khi nhập đơn, bạn vẫn có thể chọn giờ riêng cho từng thuốc và từng buổi.

### 4. Liên kết tài khoản hoặc thiết bị của bệnh nhân

**Cách dùng tài khoản email/mật khẩu:**

1. Chọn đúng hồ sơ, vào **Hồ sơ & thiết bị → Liên kết tài khoản & thiết bị**.
2. Tại **Tạo mã cho**, chọn bệnh nhân.
3. Bấm **Tạo mã 6 số** và đưa mã cho bệnh nhân.
4. Bệnh nhân chọn **Tôi là Bệnh Nhân → Đăng ký**, nhập mã cùng các thông tin tài khoản.
5. Sau khi liên kết thành công, những lần sau bệnh nhân chỉ cần email và mật khẩu.

**Cách ghép thiết bị bổ sung:**

1. Tạo mã cho bệnh nhân như trên.
2. Trên giao diện cần ghép, chọn **Ghép thiết bị bằng mã 6 số**.
3. Nhập mã, bấm **GHÉP NỐI**, sau đó bấm **BẮT ĐẦU**.
4. Kiểm tra thiết bị xuất hiện trong danh sách **Thiết bị đã ghép nối**.

Mỗi mã chỉ dùng một lần, hết hạn sau **5 phút**. Mã đã dùng để đăng ký tài khoản không dùng lại để ghép thiết bị; hãy tạo mã mới khi cần. Bản chạy thử có nút **Nhập mã trên điện thoại mô phỏng** để thực hành luồng ghép.

Sau mỗi lần đăng nhập, vào mục liên kết để **Tạo mã 6 số** khi cần. Trong lúc mã còn hiệu lực, bạn vẫn có thể bấm **Tạo lại mã**; mã mới thay thế mã cũ chưa dùng của cùng bệnh nhân hoặc cùng người nhà. Mã cũ không dùng để ghép hay đăng ký được nữa. Những thiết bị đã ghép vẫn hoạt động. Nếu mã hết hạn hoặc đã dùng, chọn **Tạo lại mã** để tiếp tục. Hệ thống không tự tạo mã khi đăng nhập.

### 5. Nhập và xác nhận đơn thuốc

1. Vào **Đơn thuốc**, chọn thêm đơn mới.
2. Nhập ngày kê đơn, ngày bắt đầu uống, ngày tái khám và nguồn tra cứu nếu có.
3. Với mỗi thuốc, nhập tên thuốc hoặc gõ từ 2 ký tự để chọn trong danh mục.
4. Nhập số viên mỗi lần uống theo đơn. Ô này cho phép nhập từ 0,5 viên và tăng theo từng nửa viên (0,5 → 1 → 1,5 → 2 → 2,5…). Chọn buổi và giờ uống, rồi thêm ghi chú cách dùng nếu cần.
5. Bấm **Thêm thuốc** nếu đơn có nhiều thuốc, sau đó lưu đơn nháp.
6. Mở chi tiết đơn, đối chiếu lại với đơn gốc và xem mục **Kiểm tra trước khi xác nhận**.
7. Nếu có cảnh báo trùng hoạt chất, chỉ đánh dấu đã kiểm tra với bác sĩ/dược sĩ sau khi thực sự kiểm tra.
8. Bấm **Xác nhận đơn**. Nếu thay đơn đang dùng, đọc tác động rồi xác nhận việc thay đơn.
9. Mở **Lịch cữ thuốc** để kiểm tra lịch đã được sinh, đồng thời kiểm tra trên giao diện bệnh nhân.

**Các điểm cần nhớ:**

- Đơn **Nháp** chưa sinh lịch nhắc; còn có thể sửa hoặc hủy.
- Mỗi bệnh nhân có tối đa một đơn **Hiệu lực**. Đơn đã xác nhận không sửa trực tiếp; khi thay đổi đơn điều trị, nhập và xác nhận đơn mới theo đơn được kê.
- Xác nhận đơn mới làm đơn đang dùng chuyển sang **Bị thay thế** và hủy các cữ tương lai của đơn cũ. Lịch sử vẫn được giữ.
- Lịch nhắc của đơn được sinh đến hết ngày tái khám; đơn chuyển sang **Hết hạn** sau ngày này.
- Cảnh báo trùng hoạt chất không phải chức năng kiểm tra toàn bộ tương tác thuốc.

#### Xóa đơn thuốc

1. Vào **Đơn thuốc**, chọn **Xóa đơn** trên đơn cần xóa; cũng có thể mở chi tiết đơn rồi chọn **Xóa đơn**.
2. Kiểm tra ngày kê đơn và nội dung hộp xác nhận.
3. Bấm **Xóa đơn thuốc** để hoàn tất hoặc **Giữ lại** để hủy thao tác.

Có thể xóa đơn nháp, đang hiệu lực hoặc đơn trong lịch sử. Đơn đã xóa không còn trong danh sách và không thể khôi phục trên giao diện. Các cữ chưa đến giờ và đang chờ sẽ bị hủy; thiết bị không tiếp tục nhắc hoặc nhận xác nhận mới cho đơn đó. Lịch sử đã uống, cữ đã bỏ lỡ, các bản ghi đính chính và nhật ký vẫn được giữ. Lịch tái khám đã tạo không tự bị xóa. Chỉ người chăm sóc quản lý hồ sơ được xóa đơn.

### 6. Theo dõi uống thuốc và xử lý cảnh báo

**Xem nhanh tại Tổng quan:** lịch hôm nay, lần uống gần nhất, tỷ lệ tuân thủ trong 7/30/90 ngày, diễn biến theo ngày, đơn đang dùng, chỉ số gần nhất và lịch tái khám.

**Xem chi tiết tại Lịch cữ thuốc:**

1. Chọn **Hôm nay**, **7 ngày qua**, **30 ngày qua**, **7 ngày tới** hoặc nhập khoảng ngày.
2. Lọc trạng thái nếu cần, chẳng hạn **Bỏ lỡ** hoặc **Xác nhận muộn**.
3. Bấm vào một cữ để xem từng thuốc và các bản ghi xác nhận.
4. Khi người bệnh vừa uống thuốc, chọn **Xác nhận hộ** ở thuốc tương ứng. Hệ thống ghi giờ hiện tại và tên tài khoản người chăm sóc. Có thể xác nhận từ 60 phút trước giờ hẹn. Sau khoảng đúng giờ, hệ thống ghi nhận muộn trong ngày của cữ.
5. Kiểm tra giờ uống và người xác nhận.

Ví dụ với cữ **07:00**, nếu đến **07:30** máy chủ vẫn chưa nhận được xác nhận uống thuốc, người chăm sóc nhận cảnh báo ở biểu tượng chuông và người được ủy quyền nhận lời nhắc trên màn hình lịch thuốc. Mở ứng dụng và kết nối mạng để nhận thông báo. Sau **08:00**, cữ còn thiếu xác nhận sẽ chuyển sang **Bỏ lỡ**.

Khi có cảnh báo, kiểm tra với bệnh nhân hoặc người nhà. Đánh dấu **Đã đọc** để lưu việc đã xem cảnh báo. Chỉ bấm **Xác nhận hộ** khi đã biết người bệnh uống thuốc.

Tỷ lệ tuân thủ trên Tổng quan tính các cữ được ghi nhận đúng hạn, gồm bệnh nhân tự xác nhận và người chăm sóc hoặc người nhà được ủy quyền xác nhận hộ. Các cữ xác nhận muộn được thống kê riêng.

### 7. Đính chính giờ uống khi ghi nhận sai

1. Vào **Lịch cữ thuốc**, mở cữ có bản ghi cần sửa.
2. Chọn **Sửa giờ** tại thuốc tương ứng.
3. Nhập ngày uống và giờ uống thực tế, bấm **Lưu**.
4. Mở **Lịch sử sửa giờ** để xem các lần chỉnh sửa.

Chỉ người chăm sóc quản lý hồ sơ có quyền đính chính; bệnh nhân và người nhà không tự sửa giờ uống. Bản ghi gốc được giữ lại cùng tên người đính chính. Tính năng này sửa giờ của xác nhận đã có, không phải nút xác nhận hộ cho cữ chưa được xác nhận.

### 8. Ủy quyền người nhà và thu hồi thiết bị

**Thêm người hỗ trợ:**

1. Vào **Hồ sơ & thiết bị → Người nhà được ủy quyền**.
2. Nhập tên gọi người nhà và quan hệ với bệnh nhân, bấm **Ủy quyền**.
3. Trở lại mục liên kết, chọn người nhà đó ở **Tạo mã cho** và tạo mã.
4. Nhập mã trên thiết bị dành cho người nhà.
5. Người nhà nhận lời nhắc khi cữ còn thiếu xác nhận sau 30 phút. Chọn **Đã nhắc** sau khi liên hệ với bệnh nhân. Khi biết bệnh nhân đã uống, bấm **Xác nhận hộ** để ghi nhận.

Nút **Đã nhắc …** trên cảnh báo của người nhà chỉ ghi nhận đã nhắc, không xác nhận rằng bệnh nhân đã uống.

**Khi mất hoặc đổi máy:** chọn **Thu hồi** ở thiết bị tương ứng. Thiết bị bị thu hồi không tiếp tục nhận nhắc hoặc xác nhận; muốn dùng lại phải ghép bằng mã mới.

**Khi ngừng ủy quyền:** chọn **Thu hồi quyền** ở người nhà tương ứng. Các thiết bị gắn với quyền đó bị ngắt kết nối.

### 9. Ghi chỉ số xét nghiệm và quản lý tái khám

**Ghi chỉ số:**

1. Vào **Chỉ số & tái khám**, mở chức năng ghi chỉ số xét nghiệm.
2. Chọn HbA1c, đường huyết lúc đói, đường huyết sau ăn 2 giờ hoặc chỉ số khác.
3. Nhập ngày xét nghiệm, giá trị, đơn vị và ghi chú theo kết quả có sẵn.
4. Với **Chỉ số khác**, ghi rõ tên chỉ số trong phần ghi chú.
5. Lưu và xem kết quả, biểu đồ xu hướng tương ứng.

**Thêm lịch tái khám:**

1. Chọn **Thêm lịch tái khám**.
2. Nhập ngày hẹn, số ngày nhắc trước từ **0 đến 14** và ghi chú chuẩn bị.
3. Lưu; xem lịch tại trang này hoặc Tổng quan.
4. Sau khi đã đi khám, chọn **Đã đi khám** khi nút xuất hiện vào ngày hẹn, hoặc **Đánh dấu đã khám** trong lịch sử lịch hẹn.

### 10. Xuất báo cáo và tra cứu nhật ký

**Báo cáo PDF:** vào **Báo cáo**, chọn kỳ **30/60/90 ngày**, bấm **Tạo báo cáo**. Chờ trạng thái **Sẵn sàng**, rồi chọn **Xem** hoặc **Tải PDF**. Có thể in hoặc mang tệp khi tái khám. Báo cáo tổng hợp lịch sử uống thuốc, phân biệt nguồn xác nhận và kèm chỉ số xét nghiệm; hệ thống không tự gửi báo cáo cho bác sĩ.

**Nhật ký thao tác:** vào **Nhật ký thao tác**, tìm theo nội dung/người thực hiện và lọc thao tác, vai trò. Mở dòng cần xem để kiểm tra chi tiết. Nhật ký chỉ được thêm, không sửa hoặc xóa.

### 11. Quy trình sử dụng hằng ngày cho người con

1. Chọn đúng hồ sơ và xem **Tổng quan**.
2. Kiểm tra các cữ đang chờ, bỏ lỡ và cảnh báo mới.
3. Liên hệ bệnh nhân/người nhà để xác minh những cữ chưa có xác nhận.
4. Kiểm tra lịch tái khám; cập nhật kết quả xét nghiệm và đơn thuốc khi có thông tin mới.
5. Trước lần khám, tạo báo cáo PDF của kỳ cần xem.

<a id="phan-benh-nhan"></a>

## PHẦN II — DÀNH CHO BỆNH NHÂN

### 1. Tổng hợp tính năng

| Tính năng | Cách sử dụng |
|---|---|
| Đăng ký/đăng nhập | Dùng email và mật khẩu; lần đăng ký đầu cần mã liên kết do người con cung cấp |
| Ghép thiết bị | Có thể dùng cách ghép bổ sung bằng mã 6 số |
| Xem lịch thuốc | Xem cữ cần thực hiện, cữ tiếp theo và lịch thuốc hôm nay |
| Xem cách dùng | Đọc tên thuốc, số lượng, đơn vị và ghi chú tại cữ thuốc |
| Nhắc đến giờ | Nhận màn hình nhắc và âm thanh khi giao diện đang hoạt động, trình duyệt cho phép |
| Xác nhận uống thuốc | Bấm XÁC NHẬN ĐÃ UỐNG sau khi uống xong |
| Xem lần uống gần nhất | Kiểm tra giờ đã ghi nhận và trạng thái chờ gửi nếu có |
| Chữ lớn | Dùng nút đổi cỡ chữ để chuyển giữa chữ lớn và rất lớn |
| Dùng khi mất mạng | Xem lịch đã tải và lưu tạm xác nhận, tự gửi lại khi có mạng |

Bệnh nhân chỉ thao tác trên lịch của mình. Việc quản lý đơn, nhập chỉ số, tạo báo cáo và đính chính giờ uống do người con thực hiện.

### 2. Bắt đầu sử dụng

**Lần đầu dùng tài khoản:**

1. Nhờ người con tạo mã liên kết cho hồ sơ của mình.
2. Mở An Tâm, chọn **Tôi là Bệnh Nhân → Đăng ký**.
3. Nhập tên hiển thị, mã liên kết 6 số, email và mật khẩu ít nhất 8 ký tự; nhập lại mật khẩu.
4. Bấm **Tạo tài khoản**.
5. Kiểm tra tên gọi trên màn hình có đúng là của mình hay không.

**Những lần sau:** chọn **Tôi là Bệnh Nhân**, nhập email và mật khẩu rồi bấm **Đăng nhập**. Không cần xin mã mới cho mỗi lần đăng nhập.

Nếu người con hướng dẫn dùng cách ghép thiết bị, chọn **Ghép thiết bị bằng mã 6 số**, nhập mã, bấm **GHÉP NỐI → BẮT ĐẦU**. Mã hết hạn hoặc đã dùng thì nhờ tạo mã mới.

### 3. Xem lịch và xác nhận đã uống

1. Mở giao diện bệnh nhân và xem tên gọi của mình.
2. Xem cữ đang đến giờ: giờ uống, tên thuốc, số lượng và ghi chú.
3. Sau khi đã uống xong các thuốc được liệt kê trong cữ, bấm **XÁC NHẬN ĐÃ UỐNG** một lần.
4. Kiểm tra màn hình chuyển sang **Đã uống lúc …** hoặc thông báo đã ghi nhận.
5. Xem **Lần uống gần nhất** và **Lịch thuốc hôm nay** để biết cữ đã ghi nhận và cữ tiếp theo.

Một thẻ cữ có thể liệt kê nhiều thuốc; nút xác nhận trên thẻ ghi nhận các thuốc chưa xác nhận thuộc nhóm đó. Nếu chưa uống đủ các thuốc được liệt kê, hãy nhờ người con kiểm tra trước khi xác nhận cả nhóm.

Khi xuất hiện màn hình **ĐẾN GIỜ UỐNG THUỐC**, xem thông tin cữ và chỉ bấm xác nhận sau khi đã uống. Nút có thể xuất hiện từ 60 phút trước giờ hẹn theo quy tắc ghi nhận của ứng dụng; đây không phải chỉ định thay đổi giờ dùng thuốc.

### 4. Khi đã quá giờ hoặc bấm nhầm

- Nếu màn hình ghi **Chưa xác nhận**, kiểm tra mình đã uống hay chưa và báo người con khi cần hỗ trợ.
- Nếu đã uống và còn được phép xác nhận, dùng nút xác nhận trên cữ đang hiển thị; hệ thống có thể ghi **Xác nhận muộn**.
- Nếu đã uống trước đó nhưng quên bấm, trao đổi với người con để kiểm tra giờ thực tế và đính chính bản ghi khi cần.
- Nếu bấm nhầm hoặc giờ ghi nhận sai, nhờ người con đính chính. Bệnh nhân không tự sửa giờ trên giao diện này.
- Thông báo bỏ lỡ không phải hướng dẫn uống bù; thực hiện theo hướng dẫn dùng thuốc đã được bác sĩ cung cấp.

### 5. Phóng to chữ

**Phóng to chữ:** bấm biểu tượng đổi cỡ chữ ở cạnh lời chào. Bấm lại để đổi giữa cỡ chữ lớn và rất lớn.

### 6. Sử dụng khi mất mạng

1. Khi có mạng, điện thoại tải lịch hôm nay và 6 ngày tiếp theo. Giữ app mở để nhận lời nhắc theo lịch đã lưu khi chuyển ngày.
2. Sau khi uống, bấm **XÁC NHẬN ĐÃ UỐNG**; kiểm tra thông báo **chờ gửi** hoặc **Sẽ tự gửi khi có mạng**.
3. Kết nối lại Wi-Fi/dữ liệu di động và giữ hoặc mở lại giao diện để hệ thống gửi xác nhận.
4. Kiểm tra trạng thái đã đồng bộ; nhờ người con xem lại nếu vẫn còn chờ gửi hoặc xuất hiện lỗi.

Nếu máy chưa tải lịch thì cần có mạng để tải lần đầu. Xác nhận ngoại tuyến được hệ thống tiếp nhận trong giới hạn **72 giờ**, với giờ uống đáp ứng quy tắc của cữ; không nên để các xác nhận tồn lâu trên máy.

**Không đăng xuất khi còn xác nhận chờ gửi.** Giao diện sẽ cảnh báo; nếu vẫn đăng xuất, những xác nhận chưa gửi sẽ bị xóa khỏi phiên này.

### 7. Ba việc cần nhớ mỗi ngày

1. **Mở lịch** để xem cữ và thông tin thuốc.
2. **Uống xong mới bấm XÁC NHẬN ĐÃ UỐNG**.
3. **Kiểm tra đã ghi nhận**; nếu có lỗi hoặc không rõ, nhờ người con hỗ trợ.

<a id="tra-cuu"></a>

## TRA CỨU TRẠNG THÁI VÀ LỖI THƯỜNG GẶP

### 1. Ý nghĩa trạng thái cữ thuốc

| Trạng thái | Ý nghĩa |
|---|---|
| Đã lên lịch / Sắp tới | Chưa đến giờ nhắc |
| Đang chờ / Đến giờ uống | Đã đến giờ, đang chờ xác nhận |
| Đã uống | Bệnh nhân tự xác nhận trong khoảng đúng giờ |
| Đã uống (hộ) | Người chăm sóc hoặc người nhà được ủy quyền xác nhận hộ trong khoảng đúng giờ |
| Xác nhận muộn / Uống muộn | Giờ uống được ghi nhận sau thời hạn |
| Bỏ lỡ / Chưa xác nhận | Đã quá thời hạn nhưng hệ thống chưa có xác nhận |
| Đã hủy | Cữ không còn áp dụng do thay hoặc xóa đơn thuốc |
| Đã ghi … · chờ gửi | Xác nhận đang lưu trên máy, chưa đồng bộ lên hệ thống |

Quy tắc ghi nhận hiện tại: **từ 60 phút trước đến 60 phút sau giờ hẹn, gồm cả hai mốc**, được tính đúng giờ. Ví dụ cữ hẹn 07:00 có khoảng đúng giờ 06:00–08:00. Sau 08:00 mà chưa có xác nhận thì chuyển Bỏ lỡ. Xác nhận gửi lại khi có mạng được xét theo giờ uống ghi nhận, không chỉ theo lúc máy chủ nhận dữ liệu. Khoảng đúng giờ có thể qua nửa đêm; ngoài khoảng đó, xác nhận muộn phải thuộc ngày của cữ.

### 2. Xử lý tình huống thường gặp

| Tình huống | Cách xử lý |
|---|---|
| Không đăng nhập được | Kiểm tra vai trò đã chọn, email, mật khẩu và kết nối; đọc thông báo lỗi trên màn hình |
| Mã liên kết/ghép nối không dùng được | Kiểm tra đủ 6 số; nhờ người con tạo mã mới nếu đã dùng hoặc quá 5 phút |
| Nhập mã sai nhiều lần | Chờ theo thông báo trên màn hình trước khi thử lại |
| Bệnh nhân chưa có lịch thuốc | Người con kiểm tra đúng hồ sơ, đơn đã được xác nhận, khoảng ngày áp dụng; đơn nháp chưa sinh lịch |
| Không nghe chuông | Kiểm tra âm lượng, quyền phát âm thanh của trình duyệt và trang có đang mở; xem lịch trực tiếp |
| Mất mạng và chưa có lịch lưu | Kết nối mạng để tải lịch trước |
| Xác nhận còn chờ gửi | Kết nối lại và mở giao diện để đồng bộ; không đăng xuất khi vẫn còn dữ liệu chờ gửi |
| Cữ đã có người xác nhận | Xem bản ghi hiện có, không cần xác nhận lại; nhờ người con đính chính nếu giờ sai |
| Cữ đã bị hủy | Tải lại lịch và kiểm tra đơn mới với người con |
| Điện thoại bị ngắt kết nối | Nhờ người con kiểm tra thiết bị, tạo mã mới và ghép lại nếu cần |
| Không sửa được đơn | Kiểm tra trạng thái: chỉ sửa được đơn Nháp; đơn đã xác nhận cần được thay bằng đơn mới |
| Không tải được PDF | Chờ báo cáo Sẵn sàng; nếu trạng thái Lỗi thì tạo lại, kiểm tra kết nối và thử tải lại |

### 3. Mô phỏng thời gian và kiểm tra cữ quá giờ

Khi chạy bản local, mỗi lần khởi động backend, giờ hệ thống bắt đầu từ **06:00 của ngày hiện tại theo múi giờ Việt Nam (UTC+07)**. Đồng hồ tiếp tục chạy và có thể tua tiến. Tất cả ô nhập giờ dùng định dạng **HH:mm từ 00:00 đến 23:59**, ví dụ `07:00`, `13:30`, `19:00`; không nhập AM/PM.

1. Đăng nhập vai trò người chăm sóc, chọn hồ sơ có đơn đã xác nhận và còn cữ chưa uống.
2. Mở **Mô phỏng thời gian** ở góc trái dưới.
3. Bấm **Tới cữ tiếp theo** để kiểm tra màn hình nhắc thuốc và trạng thái Đang chờ.
4. Để cữ ở trạng thái chờ và bấm **+15 phút** hai lần. Kiểm tra cảnh báo trên máy người chăm sóc và máy của người được ủy quyền đang mở lịch của bệnh nhân đó.
5. Bấm **Skip quá giờ** để kiểm tra trạng thái **Bỏ lỡ** một phút sau hạn xác nhận. Các nút tua theo cữ tìm lịch trong 14 ngày kể từ ngày mô phỏng hiện tại.

Khởi động lại backend đưa đồng hồ về 06:00 nhưng **không xóa lịch sử hoặc đưa các cữ đã xác nhận/bỏ lỡ về ban đầu**. Nếu cữ cũ đã được xử lý, hãy tạo đơn mới để thử tiếp. Môi trường production dùng giờ thực; bản local có thể tắt mô phỏng bằng `ENABLE_DEV_TOOLS=false`.

### 4. Phạm vi phiên bản hiện tại

Hướng dẫn này được đối chiếu với các màn hình và quy tắc trong mã nguồn hiện tại. Đơn thuốc và kết quả xét nghiệm được nhập qua biểu mẫu; không mô tả việc tự lấy dữ liệu từ bệnh viện, quét đơn bằng camera hoặc đo chỉ số tự động. Các mục **điện thoại mô phỏng**, **Mất mạng** và **Mô phỏng thời gian** phục vụ chạy thử. Các mã yêu cầu và ghi chú kỹ thuật đã được bỏ khỏi giao diện MVP.
