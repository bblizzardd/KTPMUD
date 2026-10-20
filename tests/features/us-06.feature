@US-06 @FR-03
Feature: US-06 - ủy quyền cho người nhà sống cùng xác nhận hộ
  Là người con, tôi muốn ủy quyền cho người nhà sống cùng xác nhận hộ để có người hỗ trợ ngay tại nhà.

  @AC-US-06-01
  Scenario: Luồng chuẩn
    Given người chăm sóc quản lý hồ sơ
    When tạo mã và ghép thiết bị người nhà
    Then thiết bị có quyền xác nhận hộ đúng hồ sơ

  @AC-US-06-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc quản lý hồ sơ
    When thiết bị đã bị thu hồi gửi xác nhận
    Then từ chối và không thêm bản ghi
