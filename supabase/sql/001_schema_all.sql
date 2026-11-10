-- GENERATED. Fresh database only. No demo data or credentials.
BEGIN;
-- SOURCE: drizzle/0000_initial_attendance.sql
CREATE SCHEMA "attendance";
--> statement-breakpoint
CREATE TABLE "attendance"."approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_approval_status" CHECK ("attendance"."approval_requests"."status" in ('pending','approved','rejected')),
	CONSTRAINT "valid_approval_decision" CHECK (("attendance"."approval_requests"."status"='pending' and "attendance"."approval_requests"."decided_at" is null and "attendance"."approval_requests"."reviewer_id" is null) or ("attendance"."approval_requests"."status"<>'pending' and "attendance"."approval_requests"."decided_at" is not null and "attendance"."approval_requests"."reviewer_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "attendance"."employee_store_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	CONSTRAINT "valid_assignment_period" CHECK ("attendance"."employee_store_assignments"."ends_at" is null or "attendance"."employee_store_assignments"."ends_at">"attendance"."employee_store_assignments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "attendance"."attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"photo_path" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"accuracy_m" double precision,
	"distance_m" double precision,
	"location_status" text NOT NULL,
	"review_status" text NOT NULL,
	"reason" text,
	"idempotency_key" uuid NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	CONSTRAINT "attendance_events_employee_id_idempotency_key_unique" UNIQUE("employee_id","idempotency_key"),
	CONSTRAINT "attendance_events_session_id_event_type_unique" UNIQUE("session_id","event_type"),
	CONSTRAINT "valid_event_type" CHECK ("attendance"."attendance_events"."event_type" in ('check_in','check_out')),
	CONSTRAINT "valid_review_status" CHECK ("attendance"."attendance_events"."review_status" in ('not_required','pending','approved','rejected')),
	CONSTRAINT "valid_gps" CHECK (("attendance"."attendance_events"."accuracy_m" is null or "attendance"."attendance_events"."accuracy_m">=0) and ("attendance"."attendance_events"."distance_m" is null or "attendance"."attendance_events"."distance_m">=0) and ("attendance"."attendance_events"."lat" is null or "attendance"."attendance_events"."lat" between -90 and 90) and ("attendance"."attendance_events"."lng" is null or "attendance"."attendance_events"."lng" between -180 and 180)),
	CONSTRAINT "valid_location_status" CHECK ("attendance"."attendance_events"."location_status" in ('inside','outside','unavailable','inaccurate','denied'))
);
--> statement-breakpoint
CREATE TABLE "attendance"."attendance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"schedule_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_session_status" CHECK ("attendance"."attendance_sessions"."status" in ('open','completed','needs_review','corrected')),
	CONSTRAINT "valid_checkout" CHECK ("attendance"."attendance_sessions"."check_out_at" is null or ("attendance"."attendance_sessions"."check_in_at" is not null and "attendance"."attendance_sessions"."check_out_at">="attendance"."attendance_sessions"."check_in_at"))
);
--> statement-breakpoint
CREATE TABLE "attendance"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata_redacted" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance"."auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "attendance"."businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_path" text,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance"."attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_request_id" uuid NOT NULL,
	"field" text NOT NULL,
	"old_value" jsonb,
	"requested_value" jsonb NOT NULL,
	"applied_value" jsonb
);
--> statement-breakpoint
CREATE TABLE "attendance"."employee_credentials" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"pin_hash" text NOT NULL,
	"must_change_pin" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nonnegative_attempts" CHECK ("attendance"."employee_credentials"."failed_attempts">=0)
);
--> statement-breakpoint
CREATE TABLE "attendance"."employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"employee_code" text NOT NULL,
	"full_name" text NOT NULL,
	"primary_store_id" uuid,
	"role" text DEFAULT 'employee' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_business_id_employee_code_unique" UNIQUE("business_id","employee_code"),
	CONSTRAINT "valid_employee_role" CHECK ("attendance"."employees"."role" in ('owner','manager','employee')),
	CONSTRAINT "valid_employee_status" CHECK ("attendance"."employees"."status" in ('active','inactive'))
);
--> statement-breakpoint
CREATE TABLE "attendance"."schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"template_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_schedule_period" CHECK ("attendance"."schedules"."ends_at">"attendance"."schedules"."starts_at"),
	CONSTRAINT "valid_schedule_status" CHECK ("attendance"."schedules"."status" in ('draft','published','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "attendance"."business_settings" (
	"business_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_business_id_key_unique" UNIQUE("business_id","key"),
	CONSTRAINT "setting_key_whitelist" CHECK ("attendance"."business_settings"."key" in ('branding','attendance_rules','retention_policy'))
);
--> statement-breakpoint
CREATE TABLE "attendance"."shift_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_local_time" text NOT NULL,
	"end_local_time" text NOT NULL,
	"crosses_midnight" boolean DEFAULT false NOT NULL,
	"grace_minutes" integer DEFAULT 5 NOT NULL,
	CONSTRAINT "valid_grace" CHECK ("attendance"."shift_templates"."grace_minutes">=0)
);
--> statement-breakpoint
CREATE TABLE "attendance"."stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_m" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_business_id_code_unique" UNIQUE("business_id","code"),
	CONSTRAINT "valid_store_location" CHECK ("attendance"."stores"."lat" between -90 and 90 and "attendance"."stores"."lng" between -180 and 180 and "attendance"."stores"."radius_m">0)
);
--> statement-breakpoint
ALTER TABLE "attendance"."approval_requests" ADD CONSTRAINT "approval_requests_requester_id_employees_id_fk" FOREIGN KEY ("requester_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."approval_requests" ADD CONSTRAINT "approval_requests_reviewer_id_employees_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."employee_store_assignments" ADD CONSTRAINT "employee_store_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."employee_store_assignments" ADD CONSTRAINT "employee_store_assignments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "attendance"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_events" ADD CONSTRAINT "attendance_events_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "attendance"."attendance_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_events" ADD CONSTRAINT "attendance_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_events" ADD CONSTRAINT "attendance_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "attendance"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "attendance"."schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_employees_id_fk" FOREIGN KEY ("actor_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."auth_sessions" ADD CONSTRAINT "auth_sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_corrections" ADD CONSTRAINT "attendance_corrections_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "attendance"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."employee_credentials" ADD CONSTRAINT "employee_credentials_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."employees" ADD CONSTRAINT "employees_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "attendance"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."employees" ADD CONSTRAINT "employees_primary_store_id_stores_id_fk" FOREIGN KEY ("primary_store_id") REFERENCES "attendance"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."schedules" ADD CONSTRAINT "schedules_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."schedules" ADD CONSTRAINT "schedules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "attendance"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."schedules" ADD CONSTRAINT "schedules_template_id_shift_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "attendance"."shift_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."schedules" ADD CONSTRAINT "schedules_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "attendance"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."business_settings" ADD CONSTRAINT "business_settings_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."shift_templates" ADD CONSTRAINT "shift_templates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "attendance"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."stores" ADD CONSTRAINT "stores_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "attendance"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_status_created_at_index" ON "attendance"."approval_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "attendance_events_review_status_recorded_at_index" ON "attendance"."attendance_events" USING btree ("review_status","recorded_at");--> statement-breakpoint
CREATE INDEX "attendance_sessions_employee_id_check_in_at_index" ON "attendance"."attendance_sessions" USING btree ("employee_id","check_in_at");--> statement-breakpoint
CREATE INDEX "schedules_employee_id_starts_at_index" ON "attendance"."schedules" USING btree ("employee_id","starts_at");
-- SOURCE: drizzle/0001_integrity_and_security.sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE attendance.schedules ADD CONSTRAINT no_published_overlap EXCLUDE USING gist (employee_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status='published');
--> statement-breakpoint
CREATE UNIQUE INDEX one_open_session ON attendance.attendance_sessions(employee_id) WHERE check_out_at IS NULL;
--> statement-breakpoint
CREATE FUNCTION attendance.protect_audit() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END $$;
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON attendance.audit_logs FOR EACH ROW EXECUTE FUNCTION attendance.protect_audit();
--> statement-breakpoint
CREATE FUNCTION attendance.guard_approval() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'Approval already decided'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER approval_final BEFORE UPDATE ON attendance.approval_requests FOR EACH ROW EXECUTE FUNCTION attendance.guard_approval();
--> statement-breakpoint
CREATE FUNCTION attendance.guard_event_owner() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM attendance.attendance_sessions s WHERE s.id=NEW.session_id AND s.employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'Event employee must own session'; END IF;
 RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER event_owner BEFORE INSERT OR UPDATE ON attendance.attendance_events FOR EACH ROW EXECUTE FUNCTION attendance.guard_event_owner();
--> statement-breakpoint
DO $$ DECLARE t text; r text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='attendance' LOOP
 EXECUTE format('ALTER TABLE attendance.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
 EXECUTE format('REVOKE ALL ON SCHEMA attendance FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA attendance FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA attendance FROM %I',r);
 END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA attendance FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA attendance FROM PUBLIC;

-- SOURCE: drizzle/0002_auth_foundation.sql
CREATE TABLE "attendance"."auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"resets_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance"."bootstrap_state" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance"."owner_credentials" (
	"employee_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance"."bootstrap_state" ADD CONSTRAINT "bootstrap_state_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "attendance"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance"."owner_credentials" ADD CONSTRAINT "owner_credentials_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE attendance.owner_credentials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE attendance.bootstrap_state ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE attendance.auth_rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX session_employee_idx ON attendance.auth_sessions(employee_id);
--> statement-breakpoint
CREATE INDEX rate_limit_expiry_idx ON attendance.auth_rate_limits(resets_at);
--> statement-breakpoint
DO $$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA attendance FROM %I',r);
 END LOOP;
END $$;

-- SOURCE: drizzle/0003_owner_management.sql
ALTER TABLE "attendance"."employees" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "attendance"."stores" ADD COLUMN "operating_hours" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX one_current_store_assignment ON attendance.employee_store_assignments(employee_id) WHERE ends_at IS NULL;

-- SOURCE: drizzle/0004_supabase_security.sql
-- Keep extension routines out of the public Data API schema.
CREATE SCHEMA IF NOT EXISTS extensions;
--> statement-breakpoint
ALTER EXTENSION btree_gist SET SCHEMA extensions;
--> statement-breakpoint
-- Supabase's event trigger must not be callable by Data API roles.
-- Its owner can still execute it when PostgreSQL fires the event trigger.
DO $$ DECLARE r text; BEGIN
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='rls_auto_enable' AND p.pronargs=0 AND p.prorettype='event_trigger'::regtype) THEN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
   EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I',r);
  END LOOP;
 END IF;
END $$;

-- SOURCE: drizzle/0005_flexible_schedules.sql
ALTER TABLE "attendance"."schedules" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance"."schedules" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance"."shift_templates" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance"."shift_templates" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance"."shift_templates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX schedule_store_start_idx ON attendance.schedules(store_id,starts_at);
--> statement-breakpoint
CREATE INDEX template_business_idx ON attendance.shift_templates(business_id);
--> statement-breakpoint
ALTER TABLE attendance.shift_templates ADD CONSTRAINT valid_template_times CHECK (start_local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND end_local_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND ((crosses_midnight AND end_local_time<=start_local_time) OR (NOT crosses_midnight AND end_local_time>start_local_time)));

-- SOURCE: drizzle/0006_attendance_uploads.sql
CREATE TABLE "attendance"."attendance_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"photo_path" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attendance_uploads_employee_id_idempotency_key_unique" UNIQUE("employee_id","idempotency_key"),
	CONSTRAINT "valid_upload_state" CHECK ("attendance"."attendance_uploads"."state" in ('pending','completed','removed'))
);
--> statement-breakpoint
ALTER TABLE "attendance"."attendance_uploads" ADD CONSTRAINT "attendance_uploads_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "attendance"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_uploads_state_expires_at_index" ON "attendance"."attendance_uploads" USING btree ("state","expires_at");--> statement-breakpoint
CREATE INDEX "attendance_uploads_employee_id_created_at_index" ON "attendance"."attendance_uploads" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "attendance_events_employee_id_recorded_at_id_index" ON "attendance"."attendance_events" USING btree ("employee_id","recorded_at","id");--> statement-breakpoint
CREATE INDEX "attendance_events_photo_path_index" ON "attendance"."attendance_events" USING btree ("photo_path");
--> statement-breakpoint
ALTER TABLE attendance.attendance_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON attendance.attendance_uploads FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON attendance.attendance_uploads FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON attendance.attendance_uploads FROM authenticated; END IF;
END $$;
--> statement-breakpoint
-- A published schedule can have only one work session; correction preserves originals.
CREATE UNIQUE INDEX one_session_per_schedule ON attendance.attendance_sessions(schedule_id) WHERE schedule_id IS NOT NULL;

-- SOURCE: drizzle/0007_approval_corrections.sql
ALTER TABLE "attendance"."approval_requests" ADD COLUMN "request_key" uuid;--> statement-breakpoint
ALTER TABLE "attendance"."approval_requests" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "attendance"."approval_requests" ADD COLUMN "context_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_sessions" ADD COLUMN "is_corrected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance"."attendance_sessions" ADD COLUMN "rule_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "approval_requests_requester_id_created_at_index" ON "attendance"."approval_requests" USING btree ("requester_id","created_at");--> statement-breakpoint
ALTER TABLE "attendance"."approval_requests" ADD CONSTRAINT "approval_requests_requester_id_request_key_unique" UNIQUE("requester_id","request_key");--> statement-breakpoint
-- Preserve historical rules also for approved missing-check-in corrections without a camera event.
UPDATE attendance.attendance_sessions s SET rule_snapshot=e.rule_snapshot || jsonb_build_object('store_id',e.store_id)
FROM attendance.attendance_events e WHERE e.session_id=s.id AND e.event_type='check_in';
--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_time_correction ON attendance.approval_requests(target_id)
WHERE type='attendance_correction' AND target_type='schedule' AND status='pending';
--> statement-breakpoint
CREATE UNIQUE INDEX one_location_review ON attendance.approval_requests(target_id)
WHERE type='location_exception' AND target_type='attendance_event';
--> statement-breakpoint
CREATE FUNCTION attendance.protect_event_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attendance evidence cannot be deleted by application'; END IF;
 IF (to_jsonb(NEW)-'review_status') IS DISTINCT FROM (to_jsonb(OLD)-'review_status') THEN RAISE EXCEPTION 'Original attendance evidence is immutable'; END IF;
 IF NEW.review_status IS DISTINCT FROM OLD.review_status AND NOT (OLD.review_status='pending' AND NEW.review_status IN ('approved','rejected')) THEN RAISE EXCEPTION 'Event review is final'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attendance_evidence_immutable BEFORE UPDATE OR DELETE ON attendance.attendance_events FOR EACH ROW EXECUTE FUNCTION attendance.protect_event_evidence();
REVOKE ALL ON FUNCTION attendance.protect_event_evidence() FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION attendance.protect_correction() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Correction history cannot be deleted by application'; END IF;
 IF (to_jsonb(NEW)-'applied_value') IS DISTINCT FROM (to_jsonb(OLD)-'applied_value') OR OLD.applied_value IS NOT NULL OR NOT EXISTS(SELECT FROM attendance.approval_requests a WHERE a.id=OLD.approval_request_id AND a.status='pending') THEN RAISE EXCEPTION 'Correction history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER correction_history_immutable BEFORE UPDATE OR DELETE ON attendance.attendance_corrections FOR EACH ROW EXECUTE FUNCTION attendance.protect_correction();
REVOKE ALL ON FUNCTION attendance.protect_correction() FROM PUBLIC;
--> statement-breakpoint
-- Pending request content cannot be rewritten while an owner reviews it.
CREATE FUNCTION attendance.protect_request_content() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Approval history cannot be deleted by application'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','reviewer_id','decision_note','decided_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reviewer_id','decision_note','decided_at']) THEN RAISE EXCEPTION 'Approval request content is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER approval_content_immutable BEFORE UPDATE OR DELETE ON attendance.approval_requests FOR EACH ROW EXECUTE FUNCTION attendance.protect_request_content();
REVOKE ALL ON FUNCTION attendance.protect_request_content() FROM PUBLIC;

