ALTER TABLE "attendance"."employees" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "attendance"."stores" ADD COLUMN "operating_hours" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX one_current_store_assignment ON attendance.employee_store_assignments(employee_id) WHERE ends_at IS NULL;
