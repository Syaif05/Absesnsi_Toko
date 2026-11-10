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
