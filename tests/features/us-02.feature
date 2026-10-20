@US-02 @FR-06 @FR-07 @FR-09
Feature: US-02 - duyệt đơn trước khi đơn được áp dụng
  Là người con, tôi muốn duyệt đơn trước khi đơn được áp dụng để lịch nhắc luôn khớp đơn mới nhất.

  @AC-US-02-01
  Scenario: Luồng chuẩn
    Given đơn nháp hợp lệ và đang có đơn cũ hiệu lực
    When người chăm sóc xác nhận đơn mới
    Then đơn cũ bị thay thế, cữ tương lai cũ bị hủy và lịch mới được sinh

  @AC-US-02-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given đơn nháp hợp lệ và đang có đơn cũ hiệu lực
    When xác nhận lại đơn đã hiệu lực
    Then từ chối thao tác và không sinh trùng cữ
