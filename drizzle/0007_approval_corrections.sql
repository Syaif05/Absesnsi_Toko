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
