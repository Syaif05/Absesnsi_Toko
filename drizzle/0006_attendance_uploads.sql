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
