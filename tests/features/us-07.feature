@US-07 @FR-08
Feature: US-07 - được cảnh báo khi hai thuốc trong đơn trùng hoạt chất
  Là người con, tôi muốn được cảnh báo khi hai thuốc trong đơn trùng hoạt chất để kiểm tra lại đơn với bác sĩ khi có cảnh báo.

  @AC-US-07-01
  Scenario: Luồng chuẩn
    Given hai dòng thuốc đã được đối chiếu cùng hoạt chất trong danh mục thử
    When kiểm tra đơn thuốc
    Then hiển thị cảnh báo trùng hoạt chất và không tự sửa đơn

  @AC-US-07-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given hai dòng thuốc đã được đối chiếu cùng hoạt chất trong danh mục thử
    When dòng thuốc chỉ có tên tự do chưa xác định hoạt chất
    Then không kết luận an toàn hoặc tự suy ra hoạt chất
