# Từ điển dữ liệu và chuẩn hóa 3NF

DDL mục tiêu PostgreSQL, độc lập với SQLite JSON của ứng dụng local.

## alerts

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| event_key | text | NO | — | Khóa chống trùng sự kiện |
| type | text | NO | — | Loại cảnh báo |
| message | text | NO | — | Nội dung thông báo |
| created_at | timestamp with time zone | NO | now() | Thời điểm tạo |
| read_at | timestamp with time zone | YES | — | Thời điểm đọc |

Ràng buộc:
- `NOT NULL created_at`
- `UNIQUE (event_key)`
- `NOT NULL event_key`
- `NOT NULL id`
- `NOT NULL message`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (id)`
- `CHECK ((type = ANY (ARRAY['due'::text, 'missed'::text, 'appointment'::text])))`
- `NOT NULL type`

## appointments

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| appointment_on | date | NO | — | Ngày hẹn |
| remind_days | integer | NO | — | Số ngày nhắc trước hẹn |
| note | text | YES | — | Ghi chú |

Ràng buộc:
- `NOT NULL appointment_on`
- `NOT NULL id`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (id)`
- `CHECK (((remind_days >= 0) AND (remind_days <= 30)))`
- `NOT NULL remind_days`

## audit_logs

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| occurred_at | timestamp with time zone | NO | now() | Thời điểm sự kiện |
| actor_id | text | NO | — | Định danh tác nhân; có thể là system |
| actor_role | text | NO | — | Ảnh chụp vai trò tại thời điểm xác nhận |
| action_type | text | NO | — | Loại thao tác |
| status | text | NO | — | Trạng thái; miền giá trị theo CHECK trong DDL |
| object_id | text | YES | — | Đối tượng bị tác động |
| detail | text | YES | — | Chi tiết sự kiện, không đưa định danh thật |

Ràng buộc:
- `NOT NULL action_type`
- `NOT NULL actor_id`
- `NOT NULL actor_role`
- `NOT NULL id`
- `NOT NULL occurred_at`
- `PRIMARY KEY (id)`
- `CHECK ((status = ANY (ARRAY['success'::text, 'failure'::text])))`
- `NOT NULL status`

## caregivers

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| email | text | NO | — | Email đăng nhập |
| display_name | character varying | NO | — | Tên hiển thị |
| password_hash | text | NO | — | Băm mật khẩu; không lưu mật khẩu gốc |
| created_at | timestamp with time zone | NO | now() | Thời điểm tạo |

Ràng buộc:
- `NOT NULL created_at`
- `NOT NULL display_name`
- `UNIQUE (email)`
- `NOT NULL email`
- `NOT NULL id`
- `NOT NULL password_hash`
- `PRIMARY KEY (id)`

## delegates

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| nickname | character varying | NO | — | Tên gọi giả danh trong gia đình |
| relationship | text | YES | — | Quan hệ trong gia đình |
| active | boolean | NO | true | Còn hiệu lực hay đã thu hồi |

Ràng buộc:
- `NOT NULL active`
- `NOT NULL id`
- `UNIQUE (id, patient_id)`
- `NOT NULL nickname`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (id)`

## devices

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| delegate_id | uuid | YES | — | Người được ủy quyền |
| role | text | NO | — | Vai trò thiết bị |
| token_hash | text | NO | — | Băm token xác thực, không thể khôi phục token gốc |
| active | boolean | NO | true | Còn hiệu lực hay đã thu hồi |
| platform | text | YES | — | Nền tảng thiết bị |
| push_token_ciphertext | bytea | YES | — | Token push mã hóa; quản lý khóa chưa triển khai |

Ràng buộc:
- `NOT NULL active`
- `CHECK ((((role = 'patient'::text) AND (delegate_id IS NULL)) OR ((role = 'delegate'::text) AND (delegate_id IS NOT NULL))))`
- `FOREIGN KEY (delegate_id, patient_id) REFERENCES delegates(id, patient_id)`
- `NOT NULL id`
- `UNIQUE (id, patient_id)`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (id)`
- `CHECK ((role = ANY (ARRAY['patient'::text, 'delegate'::text])))`
- `NOT NULL role`
- `UNIQUE (token_hash)`
- `NOT NULL token_hash`

