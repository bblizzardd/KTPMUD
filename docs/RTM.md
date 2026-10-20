# Ma trận truy vết

Đủ liên kết cho 20 FR và 11 NFR; không đồng nghĩa đủ kiểm thử đạt. FR-18 xuyên suốt các UC ghi dữ liệu. Đã hợp nhất liên kết US→FR từ bảng story với RTM nguồn để tránh mất US-12/17.

| FR | BIZ | US | UC | Module mục tiêu | Dữ liệu mục tiêu | TC nguồn | AC bổ sung | Trạng thái nghiệm thu |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-01 | BIZ-02 | US-13 | UC-01, UC-02 | Backend: Auth, Hồ sơ | caregivers, patients | TC-30, 31 | [US-13](../tests/features/us-13.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-02 | BIZ-04 | US-14 | UC-03 | Backend: Thiết bị | devices, pairing_codes | TC-32, 33 | [US-14](../tests/features/us-14.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-03 | BIZ-01 | US-06 | UC-04 | Backend: Thiết bị | delegates | TC-13, 14, 15 | [US-06](../tests/features/us-06.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-04 | BIZ-01 | US-01 | UC-05 | Backend: Đơn thuốc | prescriptions, prescription_items | TC-01, 02 | [US-01](../tests/features/us-01.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-05 | BIZ-01 | US-01 | UC-05 | Backend: Đơn thuốc; Cache | drugs | TC-01, 03 | [US-01](../tests/features/us-01.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-06 | BIZ-01 | US-02 | UC-06 | Backend: Đơn thuốc | prescriptions | TC-05, 06 | [US-02](../tests/features/us-02.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-07 | BIZ-01 | US-02 | UC-06 | Backend: Đơn thuốc; Worker | prescriptions, doses | TC-04 | [US-02](../tests/features/us-02.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-08 | BIZ-01 | US-07 | UC-06 | Rule Engine; AI service | drug_ingredients | TC-16, 17 | [US-07](../tests/features/us-07.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-09 | BIZ-01 | US-02 | UC-10 | Worker: Scheduler | doses | TC-04 | [US-02](../tests/features/us-02.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-10 | BIZ-01 | US-08 | UC-10 | Worker: Notifier; Mobile App | doses, devices | TC-18, 19 | [US-08](../tests/features/us-08.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-11 | BIZ-04 | US-09, US-10 | UC-07 | Backend: Tuân thủ; Mobile App | dose_confirmations | TC-20, 23, 24 | [US-09](../tests/features/us-09.feature), [US-10](../tests/features/us-10.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-12 | BIZ-02 | US-03, US-12 | UC-10 | Worker; Rule Engine | doses, alerts | TC-07, 08, 28, 29 | [US-03](../tests/features/us-03.feature), [US-12](../tests/features/us-12.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-13 | BIZ-03 | US-10, US-11 | UC-07, UC-08 | Backend: Tuân thủ | dose_confirmations | TC-25, 26 | [US-10](../tests/features/us-10.feature), [US-11](../tests/features/us-11.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-14 | BIZ-03 | US-09 | UC-07 | Rule Engine | dose_confirmations | TC-22 | [US-09](../tests/features/us-09.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-15 | BIZ-03 | US-09, US-11 | UC-07, UC-08 | Backend: Tuân thủ | dose_confirmations | TC-21, TC-27 (bấm lặp);  | [US-09](../tests/features/us-09.feature), [US-11](../tests/features/us-11.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-16 | BIZ-03 | US-15 | UC-11 | Backend: Chỉ số | lab_results | TC-34, 35 | [US-15](../tests/features/us-15.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-17 | BIZ-02 | US-16 | UC-12 | Worker: Scheduler | appointments | TC-36, 37 | [US-16](../tests/features/us-16.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-18 | BIZ-03 | US-17 | Mọi UC ghi dữ liệu | Backend: Audit | audit_logs | TC-38, 39 | [US-17](../tests/features/us-17.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-19 | BIZ-02 | US-04 | UC-09 | Backend: Tuân thủ; Cache | doses | TC-09, 10 | [US-04](../tests/features/us-04.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |
| FR-20 | BIZ-03 | US-05 | UC-13 | Worker: PDF; Cloud Storage | reports | TC-11, 12 | [US-05](../tests/features/us-05.feature) | Chưa nghiệm thu toàn bộ; xem Test Report |

## Yêu cầu phi chức năng
| NFR | User story | Use case | Module thiết kế | Ca kiểm thử | Bằng chứng/trạng thái |
| --- | --- | --- | --- | --- | --- |
| NFR-01 | US-08, US-09 | UC-07 | Mobile App | TC-18, 20 | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-02 | US-08 | UC-10 | Worker: Notifier | TC-07, 18 | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-05 | US-13 | UC-02 | Schema CSDL | TC-30 | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-06 | US-09, US-17 | Mọi UC ghi dữ liệu | Backend: Audit; CSDL | TC-21, 39 | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-11 | US-03 | UC-10 | Rule Engine | Benchmark CI | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-03 | US-01, US-04 | UC-05, UC-09 | Backend, Cache | Kiểm thử tải theo p95 và độ trễ gợi ý | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-04 | US-13, US-14 | UC-01, UC-03 | Gateway, Auth, Thiết bị | Rà soát HTTPS, mật khẩu băm, hạn và thu hồi token | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-07 | US-03, US-08 | UC-10 | Worker, RabbitMQ | Khởi động lại Worker và kiểm tra xử lý lũy đẳng | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-08 | Mọi story có Rule Engine | UC-06, UC-10 | Rule Engine, CI | Báo cáo coverage và pipeline | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-09 | US-08, US-09 | UC-07 | Mobile App | Thử trên phiên bản Android nhóm chọn | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |
| NFR-10 | US-14 | UC-03 | Backend, lưu trữ token | Kiểm tra mã hóa và quản lý khóa | Chưa nghiệm thu; xem TEST_REPORT.md và GAP_MATRIX.md |

## API và bảng dữ liệu mục tiêu
| FR | API hoặc sự kiện | Bảng dữ liệu |
| --- | --- | --- |
| FR-01 | POST /auth/register<br>POST /patients | caregivers, patients |
| FR-02 | POST /patients/{patientId}/pairing-codes<br>POST /devices/pair | devices, pairing_codes |
| FR-03 | POST, DELETE /patients/{patientId}/delegates | delegates |
| FR-04 | POST /patients/{patientId}/prescriptions | prescriptions, prescription_items |
| FR-05 | GET /drugs | drugs |
| FR-06 | PUT /prescriptions/{prescriptionId}<br>POST /prescriptions/{prescriptionId}/confirm | prescriptions |
| FR-07 | POST /prescriptions/{prescriptionId}/confirm | prescriptions, doses |
| FR-08 | GET /prescriptions/{prescriptionId} | drug_ingredients |
| FR-09 | Sự kiện nội bộ | doses |
| FR-10 | GET /device/doses/today | doses, devices |
| FR-11 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-12 | GET /patients/{patientId}/alerts | doses, alerts |
| FR-13 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-14 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-15 | POST /doses/{doseId}/confirmations | dose_confirmations |
| FR-16 | POST /patients/{patientId}/lab-results | lab_results |
| FR-17 | POST /patients/{patientId}/appointments | appointments |
| FR-18 | GET /patients/{patientId}/audit-logs | audit_logs |
| FR-19 | GET /patients/{patientId}/adherence/summary | doses |
| FR-20 | POST /patients/{patientId}/reports<br>GET /reports/{reportId} | reports |