-- SOURCE: drizzle/0008_monitoring_indexes.sql
CREATE INDEX "approval_requests_target_type_target_id_index" ON "attendance"."approval_requests" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "approval_requests_decided_at_id_index" ON "attendance"."approval_requests" USING btree ("decided_at","id") WHERE "attendance"."approval_requests"."decided_at" is not null;--> statement-breakpoint
CREATE INDEX "attendance_events_recorded_at_id_index" ON "attendance"."attendance_events" USING btree ("recorded_at","id");--> statement-breakpoint
CREATE INDEX "schedules_starts_at_id_index" ON "attendance"."schedules" USING btree ("starts_at","id");
-- SOURCE: drizzle/0009_hardening_integrity.sql
-- Defense in depth: UUID foreign keys must not cross business or schedule ownership.
CREATE FUNCTION attendance.guard_workforce_scope() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_TABLE_NAME IN ('stores','shift_templates') THEN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN RAISE EXCEPTION 'Business identity is immutable' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='employees' THEN
  IF TG_OP='UPDATE' AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN RAISE EXCEPTION 'Business identity is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.primary_store_id IS NOT NULL AND NOT EXISTS(SELECT FROM attendance.stores st WHERE st.id=NEW.primary_store_id AND st.business_id=NEW.business_id) THEN RAISE EXCEPTION 'Employee store business mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='employee_store_assignments' THEN
  IF NOT EXISTS(SELECT FROM attendance.employees e JOIN attendance.stores st ON st.business_id=e.business_id WHERE e.id=NEW.employee_id AND st.id=NEW.store_id) THEN RAISE EXCEPTION 'Assignment business mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='schedules' THEN
  IF NOT EXISTS(SELECT FROM attendance.employees e JOIN attendance.stores st ON st.business_id=e.business_id WHERE e.id=NEW.employee_id AND st.id=NEW.store_id AND (NEW.template_id IS NULL OR EXISTS(SELECT FROM attendance.shift_templates t WHERE t.id=NEW.template_id AND t.business_id=e.business_id))) THEN RAISE EXCEPTION 'Schedule business mismatch' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.template_id IS DISTINCT FROM OLD.template_id) AND EXISTS(SELECT FROM attendance.attendance_sessions a WHERE a.schedule_id=OLD.id) THEN RAISE EXCEPTION 'Attendance schedule identity is immutable' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='attendance_sessions' THEN
  IF NEW.schedule_id IS NOT NULL AND NOT EXISTS(SELECT FROM attendance.schedules s WHERE s.id=NEW.schedule_id AND s.employee_id=NEW.employee_id) THEN RAISE EXCEPTION 'Session schedule employee mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='attendance_events' THEN
  IF NOT EXISTS(SELECT FROM attendance.employees e JOIN attendance.stores st ON st.business_id=e.business_id JOIN attendance.attendance_sessions a ON a.employee_id=e.id LEFT JOIN attendance.schedules s ON s.id=a.schedule_id WHERE e.id=NEW.employee_id AND st.id=NEW.store_id AND a.id=NEW.session_id AND (s.id IS NULL OR s.store_id=NEW.store_id)) THEN RAISE EXCEPTION 'Event store or business mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER workforce_store_business BEFORE UPDATE OF business_id ON attendance.stores FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