## dose_confirmations

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| dose_id | uuid | NO | — | Cữ được ghi nhận |
| actor_device_id | uuid | NO | — | Thiết bị thực hiện xác nhận |
| actor_role | text | NO | — | Ảnh chụp vai trò tại thời điểm xác nhận |
| took_at | timestamp with time zone | NO | — | Thời điểm người dùng khai báo đã uống |
| recorded_at | timestamp with time zone | NO | now() | Thời điểm hệ thống nhận ghi nhận |
| status | text | NO | — | Trạng thái; miền giá trị theo CHECK trong DDL |
| corrects_id | uuid | YES | — | Bản ghi gốc được đính chính |
| reason | text | YES | — | Lý do đính chính |

Ràng buộc:
- `FOREIGN KEY (actor_device_id) REFERENCES devices(id)`
- `NOT NULL actor_device_id`
- `CHECK ((actor_role = ANY (ARRAY['patient'::text, 'delegate'::text])))`
- `NOT NULL actor_role`
- `CHECK (((corrects_id IS NULL) OR ((reason IS NOT NULL) AND (length(TRIM(BOTH FROM reason)) >= 3))))`
- `CHECK (((corrects_id IS NULL) OR (corrects_id <> id)))`
- `CHECK ((took_at <= recorded_at))`
- `FOREIGN KEY (corrects_id) REFERENCES dose_confirmations(id)`
- `FOREIGN KEY (dose_id) REFERENCES doses(id)`
- `NOT NULL dose_id`
- `NOT NULL id`
- `PRIMARY KEY (id)`
- `NOT NULL recorded_at`
- `CHECK ((status = ANY (ARRAY['taken'::text, 'proxy'::text, 'late'::text])))`
- `NOT NULL status`
- `NOT NULL took_at`

## doses

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| prescription_id | uuid | NO | — | Đơn thuốc liên quan |
| slot | text | NO | — | Buổi uống sáng/trưa/tối |
| scheduled_at | timestamp with time zone | NO | — | Thời điểm dự kiến của cữ |
| deadline | timestamp with time zone | NO | — | Hạn ghi nhận đúng giờ |
| status | text | NO | — | Trạng thái; miền giá trị theo CHECK trong DDL |

Ràng buộc:
- `CHECK ((deadline >= scheduled_at))`
- `NOT NULL deadline`
- `NOT NULL id`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)`
- `NOT NULL prescription_id`
- `UNIQUE (prescription_id, scheduled_at, slot)`
- `NOT NULL scheduled_at`
- `CHECK ((slot = ANY (ARRAY['morning'::text, 'noon'::text, 'evening'::text])))`
- `NOT NULL slot`
- `CHECK ((status = ANY (ARRAY['scheduled'::text, 'pending'::text, 'taken'::text, 'proxy'::text, 'late'::text, 'missed'::text, 'cancelled'::text])))`
- `NOT NULL status`

## drug_ingredients

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| drug_id | uuid | NO | — | Thuốc được đối chiếu danh mục |
| ingredient_id | uuid | NO | — | Hoạt chất thành phần |
| strength | text | NO | — | Hàm lượng của thành phần |

Ràng buộc:
- `FOREIGN KEY (drug_id) REFERENCES drugs(id)`
- `NOT NULL drug_id`
- `FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)`
- `NOT NULL ingredient_id`
- `PRIMARY KEY (drug_id, ingredient_id)`
- `NOT NULL strength`

## drugs

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| name | text | NO | — | Tên trong danh mục |
| registration_number | text | YES | — | Số đăng ký thuốc nếu có |
| dosage_form | text | YES | — | Dạng bào chế |

Ràng buộc:
- `NOT NULL id`
- `NOT NULL name`
- `PRIMARY KEY (id)`
- `UNIQUE (registration_number)`

## ingredients

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| name | text | NO | — | Tên trong danh mục |

Ràng buộc:
- `NOT NULL id`
- `UNIQUE (name)`
- `NOT NULL name`
- `PRIMARY KEY (id)`

## lab_results

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| type_code | text | NO | — | Loại xét nghiệm, quyết định đơn vị |
| value | numeric | NO | — | Giá trị người dùng nhập |
| measured_on | date | NO | — | Ngày xét nghiệm |

Ràng buộc:
- `NOT NULL id`
- `NOT NULL measured_on`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (type_code) REFERENCES lab_types(code)`
- `NOT NULL type_code`
- `CHECK ((value > (0)::numeric))`
- `NOT NULL value`

