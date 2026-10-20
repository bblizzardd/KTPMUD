@US-01 @FR-04 @FR-05
Feature: US-01 - nhập đơn thuốc có gợi ý tên từ danh mục
  Là người con, tôi muốn nhập đơn thuốc có gợi ý tên từ danh mục để không gõ sai tên thuốc.

  @AC-US-01-01
  Scenario: Luồng chuẩn
    Given người chăm sóc đang tạo đơn nháp
    When nhập tên thuốc từ hai ký tự và chọn gợi ý
    Then dòng thuốc giữ tên gốc và mã danh mục đã chọn

  @AC-US-01-02
  Scenario: Ngoại lệ hoặc tình huống biên
    Given người chăm sóc đang tạo đơn nháp
    When nhập tên không có trong danh mục
    Then cho phép giữ tên tự do và không tự đổi thuốc