CREATE TRIGGER workforce_template_business BEFORE UPDATE OF business_id ON attendance.shift_templates FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
CREATE TRIGGER workforce_employee_scope BEFORE INSERT OR UPDATE OF primary_store_id,business_id ON attendance.employees FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
CREATE TRIGGER workforce_assignment_scope BEFORE INSERT OR UPDATE ON attendance.employee_store_assignments FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
CREATE TRIGGER workforce_schedule_scope BEFORE INSERT OR UPDATE ON attendance.schedules FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
CREATE TRIGGER workforce_session_scope BEFORE INSERT OR UPDATE ON attendance.attendance_sessions FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
CREATE TRIGGER workforce_event_scope BEFORE INSERT OR UPDATE ON attendance.attendance_events FOR EACH ROW EXECUTE FUNCTION attendance.guard_workforce_scope();
REVOKE ALL ON FUNCTION attendance.guard_workforce_scope() FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('1f8f835b03ffcd95bfd7d932a4df04baf6f4c34296b7c928a060371e6ceac427',1794222816659);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('c4fbb01105a0f7a96f72e3efa2e4aa0e6686b1285d8549468a469787784f0ed1',1794222852856);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('da7df019bfc162d268a8eef65cf8480b462c4612c16fe7f6d526151411ced1a6',1794224091928);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('2edf7758c94f03a0b1970eb9e6393d714be6b54044f4dec512a17293e8c63e94',1794225072928);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('dfe99584630bb66351f727c8a5d0e46b0d1bc7dca3873234100397c9ee6f0411',1794227850191);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('d89c81281cde4d53adeb73327bc7ef1d232eb640928c79b818e199dcbe17248b',1794228837931);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('fa39cfaa1e4a86599a202f3000764ed9b247d886722c11ba536d4edf02c2e118',1794273586916);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('3d4df84857ca91524b9cecef5a10c637386a2e999e1ac50556ce35cba70bbd49',1794274154113);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('b2deec8f3a69a3c134f7eb025bcae160cad1481bb111595c80e60321d36bd8f3',1794277634891);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('d45a2ff9fe40a163c70eace69e48faa97102dc8cc75a0f2f68d2a225852441ba',1794280007212);
COMMIT;