## lab_types

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| code | text | NO | — | Mã loại xét nghiệm |
| label | text | NO | — | Tên loại xét nghiệm |
| unit | text | NO | — | Đơn vị của thuốc hoặc chỉ số |

Ràng buộc:
- `NOT NULL code`
- `NOT NULL label`
- `PRIMARY KEY (code)`
- `NOT NULL unit`

## pairing_codes

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| code_hash | text | NO | — | Băm mã ghép một lần |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| role | text | NO | — | Vai trò thiết bị |
| expires_at | timestamp with time zone | NO | — | Hạn mã ghép |
| used_at | timestamp with time zone | YES | — | Thời điểm mã được sử dụng |

Ràng buộc:
- `CHECK (((used_at IS NULL) OR (used_at <= expires_at)))`
- `NOT NULL code_hash`
- `NOT NULL expires_at`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (code_hash)`
- `CHECK ((role = ANY (ARRAY['patient'::text, 'delegate'::text])))`
- `NOT NULL role`

## patient_slots

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| slot | text | NO | — | Buổi uống sáng/trưa/tối |
| reminder_time | time without time zone | NO | — | Giờ nhắc của hồ sơ |

Ràng buộc:
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (patient_id, slot)`
- `NOT NULL reminder_time`
- `CHECK ((slot = ANY (ARRAY['morning'::text, 'noon'::text, 'evening'::text])))`
- `NOT NULL slot`

## patients

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| caregiver_id | uuid | NO | — | Người chăm sóc sở hữu hồ sơ |
| nickname | character varying | NO | — | Tên gọi giả danh trong gia đình |
| birth_year | smallint | NO | — | Năm sinh |
| missed_threshold_minutes | integer | NO | 120 | Ngưỡng thử để xác định quá hạn |
| created_at | timestamp with time zone | NO | now() | Thời điểm tạo |

Ràng buộc:
- `CHECK (((birth_year >= 1900) AND (birth_year <= 2100)))`
- `NOT NULL birth_year`
- `FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)`
- `NOT NULL caregiver_id`
- `NOT NULL created_at`
- `NOT NULL id`
- `CHECK (((missed_threshold_minutes >= 5) AND (missed_threshold_minutes <= 1440)))`
- `NOT NULL missed_threshold_minutes`
- `CHECK ((length(TRIM(BOTH FROM nickname)) > 0))`
- `NOT NULL nickname`
- `PRIMARY KEY (id)`

## prescription_item_slots

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| item_id | uuid | NO | — | Dòng thuốc |
| slot | text | NO | — | Buổi uống sáng/trưa/tối |

Ràng buộc:
- `FOREIGN KEY (item_id) REFERENCES prescription_items(id)`
- `NOT NULL item_id`
- `PRIMARY KEY (item_id, slot)`
- `CHECK ((slot = ANY (ARRAY['morning'::text, 'noon'::text, 'evening'::text])))`
- `NOT NULL slot`

## prescription_items

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| prescription_id | uuid | NO | — | Đơn thuốc liên quan |
| original_name | text | NO | — | Tên gốc người dùng nhập, giữ nguyên khi đối chiếu danh mục |
| drug_id | uuid | YES | — | Thuốc được đối chiếu danh mục |
| quantity | numeric | NO | — | Số đơn vị mỗi lần theo dữ liệu nhập |
| unit | text | NO | — | Đơn vị của thuốc hoặc chỉ số |
| note | text | YES | — | Ghi chú |

