-- PostgreSQL target schema. Independent of the JSON SQLite local application.
-- Run once on an EMPTY demo database. All sample values are fictional.
BEGIN;
CREATE TABLE caregivers (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, display_name varchar(50) NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE patients (
 id uuid PRIMARY KEY, caregiver_id uuid NOT NULL REFERENCES caregivers(id),
 nickname varchar(50) NOT NULL CHECK(length(trim(nickname))>0),
 birth_year smallint NOT NULL CHECK(birth_year BETWEEN 1900 AND 2100),
 missed_threshold_minutes integer NOT NULL DEFAULT 120 CHECK(missed_threshold_minutes BETWEEN 5 AND 1440),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patients_owner ON patients(caregiver_id);
CREATE TABLE patient_slots (
 patient_id uuid NOT NULL REFERENCES patients(id), slot text NOT NULL CHECK(slot IN ('morning','noon','evening')),
 reminder_time time NOT NULL, PRIMARY KEY(patient_id,slot)
);
CREATE TABLE delegates (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id), nickname varchar(50) NOT NULL,
 relationship text, active boolean NOT NULL DEFAULT true, UNIQUE(id,patient_id)
);
CREATE TABLE devices (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id),
 delegate_id uuid, role text NOT NULL CHECK(role IN ('patient','delegate')),
 token_hash text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true,
 platform text, push_token_ciphertext bytea,
 FOREIGN KEY(delegate_id,patient_id) REFERENCES delegates(id,patient_id),
 CHECK((role='patient' AND delegate_id IS NULL) OR (role='delegate' AND delegate_id IS NOT NULL)),
 UNIQUE(id,patient_id)
);
CREATE TABLE pairing_codes (
 code_hash text PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id),
 role text NOT NULL CHECK(role IN ('patient','delegate')), expires_at timestamptz NOT NULL,
 used_at timestamptz, CHECK(used_at IS NULL OR used_at<=expires_at)
);
CREATE TABLE ingredients (id uuid PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE drugs (id uuid PRIMARY KEY, name text NOT NULL, registration_number text UNIQUE, dosage_form text);
CREATE TABLE drug_ingredients (
 drug_id uuid NOT NULL REFERENCES drugs(id), ingredient_id uuid NOT NULL REFERENCES ingredients(id),
 strength text NOT NULL, PRIMARY KEY(drug_id,ingredient_id)
);
CREATE TABLE prescriptions (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id),
 issued_on date NOT NULL, starts_on date NOT NULL, ends_on date NOT NULL,
 status text NOT NULL CHECK(status IN ('draft','active','replaced','cancelled')),
 confirmed_at timestamptz, CHECK(issued_on<=starts_on AND starts_on<=ends_on),
 CHECK(ends_on-starts_on<=365), UNIQUE(id,patient_id)
);
CREATE UNIQUE INDEX one_active_prescription ON prescriptions(patient_id) WHERE status='active';
CREATE TABLE prescription_items (
 id uuid PRIMARY KEY, prescription_id uuid NOT NULL REFERENCES prescriptions(id),
 original_name text NOT NULL CHECK(length(trim(original_name))>0), drug_id uuid REFERENCES drugs(id),
 quantity numeric NOT NULL CHECK(quantity>0 AND quantity<=100), unit text NOT NULL, note text,
 UNIQUE(id,prescription_id)
);
CREATE TABLE prescription_item_slots (
 item_id uuid NOT NULL REFERENCES prescription_items(id),
 slot text NOT NULL CHECK(slot IN ('morning','noon','evening')), PRIMARY KEY(item_id,slot)
);
CREATE TABLE doses (
 id uuid PRIMARY KEY, prescription_id uuid NOT NULL REFERENCES prescriptions(id),
 slot text NOT NULL CHECK(slot IN ('morning','noon','evening')),
 scheduled_at timestamptz NOT NULL, deadline timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('scheduled','pending','taken','proxy','late','missed','cancelled')),
 CHECK(deadline>=scheduled_at), UNIQUE(prescription_id,scheduled_at,slot)
);
CREATE INDEX doses_schedule ON doses(status,scheduled_at);
CREATE TABLE dose_confirmations (
 id uuid PRIMARY KEY, dose_id uuid NOT NULL REFERENCES doses(id), actor_device_id uuid NOT NULL REFERENCES devices(id),
 actor_role text NOT NULL CHECK(actor_role IN ('patient','delegate')),
 took_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN ('taken','proxy','late')),
 corrects_id uuid REFERENCES dose_confirmations(id), reason text,
 CHECK(corrects_id IS NULL OR (reason IS NOT NULL AND length(trim(reason))>=3)),
 CHECK(corrects_id IS NULL OR corrects_id<>id), CHECK(took_at<=recorded_at)
);
CREATE UNIQUE INDEX one_initial_confirmation ON dose_confirmations(dose_id) WHERE corrects_id IS NULL;
CREATE UNIQUE INDEX one_correction_successor ON dose_confirmations(corrects_id) WHERE corrects_id IS NOT NULL;
CREATE TABLE alerts (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id),
 event_key text NOT NULL UNIQUE, type text NOT NULL CHECK(type IN ('due','missed','appointment')),
 message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE TABLE lab_types (code text PRIMARY KEY, label text NOT NULL, unit text NOT NULL);
