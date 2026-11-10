# Danh mục tài liệu đúng theo nguồn trong KTPMUD

## Tài liệu đã đóng gói

- [SRS v1.0](SRS_v1.0.md): chuyển các bảng đặc tả và ràng buộc từ báo cáo tuần 6.
- [RTM](RTM.md): giữ nguyên các bảng 20–22 trong báo cáo.
- [8 bộ ảnh và nguồn sơ đồ gốc](architecture/README.md): 8 PNG, 5 PlantUML, 3 Graphviz và thư viện C4.
- [OpenAPI gốc](api/openapi.yaml): đúng tệp người dùng thêm vào `KTPMUD/docs/api`.
- [Nguồn và cách đối chiếu](SOURCES.md), [manifest SHA-256](source-manifest.json).
- Mã ứng dụng, hướng dẫn và kiểm thử V1.0 giữ nguyên: [README](../README.md), [VERIFICATION](../VERIFICATION.md).

## Phần chưa có tệp nguồn độc lập trong bộ tài liệu gốc đã đối chiếu

Chưa có bộ DDL PostgreSQL 3NF, từ điển dữ liệu, sơ đồ UML Class/Sequence và Gateway mock độc lập do nhóm cung cấp. Không tự tạo thêm để ghi nhận là đã bàn giao. Ứng dụng local có mã khởi tạo SQLite trong `server/domain.js`; đây không phải bộ DDL PostgreSQL 3NF.

OpenAPI là đặc tả thiết kế, không phải máy chủ đang chạy. Các mã TC trong báo cáo không được gán kết quả PASS khi chưa có minh chứng tương ứng.