Ràng buộc:
- `FOREIGN KEY (drug_id) REFERENCES drugs(id)`
- `NOT NULL id`
- `UNIQUE (id, prescription_id)`
- `CHECK ((length(TRIM(BOTH FROM original_name)) > 0))`
- `NOT NULL original_name`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)`
- `NOT NULL prescription_id`
- `CHECK (((quantity > (0)::numeric) AND (quantity <= (100)::numeric)))`
- `NOT NULL quantity`
- `NOT NULL unit`

## prescriptions

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| issued_on | date | NO | — | Ngày kê đơn |
| starts_on | date | NO | — | Ngày bắt đầu |
| ends_on | date | NO | — | Ngày tái khám/kết thúc |
| status | text | NO | — | Trạng thái; miền giá trị theo CHECK trong DDL |
| confirmed_at | timestamp with time zone | YES | — | Thời điểm duyệt đơn |

Ràng buộc:
- `CHECK (((issued_on <= starts_on) AND (starts_on <= ends_on)))`
- `CHECK (((ends_on - starts_on) <= 365))`
- `NOT NULL ends_on`
- `NOT NULL id`
- `UNIQUE (id, patient_id)`
- `NOT NULL issued_on`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `PRIMARY KEY (id)`
- `NOT NULL starts_on`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'replaced'::text, 'cancelled'::text])))`
- `NOT NULL status`

## reports

| Trường | Kiểu | Cho phép NULL | Mặc định | Ý nghĩa |
| --- | --- | --- | --- | --- |
| id | uuid | NO | — | Mã định danh bản ghi |
| patient_id | uuid | NO | — | Hồ sơ được tham chiếu |
| requested_by | uuid | NO | — | Người yêu cầu báo cáo |
| period_start | date | NO | — | Đầu kỳ báo cáo |
| period_end | date | NO | — | Cuối kỳ báo cáo |
| status | text | NO | — | Trạng thái; miền giá trị theo CHECK trong DDL |
| file_key | text | YES | — | Khóa tệp riêng tư, không phải đường dẫn công khai |
| created_at | timestamp with time zone | NO | now() | Thời điểm tạo |

Ràng buộc:
- `CHECK ((period_end >= period_start))`
- `NOT NULL created_at`
- `NOT NULL id`
- `FOREIGN KEY (patient_id) REFERENCES patients(id)`
- `NOT NULL patient_id`
- `NOT NULL period_end`
- `NOT NULL period_start`
- `PRIMARY KEY (id)`
- `FOREIGN KEY (requested_by) REFERENCES caregivers(id)`
- `NOT NULL requested_by`
- `CHECK ((status = ANY (ARRAY['queued'::text, 'ready'::text, 'failed'::text])))`
- `NOT NULL status`

## Chỉ mục

