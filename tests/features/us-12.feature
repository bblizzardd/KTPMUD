@US-12 @FR-12
Feature: US-12 - nhận cảnh báo khi cữ thuốc bị bỏ lỡ
  Là người nhà sống cùng, tôi muốn nhận cảnh báo khi cữ thuốc bị bỏ lỡ để nhắc bệnh nhân ngay tại nhà.

  @AC-US-12-01
  Scenario: Luồng chuẩn
    Given cữ quá hạn và có người nhà được ủy quyền
    When hệ thống phát cảnh báo bỏ lỡ
    Then người nhà có quyền thấy cảnh báo của hồ sơ

  @AC-US-12-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given cữ quá hạn và có người nhà được ủy quyền
    When hồ sơ không có người nhà được ủy quyền
    Then chỉ cảnh báo người chăm sóc và không gửi cho thiết bị không có quyền
