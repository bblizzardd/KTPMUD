@US-13 @FR-01
Feature: US-13 - tạo hồ sơ bệnh nhân chỉ với tên gọi và năm sinh
  Là người con, tôi muốn tạo hồ sơ bệnh nhân chỉ với tên gọi và năm sinh để không phải khai thông tin định danh thật.

  @AC-US-13-01
  Scenario: Luồng chuẩn
    Given người chăm sóc đã đăng nhập
    When tạo hồ sơ với tên gọi và năm sinh hợp lệ
    Then lưu hồ sơ gắn tài khoản, không yêu cầu số định danh hay BHYT

  @AC-US-13-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc đã đăng nhập
    When nhập năm sinh không hợp lệ
    Then báo lỗi và không tạo hồ sơ
