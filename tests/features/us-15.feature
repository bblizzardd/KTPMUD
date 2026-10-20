@US-15 @FR-16
Feature: US-15 - ghi chỉ số xét nghiệm sau mỗi đợt khám
  Là người con, tôi muốn ghi chỉ số xét nghiệm sau mỗi đợt khám để theo dõi xu hướng đường huyết của bố.

  @AC-US-15-01
  Scenario: Luồng chuẩn
    Given người chăm sóc có quyền trên hồ sơ
    When nhập chỉ số hợp lệ kèm loại, đơn vị và ngày
    Then lưu và hiển thị chỉ số trong lịch sử

  @AC-US-15-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc có quyền trên hồ sơ
    When nhập giá trị âm hoặc đơn vị không khớp
    Then từ chối và không thêm chỉ số
