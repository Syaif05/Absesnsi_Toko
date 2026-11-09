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
