# Sơ đồ kiến trúc và nghiệp vụ

Mỗi sơ đồ có nguồn PlantUML (`.puml`), ảnh SVG có thể phóng to và PNG. Các sơ đồ mục tiêu không phải cấu trúc đã triển khai đầy đủ. Xem [Gap Matrix](../GAP_MATRIX.md).

- **activity-confirmation**: [Nguồn](activity-confirmation.puml) · [SVG](activity-confirmation.svg) · [PNG](activity-confirmation.png)
- **activity-prescription**: [Nguồn](activity-prescription.puml) · [SVG](activity-prescription.svg) · [PNG](activity-prescription.png)
- **c4-container**: [Nguồn](c4-container.puml) · [SVG](c4-container.svg) · [PNG](c4-container.png)
- **c4-context**: [Nguồn](c4-context.puml) · [SVG](c4-context.svg) · [PNG](c4-context.png)
- **class-domain**: [Nguồn](class-domain.puml) · [SVG](class-domain.svg) · [PNG](class-domain.png)
- **dfd-context**: [Nguồn](dfd-context.puml) · [SVG](dfd-context.svg) · [PNG](dfd-context.png)
- **dfd-level1**: [Nguồn](dfd-level1.puml) · [SVG](dfd-level1.svg) · [PNG](dfd-level1.png)
- **erd**: [Nguồn](erd.puml) · [SVG](erd.svg) · [PNG](erd.png)
- **sequence-confirmation**: [Nguồn](sequence-confirmation.puml) · [SVG](sequence-confirmation.svg) · [PNG](sequence-confirmation.png)
- **sequence-prescription**: [Nguồn](sequence-prescription.puml) · [SVG](sequence-prescription.svg) · [PNG](sequence-prescription.png)
- **sequence-reminder**: [Nguồn](sequence-reminder.puml) · [SVG](sequence-reminder.svg) · [PNG](sequence-reminder.png)
- **uc-caregiver**: [Nguồn](uc-caregiver.puml) · [SVG](uc-caregiver.svg) · [PNG](uc-caregiver.png)
- **uc-delegate**: [Nguồn](uc-delegate.puml) · [SVG](uc-delegate.svg) · [PNG](uc-delegate.png)
- **uc-patient**: [Nguồn](uc-patient.puml) · [SVG](uc-patient.svg) · [PNG](uc-patient.png)
- **ui-flow**: [Nguồn](ui-flow.puml) · [SVG](ui-flow.svg) · [PNG](ui-flow.png)
- **use-cases**: [Nguồn](use-cases.puml) · [SVG](use-cases.svg) · [PNG](use-cases.png)

## Chỉnh sửa và xuất lại
Dùng PlantUML 1.2025.2 và Java; mở `.puml` trong trình soạn thảo hỗ trợ PlantUML hoặc chạy:

```sh
java -jar plantuml.jar -charset UTF-8 -tsvg "docs/architecture/*.puml"
java -jar plantuml.jar -charset UTF-8 -tpng "docs/architecture/*.puml"
```

Không cần gửi tài liệu lên máy chủ dựng sơ đồ bên ngoài. Gói không chứa JAR và không cần JAR để chạy ứng dụng/CI. ERD lấy từ chính schema.sql; ký hiệu cardinality tổng quát, tính bắt buộc/null xem từ điển dữ liệu và FK. Các sơ đồ sequence dùng nghiệp vụ mục tiêu; outbox/worker/push cần triển khai tiếp, chưa nằm trong DDL vận hành local.
