@US-05 @FR-20
Feature: US-05 - xuất báo cáo PDF 30 ngày
  Là người con, tôi muốn xuất báo cáo PDF 30 ngày để bác sĩ có lịch sử ghi nhận để tham khảo tại tái khám.

  @AC-US-05-01
  Scenario: Luồng chuẩn
    Given người chăm sóc có quyền xem hồ sơ
    When yêu cầu xuất PDF 30 ngày
    Then PDF chứa kỳ báo cáo, tỷ lệ, vai trò xác nhận và chỉ số trong kỳ

  @AC-US-05-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc có quyền xem hồ sơ
    When tài khoản khác yêu cầu xuất báo cáo cùng hồ sơ
    Then từ chối và không trả dữ liệu báo cáo
