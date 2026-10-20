-- Synthetic seed only; not treatment advice. Run on the empty target schema.
BEGIN;
INSERT INTO caregivers VALUES ('00000000-0000-4000-8000-000000000001','demo@example.invalid','BN-TEST-CARE','DISABLED_DEMO_HASH',CURRENT_TIMESTAMP);
INSERT INTO patients(id,caregiver_id,nickname,birth_year) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','BN-TEST-001',1960);
INSERT INTO patient_slots VALUES ('00000000-0000-4000-8000-000000000002','morning','07:00'),('00000000-0000-4000-8000-000000000002','noon','12:00'),('00000000-0000-4000-8000-000000000002','evening','19:00');
INSERT INTO devices(id,patient_id,role,token_hash) VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','patient','DEMO_HASH_NOT_A_LOGIN_TOKEN');
INSERT INTO prescriptions(id,patient_id,issued_on,starts_on,ends_on,status) VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','2026-10-20','2026-10-20','2026-10-27','active');
INSERT INTO prescription_items(id,prescription_id,original_name,quantity,unit) VALUES ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000004','Thuốc mẫu giả lập — không sử dụng điều trị',1,'đơn vị thử');
INSERT INTO prescription_item_slots VALUES ('00000000-0000-4000-8000-000000000005','morning');
INSERT INTO doses VALUES ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000004','morning','2026-10-20T07:00:00+07:00','2026-10-20T09:00:00+07:00','scheduled');
INSERT INTO lab_types VALUES ('hba1c','HbA1c','%'),('fasting','Đường huyết lúc đói','mmol/L'),('postmeal','Đường huyết sau ăn','mmol/L');
INSERT INTO audit_logs(id,actor_id,actor_role,action_type,status) VALUES ('00000000-0000-4000-8000-000000000007','demo-seed','system','CREATE_SYNTHETIC_DATA','success');
COMMIT;
