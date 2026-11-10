import type { SqlConnection } from '../auth/types';
// Caller locks the session. Review takes precedence; correction provenance is retained.
export async function refreshSessionStatus(c:SqlConnection,id:string) {
 await c.query(`UPDATE attendance.attendance_sessions s SET status=CASE
 WHEN EXISTS(SELECT FROM attendance.attendance_events e WHERE e.session_id=s.id AND e.review_status IN ('pending','rejected')) THEN 'needs_review'
 WHEN s.is_corrected THEN 'corrected'
 WHEN s.check_out_at IS NOT NULL THEN 'completed' ELSE 'open' END WHERE s.id=$1`,[id]);
}