CREATE TABLE lab_results (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id), type_code text NOT NULL REFERENCES lab_types(code),
 value numeric NOT NULL CHECK(value>0), measured_on date NOT NULL
);
CREATE TABLE appointments (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id),
 appointment_on date NOT NULL, remind_days integer NOT NULL CHECK(remind_days BETWEEN 0 AND 30),
 note text
);
CREATE TABLE reports (
 id uuid PRIMARY KEY, patient_id uuid NOT NULL REFERENCES patients(id), requested_by uuid NOT NULL REFERENCES caregivers(id),
 period_start date NOT NULL, period_end date NOT NULL,
 status text NOT NULL CHECK(status IN ('queued','ready','failed')),
 file_key text, created_at timestamptz NOT NULL DEFAULT now(), CHECK(period_end>=period_start)
);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY, occurred_at timestamptz NOT NULL DEFAULT now(),
 actor_id text NOT NULL, actor_role text NOT NULL, action_type text NOT NULL,
 status text NOT NULL CHECK(status IN ('success','failure')), object_id text, detail text
);
CREATE INDEX audit_time ON audit_logs(occurred_at);
CREATE FUNCTION forbid_record_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only record'; END; $$;
CREATE TRIGGER immutable_confirmation BEFORE UPDATE OR DELETE ON dose_confirmations FOR EACH ROW EXECUTE FUNCTION forbid_record_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_record_change();
CREATE FUNCTION validate_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p uuid; d devices%ROWTYPE; target doses%ROWTYPE; previous dose_confirmations%ROWTYPE;
BEGIN
 SELECT * INTO target FROM doses WHERE id=NEW.dose_id;
 SELECT patient_id INTO p FROM prescriptions WHERE id=target.prescription_id;
 SELECT * INTO d FROM devices WHERE id=NEW.actor_device_id;
 IF d.id IS NULL OR p IS NULL OR NOT d.active OR d.patient_id<>p OR d.role<>NEW.actor_role THEN
  RAISE EXCEPTION 'Invalid confirmation actor';
 END IF;
 IF d.role='delegate' AND NOT EXISTS(SELECT 1 FROM delegates WHERE id=d.delegate_id AND active) THEN
  RAISE EXCEPTION 'Revoked delegate';
 END IF;
 IF target.status='cancelled' OR NEW.took_at<target.scheduled_at THEN RAISE EXCEPTION 'Invalid dose time/status'; END IF;
 IF NEW.corrects_id IS NOT NULL THEN
  SELECT * INTO previous FROM dose_confirmations WHERE id=NEW.corrects_id;
  IF previous.id IS NULL OR previous.dose_id<>NEW.dose_id THEN RAISE EXCEPTION 'Invalid correction reference'; END IF;
 END IF;
 IF NEW.status<>(CASE WHEN NEW.took_at>target.deadline THEN 'late' WHEN d.role='delegate' THEN 'proxy' ELSE 'taken' END) THEN
  RAISE EXCEPTION 'Incorrect confirmation status';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER check_confirmation BEFORE INSERT ON dose_confirmations FOR EACH ROW EXECUTE FUNCTION validate_confirmation();
COMMIT;
