# Nguồn tài liệu của bản hiện tại

Ngày đối chiếu: 20/10/2026. Chỉ dùng tài liệu và mã có sẵn trong thư mục `KTPMUD` làm nội dung nguồn.

| Nội dung trên GitHub | Nguồn trong KTPMUD | Cách xử lý |
| --- | --- | --- |
| `docs/architecture/` (ảnh, `.puml`, `.dot`, `lib/`) | `KTPMUD/docs/architecture/` | Sao chép nguyên byte |
| `docs/api/openapi.yaml` | `KTPMUD/docs/api/openapi.yaml` | Sao chép nguyên byte, không dùng bản API tự tạo |
| `docs/SRS_v1.0.md` | `KTPMUD/output/N01-01_Phùng Tuấn Tài_20_Trần Đức Trí_65_Trần Nguyễn Phúc Bình_Tuần 6.docx` | Chuyển các bảng đặc tả và 7 BR sang Markdown, không thêm yêu cầu |
| `docs/RTM.md` | Bảng 20–22 trong cùng báo cáo tuần 6 | Chuyển nguyên bảng sang Markdown |
| Mã ứng dụng, package và test ban đầu | `KTPMUD/antam-v1`, commit `bde568e` | Giữ nguyên bản V1.0 trước đợt đóng gói |

[Manifest nguồn](source-manifest.json) ghi đường dẫn và SHA-256 để kiểm tra. Các README/mục lục và ghi chú nguồn là phần trình bày của gói tài liệu; không phải nội dung đặc tả mới.

## Những phần đã gỡ khỏi bản hiện tại

Các sơ đồ bổ sung tự biên soạn, DDL/seed/từ điển dữ liệu tự tạo, Gateway mock, OpenAPI tự tạo, kịch bản Gherkin mới, chi tiết UC bổ sung, pipeline CI và báo cáo/log kiểm chứng gói tự tạo đã được gỡ. Các tệp package và test API được trả về bản V1.0. Không còn dùng các phần đó làm bằng chứng hoàn thành đồ án.

Lịch sử commit vẫn được giữ; nội dung ở nhánh hiện tại mới là bộ đã hiệu chỉnh. Không suy ra yêu cầu trong báo cáo đã đạt chỉ vì đã được chuyển sang Markdown.
