@US-10 @FR-11
Feature: US-10 - thấy giờ mình đã uống cữ gần nhất
  Là bệnh nhân, tôi muốn thấy giờ mình đã uống cữ gần nhất để không uống trùng liều.

  @AC-US-10-01
  Scenario: Luồng chuẩn
    Given bệnh nhân vừa xác nhận cữ
    When mở lại màn hình cữ
    Then hiển thị thời điểm xác nhận gần nhất

  @AC-US-10-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given bệnh nhân vừa xác nhận cữ
    When chưa có bản ghi xác nhận cho cữ
    Then hiển thị chưa ghi nhận, không tự điền thời điểm
