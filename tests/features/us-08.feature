@US-08 @FR-10
Feature: US-08 - nghe nhắc to và thấy chữ lớn đúng giờ uống
  Là bệnh nhân, tôi muốn nghe nhắc to và thấy chữ lớn đúng giờ uống để không lỡ giờ uống thuốc.

  @AC-US-08-01
  Scenario: Luồng chuẩn
    Given thiết bị bệnh nhân còn quyền và đã cấp quyền thông báo
    When đến mốc nhắc của cữ
    Then hiển thị nhắc dễ đọc và âm báo theo cấu hình thiết bị

  @AC-US-08-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given thiết bị bệnh nhân còn quyền và đã cấp quyền thông báo
    When người dùng từ chối quyền thông báo
    Then hiển thị trạng thái hạn chế và không báo đã gửi push thành công
