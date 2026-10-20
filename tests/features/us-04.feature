@US-04 @FR-19
Feature: US-04 - xem tỷ lệ tuân thủ theo kỳ 7, 30, 90 ngày
  Là người con, tôi muốn xem tỷ lệ tuân thủ theo kỳ 7, 30, 90 ngày để không phải gọi hỏi hằng ngày.

  @AC-US-04-01
  Scenario: Luồng chuẩn
    Given có cữ đúng hạn, xác nhận hộ, muộn và hủy trong kỳ
    When người chăm sóc chọn kỳ 30 ngày
    Then tỷ lệ đúng hạn chỉ tính cữ đến giờ, loại cữ hủy và tách muộn

  @AC-US-04-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given có cữ đúng hạn, xác nhận hộ, muộn và hủy trong kỳ
    When chọn kỳ không có cữ hợp lệ
    Then hiển thị chưa có dữ liệu và không chia cho không