- `CREATE UNIQUE INDEX alerts_event_key_key ON public.alerts USING btree (event_key)`
- `CREATE UNIQUE INDEX alerts_pkey ON public.alerts USING btree (id)`
- `CREATE UNIQUE INDEX appointments_pkey ON public.appointments USING btree (id)`
- `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)`
- `CREATE INDEX audit_time ON public.audit_logs USING btree (occurred_at)`
- `CREATE UNIQUE INDEX caregivers_email_key ON public.caregivers USING btree (email)`
- `CREATE UNIQUE INDEX caregivers_pkey ON public.caregivers USING btree (id)`
- `CREATE UNIQUE INDEX delegates_id_patient_id_key ON public.delegates USING btree (id, patient_id)`
- `CREATE UNIQUE INDEX delegates_pkey ON public.delegates USING btree (id)`
- `CREATE UNIQUE INDEX devices_id_patient_id_key ON public.devices USING btree (id, patient_id)`
- `CREATE UNIQUE INDEX devices_pkey ON public.devices USING btree (id)`
- `CREATE UNIQUE INDEX devices_token_hash_key ON public.devices USING btree (token_hash)`
- `CREATE UNIQUE INDEX dose_confirmations_pkey ON public.dose_confirmations USING btree (id)`
- `CREATE UNIQUE INDEX one_correction_successor ON public.dose_confirmations USING btree (corrects_id) WHERE (corrects_id IS NOT NULL)`
- `CREATE UNIQUE INDEX one_initial_confirmation ON public.dose_confirmations USING btree (dose_id) WHERE (corrects_id IS NULL)`
- `CREATE UNIQUE INDEX doses_pkey ON public.doses USING btree (id)`
- `CREATE UNIQUE INDEX doses_prescription_id_scheduled_at_slot_key ON public.doses USING btree (prescription_id, scheduled_at, slot)`
- `CREATE INDEX doses_schedule ON public.doses USING btree (status, scheduled_at)`
- `CREATE UNIQUE INDEX drug_ingredients_pkey ON public.drug_ingredients USING btree (drug_id, ingredient_id)`
- `CREATE UNIQUE INDEX drugs_pkey ON public.drugs USING btree (id)`
- `CREATE UNIQUE INDEX drugs_registration_number_key ON public.drugs USING btree (registration_number)`
- `CREATE UNIQUE INDEX ingredients_name_key ON public.ingredients USING btree (name)`
- `CREATE UNIQUE INDEX ingredients_pkey ON public.ingredients USING btree (id)`
- `CREATE UNIQUE INDEX lab_results_pkey ON public.lab_results USING btree (id)`
- `CREATE UNIQUE INDEX lab_types_pkey ON public.lab_types USING btree (code)`
- `CREATE UNIQUE INDEX pairing_codes_pkey ON public.pairing_codes USING btree (code_hash)`
- `CREATE UNIQUE INDEX patient_slots_pkey ON public.patient_slots USING btree (patient_id, slot)`
- `CREATE INDEX patients_owner ON public.patients USING btree (caregiver_id)`
- `CREATE UNIQUE INDEX patients_pkey ON public.patients USING btree (id)`
- `CREATE UNIQUE INDEX prescription_item_slots_pkey ON public.prescription_item_slots USING btree (item_id, slot)`
- `CREATE UNIQUE INDEX prescription_items_id_prescription_id_key ON public.prescription_items USING btree (id, prescription_id)`
- `CREATE UNIQUE INDEX prescription_items_pkey ON public.prescription_items USING btree (id)`
- `CREATE UNIQUE INDEX one_active_prescription ON public.prescriptions USING btree (patient_id) WHERE (status = 'active'::text)`
- `CREATE UNIQUE INDEX prescriptions_id_patient_id_key ON public.prescriptions USING btree (id, patient_id)`
- `CREATE UNIQUE INDEX prescriptions_pkey ON public.prescriptions USING btree (id)`
- `CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id)`

## Giải thích 3NF và giới hạn

- Mỗi bảng mô tả một loại thực thể hoặc quan hệ; khóa xác định các thuộc tính của hàng. Quan hệ nhiều-nhiều thuốc/hoạt chất và dòng thuốc/buổi được tách bảng.
- Tên hoạt chất lưu ở ingredients; hàm lượng thuộc quan hệ drug_ingredients. Đơn vị xét nghiệm thuộc lab_types, không lặp trong lab_results. Thông tin bệnh nhân không lặp trong doses: tra qua prescriptions.
- Các bảng có khóa ghép (patient_slots, prescription_item_slots, drug_ingredients) không chứa thuộc tính chỉ phụ thuộc một phần khóa.
- actor_role và các mốc thời gian của cữ/xác nhận là ảnh chụp lịch sử phục vụ audit; không tự thay đổi theo cấu hình hiện tại. Đây là lựa chọn bảo toàn lịch sử cần nhóm review khi triển khai.
- Xác nhận/audit có trigger cấm UPDATE/DELETE; xác nhận đầu tiên và mỗi nhánh đính chính có chỉ mục duy nhất. Trigger kiểm tra vai trò, hồ sơ, thu hồi quyền và mốc cữ.
- DDL chưa tự thực hiện nghiệp vụ thay đơn, sinh lịch hoặc kiểm tra quyền người chăm sóc: backend phải làm trong giao dịch. Scheduler/outbox/queue của kiến trúc mục tiêu chưa được cài đặt trong gói này.
- Token phiên lưu băm; push_token_ciphertext chỉ dành cho thiết kế sau này. Không tuyên bố NFR-10 AES-256 đã đạt.
- Seed dùng mã giả lập và tài khoản bị vô hiệu đăng nhập. Không có dữ liệu người bệnh thật.
