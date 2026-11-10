// One row per schedule/session before aggregation. Never aggregate a raw events join.
// Parameters: business, range start/end, store?, employee?, server clock.
export const reportCte=`WITH scoped AS (
 SELECT s.id AS schedule_id,s.employee_id,e.employee_code,e.full_name AS employee_name,e.status='active' AS employee_active,
 s.store_id,st.name AS store_name,st.is_active AS store_active,s.status AS schedule_status,
 COALESCE((a.rule_snapshot->>'schedule_starts_at')::timestamptz,s.starts_at) AS starts_at,
 COALESCE((a.rule_snapshot->>'schedule_ends_at')::timestamptz,s.ends_at) AS ends_at,
 a.id AS session_id,a.check_in_at,a.check_out_at,a.status AS session_status,COALESCE(a.is_corrected,false) AS is_corrected,
 COALESCE((a.rule_snapshot->>'schedule_starts_at')::timestamptz,s.starts_at) AS rule_start,
 COALESCE((a.rule_snapshot->>'schedule_ends_at')::timestamptz,s.ends_at) AS rule_end,
 COALESCE((a.rule_snapshot->>'grace_minutes')::numeric,(s.rule_snapshot->>'grace_minutes')::numeric,0) AS grace,
 COALESCE(ev.pending,false) AS has_pending,COALESCE(ev.rejected,false) AS has_rejected
 FROM attendance.schedules s JOIN attendance.employees e ON e.id=s.employee_id AND e.business_id=$1
 JOIN attendance.stores st ON st.id=s.store_id AND st.business_id=$1
 LEFT JOIN attendance.attendance_sessions a ON a.schedule_id=s.id AND a.employee_id=e.id
 LEFT JOIN LATERAL (SELECT bool_or(review_status='pending') AS pending,bool_or(review_status='rejected') AS rejected FROM attendance.attendance_events WHERE session_id=a.id) ev ON true
 WHERE COALESCE((a.rule_snapshot->>'schedule_starts_at')::timestamptz,s.starts_at) >= $2::timestamptz
 AND COALESCE((a.rule_snapshot->>'schedule_starts_at')::timestamptz,s.starts_at) < $3::timestamptz
 AND ($4::uuid IS NULL OR s.store_id=$4) AND ($5::uuid IS NULL OR s.employee_id=$5)
 AND (s.status='published' OR a.id IS NOT NULL)
), report_rows AS MATERIALIZED (
 SELECT *,CASE WHEN has_rejected THEN 'rejected' WHEN has_pending THEN 'pending' WHEN check_in_at IS NOT NULL THEN 'valid'
 WHEN starts_at>$6::timestamptz THEN 'upcoming' ELSE 'not_recorded' END AS category,
 COALESCE(check_in_at>rule_start+grace*interval '1 minute',false) AS late,
 (check_in_at IS NOT NULL AND check_out_at IS NULL AND rule_end<=$6::timestamptz) AS missing_checkout
 FROM scoped
)`;
export const aggregateColumns=`count(*)::int AS total,
 count(*) FILTER(WHERE category IN ('valid','pending','rejected'))::int AS recorded,
 count(*) FILTER(WHERE category='valid')::int AS valid,
 count(*) FILTER(WHERE category='pending')::int AS pending,
 count(*) FILTER(WHERE category='rejected')::int AS rejected,
 count(*) FILTER(WHERE category='not_recorded')::int AS not_recorded,
 count(*) FILTER(WHERE category='upcoming')::int AS upcoming,
 count(DISTINCT employee_id)::int AS employees,
 count(*) FILTER(WHERE late)::int AS late,
 count(*) FILTER(WHERE missing_checkout)::int AS missing_checkout`;
