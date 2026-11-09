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
