@US-03 @FR-12
Feature: US-03 - nhận cảnh báo khi bố bỏ lỡ cữ thuốc
  Là người con, tôi muốn nhận cảnh báo khi bố bỏ lỡ cữ thuốc để gọi nhắc bố kịp thời.

  @AC-US-03-01
  Scenario: Luồng chuẩn
    Given cữ đã quá ngưỡng và chưa có xác nhận
    When bộ lập lịch xử lý cữ
    Then cữ thành bỏ lỡ và có cảnh báo cho người chăm sóc

  @AC-US-03-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given cữ đã quá ngưỡng và chưa có xác nhận
    When bộ lập lịch xử lý lại cùng cữ
    Then không tạo thêm cảnh báo cùng sự kiện
