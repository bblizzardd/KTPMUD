# Kế hoạch và quy trình

## Timeline tuần 8–15
Kế hoạch dự kiến theo báo cáo tuần 6; mốc Sprint cần thống nhất với giảng viên.

| Tuần | Công việc trọng tâm | Kết quả cần bàn giao |
| --- | --- | --- |
| 8 | Hoàn thiện các chức năng chính và chức năng xác nhận hộ; đánh giá khả năng hỗ trợ chuẩn hóa tên thuốc bằng trí tuệ nhân tạo trong phạm vi đã chọn. | Bản chạy thử các chức năng chính; danh sách lỗi cần sửa; phạm vi áp dụng trí tuệ nhân tạo được thống nhất. |
| 9 | Hoàn thiện chức năng xuất báo cáo PDF trong phạm vi 30 ngày; hiển thị đầy đủ người xác nhận và thời điểm xác nhận; kiểm tra tính chính xác của dữ liệu trong báo cáo. | Báo cáo PDF mẫu; kết quả kiểm tra chức năng xuất báo cáo và đối chiếu dữ liệu. |
| 10 | Hoàn thiện chức năng theo dõi chỉ số xét nghiệm, quản lý lịch tái khám và nhắc lịch; kiểm tra các chức năng khi hoạt động cùng nhau. | Bản chạy thử các chức năng đã hoàn thiện; kết quả kiểm tra việc trao đổi dữ liệu giữa các phần của hệ thống. |
| 11 | Kiểm tra toàn bộ quy trình sử dụng theo các kịch bản đã xây dựng; kiểm tra các tình huống mất mạng, gửi yêu cầu nhiều lần, thu hồi quyền truy cập và thay đổi đơn thuốc. | Bảng đối chiếu yêu cầu với kết quả kiểm thử, ghi rõ nội dung đạt, chưa đạt hoặc chưa kiểm tra; danh sách lỗi cần ưu tiên xử lý. |
| 12 | Rà soát mức độ kiểm thử các yêu cầu; đánh giá tốc độ phản hồi, khả năng xử lý nhiều yêu cầu cùng lúc, bảo mật và khả năng phục hồi sau sự cố theo phạm vi nghiệm thu. | Bảng tổng hợp các yêu cầu đã được kiểm thử; số liệu và minh chứng đánh giá chất lượng hệ thống; danh sách chỉ tiêu chưa đạt hoặc chưa được đo. |
| 13 | Sửa các lỗi ưu tiên; kiểm tra lại sau khi sửa để bảo đảm các chức năng khác vẫn hoạt động đúng; cập nhật tài liệu yêu cầu, sơ đồ thiết kế, thiết kế cơ sở dữ liệu, tài liệu kết nối giữa các phần của hệ thống và hướng dẫn sử dụng. | Phiên bản dự kiến bàn giao; báo cáo kiểm thử; bộ tài liệu được cập nhật thống nhất với phần mềm. |
| 14 | Thử cài đặt và vận hành hệ thống từ đầu; tập trình diễn phần mềm và thuyết trình; thống nhất phiên bản nộp, phân công trình bày và tổng hợp đóng góp của các thành viên. | Bộ hồ sơ bàn giao; slide báo cáo cuối kỳ; danh sách kiểm tra trước khi nộp; kịch bản trình diễn phần mềm. |
| 15 | Nộp báo cáo cuối kỳ; thuyết trình, trình diễn phần mềm và trả lời câu hỏi phản biện; bàn giao mã nguồn, tài liệu và tổng kết quá trình thực hiện. | Báo cáo Word, slide thuyết trình, mã nguồn và tài liệu kèm theo; biên bản tổng kết kết quả và rút kinh nghiệm của nhóm. |

## Cách làm việc
Nhóm dùng nhịp Scrum để chia việc và kiểm tra tiến độ; độ dài Sprint do nhóm chốt. Tạo nhánh cho thay đổi, PR, review bởi thành viên khác, CI trước khi gộp. Đợt đóng gói này có sử dụng AI hỗ trợ; chưa có review độc lập của thành viên khác.

