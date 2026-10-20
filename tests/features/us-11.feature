@US-11 @FR-13 @FR-15
Feature: US-11 - xác nhận hộ khi bệnh nhân quên bấm
  Là người nhà sống cùng, tôi muốn xác nhận hộ khi bệnh nhân quên bấm để bổ sung ghi nhận khi bệnh nhân đã uống nhưng quên bấm.

  @AC-US-11-01
  Scenario: Luồng chuẩn
    Given thiết bị người nhà có quyền và cữ trong hạn
    When bấm xác nhận hộ
    Then lưu vai trò delegate và trạng thái xác nhận hộ

  @AC-US-11-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given thiết bị người nhà có quyền và cữ trong hạn
    When bấm xác nhận hộ sau hạn
    Then lưu trạng thái muộn và vẫn giữ vai trò delegate
