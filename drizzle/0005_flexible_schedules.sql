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
