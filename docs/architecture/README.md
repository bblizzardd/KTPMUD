# Sơ đồ kiến trúc và nghiệp vụ

Nguồn chính: thư mục `KTPMUD/docs/architecture` do người dùng bổ sung ngày 20/10/2026. Giữ nguyên 8 ảnh PNG, 5 nguồn PlantUML, 3 nguồn Graphviz và 3 tệp thư viện C4 theo từng byte. SVG được xuất thêm từ đúng nguồn đó; bố cục/font có thể khác PNG gốc do môi trường render.

## Sơ đồ gốc của nhóm

| Sơ đồ | Ảnh gốc | Nguồn chỉnh sửa | SVG xuất từ nguồn |
| --- | --- | --- | --- |
| Phân cấp chức năng | [PNG](BPC.png) | [bpc.puml](bpc.puml) | [SVG](BPC.svg) |
| C4 C1 — System Context | [PNG](C1_System_Context.png) | [c1_context.puml](c1_context.puml) | [SVG](C1_System_Context.svg) |
| C4 C2 — Container | [PNG](C2_Container.png) | [c2_container.puml](c2_container.puml) | [SVG](C2_Container.svg) |
| DFD mức 0 | [PNG](DFD_Muc0.png) | [dfd0.dot](dfd0.dot) | [SVG](DFD_Muc0.svg) |
| DFD mức 1 | [PNG](DFD_Muc1.png) | [dfd1.dot](dfd1.dot) | [SVG](DFD_Muc1.svg) |
| Use Case tổng quát | [PNG](Use_Case.png) | [usecase.dot](usecase.dot) | [SVG](Use_Case.svg) |
| Trạng thái cữ thuốc | [PNG](State_Cu_Thuoc.png) | [state_cu_thuoc.puml](state_cu_thuoc.puml) | [SVG](State_Cu_Thuoc.svg) |
| Trạng thái đơn thuốc | [PNG](State_Don_Thuoc.png) | [state_don_thuoc.puml](state_don_thuoc.puml) | [SVG](State_Don_Thuoc.svg) |

## Sơ đồ bổ sung theo yêu cầu review

Thư mục gốc chưa có các sơ đồ dưới đây. Giữ lại để phục vụ thiết kế và review; không ghi nhận chúng là ảnh do nhóm cung cấp.

- **activity-confirmation**: [Nguồn](activity-confirmation.puml) · [SVG](activity-confirmation.svg) · [PNG](activity-confirmation.png)
- **activity-prescription**: [Nguồn](activity-prescription.puml) · [SVG](activity-prescription.svg) · [PNG](activity-prescription.png)
- **class-domain**: [Nguồn](class-domain.puml) · [SVG](class-domain.svg) · [PNG](class-domain.png)
- **erd**: [Nguồn](erd.puml) · [SVG](erd.svg) · [PNG](erd.png)
- **sequence-confirmation**: [Nguồn](sequence-confirmation.puml) · [SVG](sequence-confirmation.svg) · [PNG](sequence-confirmation.png)
- **sequence-prescription**: [Nguồn](sequence-prescription.puml) · [SVG](sequence-prescription.svg) · [PNG](sequence-prescription.png)
- **sequence-reminder**: [Nguồn](sequence-reminder.puml) · [SVG](sequence-reminder.svg) · [PNG](sequence-reminder.png)
- **uc-caregiver**: [Nguồn](uc-caregiver.puml) · [SVG](uc-caregiver.svg) · [PNG](uc-caregiver.png)
- **uc-delegate**: [Nguồn](uc-delegate.puml) · [SVG](uc-delegate.svg) · [PNG](uc-delegate.png)
- **uc-patient**: [Nguồn](uc-patient.puml) · [SVG](uc-patient.svg) · [PNG](uc-patient.png)
- **ui-flow**: [Nguồn](ui-flow.puml) · [SVG](ui-flow.svg) · [PNG](ui-flow.png)

## Điểm cần đối chiếu với đặc tả và mã hiện có

- `state_cu_thuoc.puml` còn ghi chú chưa chốt cách xử lý xác nhận muộn. FR-14 và bản local hiện đã tách trạng thái muộn. Giữ nguyên sơ đồ gốc; ghi nhận khác biệt này để nhóm thống nhất khi sửa tài liệu.
- `state_don_thuoc.puml` có trạng thái Hết hạn. DDL mục tiêu và mã local hiện chưa có trạng thái expired riêng; đơn ngừng sinh cữ theo ngày kết thúc nhưng trạng thái chưa tự đổi sang expired.
- C2 mô tả kiến trúc mục tiêu, gồm AI, PostgreSQL, Redis, RabbitMQ và dịch vụ ngoài. Đây không phải các thành phần đã triển khai đầy đủ trong bản local.
- Các sơ đồ DFD và Use Case dùng `.dot` (Graphviz), không phải `.puml`. Không đổi đuôi tệp để tránh làm sai định dạng nguồn.

## Chỉnh sửa và xuất lại

Nguồn C4 dùng thư viện trong `lib/`. Truyền `-DRELATIVE_INCLUDE=relative` để dùng thư viện local thay vì tải trên mạng. Ví dụ xuất SVG vào thư mục riêng (không ghi đè PNG gốc):

```sh
java -jar plantuml.jar -DRELATIVE_INCLUDE=relative -charset UTF-8 -tsvg -o rendered "docs/architecture/*.puml"
dot -Tsvg docs/architecture/dfd0.dot -o docs/architecture/rendered/DFD_Muc0.svg
dot -Tsvg docs/architecture/dfd1.dot -o docs/architecture/rendered/DFD_Muc1.svg
dot -Tsvg docs/architecture/usecase.dot -o docs/architecture/rendered/Use_Case.svg
```

Tạo thư mục `rendered` trước khi chạy Graphviz. PlantUML lấy tên đầu ra từ `@startuml`/`@startwbs`, vì vậy tên ảnh có thể khác tên tệp nguồn. Kiểm tra [catalog.json](catalog.json) để biết ánh xạ chính xác và SHA-256 của từng tệp gốc. Không cần cài các công cụ render để chạy ứng dụng/CI.

Bộ hiện tại có **19 sơ đồ**: 8 sơ đồ từ nhóm và 11 sơ đồ bổ sung, tổng cộng 16 nguồn `.puml` và 3 nguồn `.dot` (không tính thư viện C4). [Gap Matrix](../GAP_MATRIX.md) ghi rõ phần thiết kế chưa triển khai.
