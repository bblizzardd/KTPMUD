@US-17 @FR-18
Feature: US-17 - xem lại nhật ký ai đã làm gì trên hồ sơ
  Là người con, tôi muốn xem lại nhật ký ai đã làm gì trên hồ sơ để tin tưởng dữ liệu tuân thủ.

  @AC-US-17-01
  Scenario: Luồng chuẩn
    Given người chăm sóc thực hiện thao tác ghi hợp lệ
    When thao tác hoàn tất
    Then nhật ký có thời điểm, người thực hiện, hành động và trạng thái

  @AC-US-17-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc thực hiện thao tác ghi hợp lệ
    When có yêu cầu sửa hoặc xóa nhật ký
    Then từ chối và giữ nguyên bản ghi
