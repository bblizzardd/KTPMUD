@US-16 @FR-17
Feature: US-16 - được nhắc trước ngày tái khám
  Là người con, tôi muốn được nhắc trước ngày tái khám để kịp sắp xếp đưa bố đi khám.

  @AC-US-16-01
  Scenario: Luồng chuẩn
    Given có lịch tái khám và số ngày nhắc trước hợp lệ
    When đến khoảng ngày nhắc
    Then tạo nhắc tái khám đúng hồ sơ

  @AC-US-16-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given có lịch tái khám và số ngày nhắc trước hợp lệ
    When bộ lập lịch quét lại trong cùng khoảng
    Then không tạo trùng nhắc cho cùng lịch
