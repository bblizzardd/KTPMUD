# RTM — Trích nguyên các bảng trong báo cáo tuần 6

Nguồn: báo cáo tuần 6 tại `KTPMUD/output/`. Chỉ chuyển định dạng, giữ nguyên mã, liên kết và mô tả trong bảng gốc; không tự bổ sung ánh xạ hoặc trạng thái PASS.

## Bảng 20 — Truy vết FR

| FR | BIZ | User story | Use case | Module | Kịch bản |
| --- | --- | --- | --- | --- | --- |
| FR-01 | BIZ-02 | US-13 | UC-01, UC-02 | Backend: Auth, Hồ sơ | TC-30, 31 |
| FR-02 | BIZ-04 | US-14 | UC-03 | Backend: Thiết bị | TC-32, 33 |
| FR-03 | BIZ-01 | US-06 | UC-04 | Backend: Thiết bị | TC-13, 14, 15 |
| FR-04 | BIZ-01 | US-01 | UC-05 | Backend: Đơn thuốc | TC-01, 02 |
| FR-05 | BIZ-01 | US-01 | UC-05 | Backend: Đơn thuốc; Cache | TC-01, 03 |
| FR-06 | BIZ-01 | US-02 | UC-06 | Backend: Đơn thuốc | TC-05, 06 |
| FR-07 | BIZ-01 | US-02 | UC-06 | Backend: Đơn thuốc; Worker | TC-04 |
| FR-08 | BIZ-01 | US-07 | UC-06 | Rule Engine; AI service | TC-16, 17 |
| FR-09 | BIZ-01 | US-02 | UC-10 | Worker: Scheduler | TC-04 |
| FR-10 | BIZ-01 | US-08 | UC-10 | Worker: Notifier; Mobile App | TC-18, 19 |
| FR-11 | BIZ-04 | US-09, US-10 | UC-07 | Backend: Tuân thủ; Mobile App | TC-20, 23, 24 |
| FR-12 | BIZ-02 | US-03, US-12 | UC-10 | Worker; Rule Engine | TC-07, 08, 28, 29 |
| FR-13 | BIZ-03 | US-10, US-11 | UC-07, UC-08 | Backend: Tuân thủ | TC-25, 26 |
| FR-14 | BIZ-03 | US-09 | UC-07 | Rule Engine | TC-22 |
| FR-15 | BIZ-03 | US-09, US-11 | UC-07, UC-08 | Backend: Tuân thủ | TC-21, TC-27 (bấm lặp);  |
| FR-16 | BIZ-03 | US-15 | UC-11 | Backend: Chỉ số | TC-34, 35 |
| FR-17 | BIZ-02 | US-16 | UC-12 | Worker: Scheduler | TC-36, 37 |
| FR-18 | BIZ-03 | US-17 | Mọi UC ghi dữ liệu | Backend: Audit | TC-38, 39 |
| FR-19 | BIZ-02 | US-04 | UC-09 | Backend: Tuân thủ; Cache | TC-09, 10 |
| FR-20 | BIZ-03 | US-05 | UC-13 | Worker: PDF; Cloud Storage | TC-11, 12 |

## Bảng 21 — API và dữ liệu

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

## Bảng 22 — Truy vết NFR

| NFR | User story | Use case | Module thiết kế | Ca kiểm thử |
| --- | --- | --- | --- | --- |
| NFR-01 | US-08, US-09 | UC-07 | Mobile App | TC-18, 20 |
| NFR-02 | US-08 | UC-10 | Worker: Notifier | TC-07, 18 |
| NFR-05 | US-13 | UC-02 | Schema CSDL | TC-30 |
| NFR-06 | US-09, US-17 | Mọi UC ghi dữ liệu | Backend: Audit; CSDL | TC-21, 39 |
| NFR-11 | US-03 | UC-10 | Rule Engine | Benchmark CI |
| NFR-03 | US-01, US-04 | UC-05, UC-09 | Backend, Cache | Kiểm thử tải theo p95 và độ trễ gợi ý |
| NFR-04 | US-13, US-14 | UC-01, UC-03 | Gateway, Auth, Thiết bị | Rà soát HTTPS, mật khẩu băm, hạn và thu hồi token |
| NFR-07 | US-03, US-08 | UC-10 | Worker, RabbitMQ | Khởi động lại Worker và kiểm tra xử lý lũy đẳng |
| NFR-08 | Mọi story có Rule Engine | UC-06, UC-10 | Rule Engine, CI | Báo cáo coverage và pipeline |
| NFR-09 | US-08, US-09 | UC-07 | Mobile App | Thử trên phiên bản Android nhóm chọn |
| NFR-10 | US-14 | UC-03 | Backend, lưu trữ token | Kiểm tra mã hóa và quản lý khóa |

Các mã TC chưa phải kết quả thực hiện kiểm thử. Dữ liệu/endpoint nêu trong bảng là thiết kế trong báo cáo; cần đối chiếu với mã local trước khi triển khai.
