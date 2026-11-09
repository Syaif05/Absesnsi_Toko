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