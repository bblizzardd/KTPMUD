@US-09 @FR-11 @FR-14 @FR-15
Feature: US-09 - bấm một nút "Đã uống" để xác nhận
  Là bệnh nhân, tôi muốn bấm một nút "Đã uống" để xác nhận để xác nhận mà không cần đăng nhập hay nhập liệu.

  @AC-US-09-01
  Scenario: Luồng chuẩn
    Given thiết bị bệnh nhân có quyền và cữ đã đến
    When bệnh nhân bấm Đã uống
    Then thêm xác nhận với người, vai trò và thời điểm

  @AC-US-09-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given thiết bị bệnh nhân có quyền và cữ đã đến
    When cùng yêu cầu được gửi lại
    Then trả xác nhận hiện có và không tăng số bản ghi