## Điều kiện sẵn sàng
Rõ người dùng/lợi ích; có Gherkin chuẩn/ngoại lệ; liên kết FR/UC/BR; ước lượng công sức; phụ thuộc được lên lịch; hợp đồng API được mô tả.

## Điều kiện hoàn thành
Review chéo; test đạt; CI thành công; độ phủ phần nghiệp vụ ít nhất 80% theo loại đo đã công bố; nhật ký không lộ định danh; tài liệu đồng bộ và demo chạy được. Không công nhận NFR chỉ từ độ phủ dòng.

## RACI dự kiến
R: làm; A: chịu trách nhiệm cuối; C: tham vấn; I: được thông báo. Phân công kế thừa báo cáo, cần nhóm xác nhận.
| Đầu ra | Phúc Bình | Đức Trí | Tuấn Tài |
| --- | --- | --- | --- |
| SRS, Gap Matrix, RTM | C | R/A | C |
| C4, OpenAPI, Gateway | R/A | C | C |
| ERD, từ điển, DDL | R/A | C | C |
| Class, Sequence, UI flow | C | C | R/A |
| Test Plan, RTM trạng thái | R | C | R/A |
| Git, CI, bàn giao kỹ thuật | R/A | I | C |

## Rủi ro
| Rủi ro | Mức độ | Biện pháp giảm thiểu |
| --- | --- | --- |
| Vấn đề P3 không đủ bằng chứng, module AI thiếu cơ sở | Cao | Thu thập ít nhất hai cặp đơn thuốc của cùng bệnh nhân qua hai đợt khám trước Sprint 3 |
| Tham số lâm sàng (ngưỡng bỏ lỡ, xác nhận muộn) sai | Trung bình | Thiết kế cấu hình được; hỏi bác sĩ hoặc dược sĩ trước khi kết thúc Sprint 2. |
| Người chăm sóc ngại nhập đơn thủ công | Trung bình | Gợi ý từ danh mục; cân nhắc sao chép đơn cũ nhưng vẫn xem lại và xác nhận. |
| Nhắc nhở không tới được thiết bị bệnh nhân | Cao | Kiểm thử trên đúng loại điện thoại bệnh nhân dùng |
| Sprint 2 quá tải với 11 story Must | Trung bình | Ước lượng story point trong Sprint Planning; xếp US-06 trước US-12; thống nhất điều chỉnh phạm vi nếu quá tải. |

## Nợ kỹ thuật
| Mã | Nợ kỹ thuật | Nguồn gốc | Kế hoạch trả |
| --- | --- | --- | --- |
| TD-01 | Ngưỡng bỏ lỡ 120 phút là giá trị giả định | Chưa có ý kiến chuyên môn | Trước khi kết thúc Sprint 2 |
| TD-02 | Cách tính Xác nhận muộn vào tỷ lệ tuân thủ chưa chốt | Phân tích hành vi Mục 2.4 | Trước khi làm US-04 |
| TD-03 | Mỗi hồ sơ chỉ có một người chăm sóc (BR-01) | Giới hạn phạm vi phiên bản 1 | Đánh giá lại ở Sprint 4 |
| TD-04 | Khung Gateway dùng dữ liệu giả lập cần được thay bằng API thật | Kế hoạch phát triển song song FE và BE | Thay dần trong Sprint 2 |
| TD-05 | Stack kỹ thuật chưa chốt | Còn chờ thống nhất nhóm | Chốt trong tuần 5 trước khi mở rộng triển khai |

## Review và retrospective
Chưa tổ chức buổi review/retrospective cho gói mới. Khi họp, ghi ngày, người tham dự, đầu ra chấp nhận/từ chối, lỗi còn lại, bài học, việc cải tiến, người phụ trách và hạn thực hiện. Không dùng bảng này làm biên bản đã ký.
