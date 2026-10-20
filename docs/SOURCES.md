# Nguồn và cách đóng gói

Ngày đóng gói: 20/10/2026.

- Báo cáo nguồn: `N01-01_Phùng Tuấn Tài_20_Trần Đức Trí_65_Trần Nguyễn Phúc Bình_Tuần 6.docx`; SHA-256 `f4227f7c4387fce7161273ee1004ab09023ced3ff492f0bc88cc53d6090fe6f0`. Giữ nguyên mã của 4 BIZ, 17 US, 13 UC, 20 FR, 11 NFR và 7 BR.
- Tài liệu yêu cầu do người dùng cung cấp: `01 Review và các yêu cầu cụ thể c....docx`, các mục Công việc 2.4, tuần 4–5 và Checklist nghiệm thu.
- Hiện trạng: mã ứng dụng tại commit `bde568e`, README.md và VERIFICATION.md. Các bảng yêu cầu lấy từ báo cáo tuần 6, không suy ra rằng đã nghiệm thu.
- Các tệp mới (DDL chuẩn hóa, sơ đồ nguồn, OpenAPI, mock, Gherkin, chi tiết UC bổ sung) được xây dựng từ các nguồn trên; cần review chéo của nhóm. Không giả lập chữ ký, điểm đóng góp hay kết quả kiểm thử người dùng.
- Không đưa danh sách phỏng vấn, thông tin sức khỏe cá nhân hay cơ sở dữ liệu đang sử dụng lên kho mã. Chỉ dữ liệu BN-TEST giả lập được đóng gói.
- Báo cáo có tên đường dẫn API khác bản local, JWT khác cookie local và PostgreSQL khác SQLite local. Xem [Gap Matrix](GAP_MATRIX.md).
- BIZ là mục tiêu nghiệp vụ; BR là ràng buộc nghiệp vụ. Không dùng hai mã này thay cho nhau.
- RTM nguồn dùng TC-01…TC-39 nhưng báo cáo không chứa đủ bước chạy chi tiết. Bộ AC-US mới bổ sung các bước Given/When/Then; giữ mã TC cũ để đối chiếu, không công bố chúng đã chạy.
