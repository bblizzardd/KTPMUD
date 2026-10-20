@US-14 @FR-02
Feature: US-14 - ghép điện thoại của bố bằng mã một lần
  Là người con, tôi muốn ghép điện thoại của bố bằng mã một lần để bố dùng được ứng dụng mà không cần đăng nhập.

  @AC-US-14-01
  Scenario: Luồng chuẩn
    Given người chăm sóc đã tạo mã ghép nối còn hạn
    When thiết bị nhập mã lần đầu
    Then cấp phiên thiết bị đúng hồ sơ và đánh dấu mã đã dùng

  @AC-US-14-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc đã tạo mã ghép nối còn hạn
    When nhập lại mã đã dùng
    Then từ chối và không tạo phiên mới
