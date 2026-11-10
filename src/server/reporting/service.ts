import { z } from 'zod';
import type { AuthService } from '../auth/service';
import { AuthError,type Identity,type SqlConnection } from '../auth/types';
import { rangeInstants } from '../schedules/time';
import { localParts,dayAfter } from '@/lib/schedule-dates';
import { filtersSchema,pageSchema,historySchema,type ReportFilters } from './validation';
import { reportCte,aggregateColumns } from './query';
import type { Metrics,ReportSummary,AttendanceRow,StoreReport,Activity,SessionDetail,EmployeeReport } from './models';
import type { Page } from '../owner/models';
type Row=Record<string,unknown>;
const iso=(v:unknown):string|null=>v==null?null:v instanceof Date?v.toISOString():new Date(String(v)).toISOString();
const notFound=()=>new AuthError('NOT_FOUND',404,'Data tidak ditemukan pada usaha Anda.');
function metrics(r:Row={}):Metrics {
 const n=(key:string)=>Number(r[key]??0);
 return {total:n('total'),recorded:n('recorded'),valid:n('valid'),pending:n('pending'),rejected:n('rejected'),notRecorded:n('not_recorded'),upcoming:n('upcoming'),employees:n('employees'),late:n('late'),missingCheckout:n('missing_checkout')};
}
function attendance(r:Row):AttendanceRow {
 return {scheduleId:String(r.schedule_id),sessionId:r.session_id==null?null:String(r.session_id),employeeId:String(r.employee_id),employeeCode:String(r.employee_code),employeeName:String(r.employee_name),employeeActive:!!r.employee_active,storeId:String(r.store_id),storeName:String(r.store_name),storeActive:!!r.store_active,scheduleStatus:String(r.schedule_status),startsAt:iso(r.starts_at)!,endsAt:iso(r.ends_at)!,checkInAt:iso(r.check_in_at),checkOutAt:iso(r.check_out_at),category:r.category as AttendanceRow['category'],sessionStatus:r.session_status==null?null:String(r.session_status),isCorrected:!!r.is_corrected,late:!!r.late,missingCheckout:!!r.missing_checkout};
}
function page<T>(rows:T[],offset:number):Page<T>{return {items:rows.slice(0,20),hasMore:rows.length>20,nextOffset:offset+20}}
type Context={businessName:string;timezone:string;now:string;scope:ReportSummary['scope'];params:unknown[]};
export class ReportingService {
 constructor(private auth:AuthService){}
 async context(token:string){
  return this.auth.withOwner(token,async(c,actor)=>{
   const row=(await c.query('SELECT name,timezone,clock_timestamp() AS time FROM attendance.businesses WHERE id=$1',[actor.businessId])).rows[0];
   const now=iso(row.time)!;
   return {businessName:String(row.name),timezone:String(row.timezone),today:localParts(now,String(row.timezone)).date};
  });
 }
 private async prepare(c:SqlConnection,actor:Identity,input:ReportFilters):Promise<Context>{
  await c.query("SET LOCAL statement_timeout='8s'");
  const business=(await c.query('SELECT name,timezone,clock_timestamp() AS time FROM attendance.businesses WHERE id=$1',[actor.businessId])).rows[0];
  const store=input.storeId?(await c.query('SELECT id,name FROM attendance.stores WHERE id=$1 AND business_id=$2',[input.storeId,actor.businessId])).rows[0]:null;
  const employee=input.employeeId?(await c.query('SELECT id,full_name FROM attendance.employees WHERE id=$1 AND business_id=$2',[input.employeeId,actor.businessId])).rows[0]:null;
  if(input.storeId&&!store||input.employeeId&&!employee)throw notFound();
  const timezone=String(business.timezone),range=rangeInstants(input.from,input.to,timezone),now=iso(business.time)!;
  return {businessName:String(business.name),timezone,now,scope:{storeId:input.storeId??null,storeName:store?String(store.name):null,employeeId:input.employeeId??null,employeeName:employee?String(employee.full_name):null},params:[actor.businessId,range.start,range.end,input.storeId??null,input.employeeId??null,now]};
 }
 private async summarize(c:SqlConnection,input:ReportFilters,context:Context):Promise<ReportSummary>{
  const result=(await c.query(reportCte+` SELECT
   (SELECT to_jsonb(t) FROM (SELECT ${aggregateColumns} FROM report_rows) t) AS totals,
   COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.date) FROM (SELECT (starts_at AT TIME ZONE $7::text)::date::text AS date,${aggregateColumns} FROM report_rows GROUP BY (starts_at AT TIME ZONE $7::text)::date) d),'[]'::jsonb) AS daily,
   (SELECT count(*)::int FROM attendance.approval_requests ar WHERE ar.status='pending' AND EXISTS(SELECT FROM report_rows rr WHERE rr.employee_id=ar.requester_id AND ((ar.target_type='schedule' AND ar.target_id=rr.schedule_id) OR (ar.target_type='attendance_event' AND EXISTS(SELECT FROM attendance.attendance_events ev WHERE ev.id=ar.target_id AND ev.session_id=rr.session_id))))) AS pending_requests`,[...context.params,context.timezone])).rows[0];
  const byDate=new Map((result.daily as Row[]).map(r=>[String(r.date),metrics(r)])),daily:ReportSummary['daily']=[];
  for(let date=input.from;date<input.to;date=dayAfter(date,1))daily.push({date,...(byDate.get(date)??metrics())});
  return {businessName:context.businessName,timezone:context.timezone,from:input.from,to:input.to,generatedAt:context.now,scope:context.scope,metrics:metrics(result.totals as Row),pendingRequests:Number(result.pending_requests),daily};
 }
 async summary(token:string,raw:unknown){
  const input=filtersSchema.parse(raw);
  return this.auth.withOwner(token,async(c,actor)=>this.summarize(c,input,await this.prepare(c,actor,input)));
 }
 async stores(token:string,raw:unknown):Promise<Page<StoreReport>>{
  const input=pageSchema.parse(raw);
  return this.auth.withOwner(token,async(c,actor)=>{
   const context=await this.prepare(c,actor,input);
   const rows=(await c.query(reportCte+` SELECT st.id,st.name,st.is_active,
    (SELECT to_jsonb(m) FROM (SELECT ${aggregateColumns} FROM report_rows WHERE store_id=st.id) m) AS metrics
    FROM attendance.stores st WHERE st.business_id=$1 AND ($4::uuid IS NULL OR st.id=$4)
    ORDER BY st.is_active DESC,st.name,st.id LIMIT 21 OFFSET $7`,[...context.params,input.offset])).rows;
   return page(rows.map(r=>({id:String(r.id),name:String(r.name),isActive:!!r.is_active,metrics:metrics(r.metrics as Row)})),input.offset);
  });
 }
 private async historyRows(c:SqlConnection,context:Context,offset:number,category:string):Promise<Page<AttendanceRow>> {
  const rows=(await c.query(reportCte+` SELECT * FROM report_rows WHERE ($7='all' OR category=$7) ORDER BY starts_at DESC,schedule_id DESC LIMIT 21 OFFSET $8`,[...context.params,category,offset])).rows;
  return page(rows.map(attendance),offset);
 }
 async history(token:string,raw:unknown){
  const input=historySchema.parse(raw);
  return this.auth.withOwner(token,async(c,actor)=>this.historyRows(c,await this.prepare(c,actor,input),input.offset,input.category));
 }
 async employee(token:string,id:string,raw:unknown):Promise<EmployeeReport>{
  z.uuid().parse(id);const input=historySchema.omit({employeeId:true}).parse(raw);
  return this.auth.withOwner(token,async(c,actor)=>{
   const row=(await c.query('SELECT id,employee_code,full_name,status FROM attendance.employees WHERE id=$1 AND business_id=$2',[id,actor.businessId])).rows[0];if(!row)throw notFound();
   const filter={...input,employeeId:id},context=await this.prepare(c,actor,filter);
   return {employee:{id,code:String(row.employee_code),name:String(row.full_name),active:row.status==='active'},summary:await this.summarize(c,filter,context),history:await this.historyRows(c,context,input.offset,input.category)};
  });
 }
 async activity(token:string,raw:unknown):Promise<Page<Activity>>{
  const input=pageSchema.parse(raw);
  return this.auth.withOwner(token,async(c,actor)=>{
   const context=await this.prepare(c,actor,input);
   const rows=(await c.query(`WITH scoped_requests AS (
    SELECT ar.*,s.id AS schedule_id,se.id AS session_id,em.full_name AS employee_name,st.name AS store_name
    FROM attendance.approval_requests ar JOIN attendance.employees em ON em.id=ar.requester_id AND em.business_id=$1
    LEFT JOIN attendance.attendance_events ev ON ar.target_type='attendance_event' AND ev.id=ar.target_id AND ev.employee_id=em.id
    LEFT JOIN attendance.attendance_sessions es ON es.id=ev.session_id
    JOIN attendance.schedules s ON s.id=CASE WHEN ar.target_type='schedule' THEN ar.target_id ELSE es.schedule_id END AND s.employee_id=em.id
    JOIN attendance.stores st ON st.id=s.store_id AND st.business_id=$1
    LEFT JOIN attendance.attendance_sessions se ON se.schedule_id=s.id
    WHERE ($4::uuid IS NULL OR s.store_id=$4) AND ($5::uuid IS NULL OR em.id=$5)
    AND ((ar.created_at >= $2::timestamptz AND ar.created_at < $3::timestamptz) OR (ar.decided_at >= $2::timestamptz AND ar.decided_at < $3::timestamptz))
   ), feed AS (
    SELECT 'event:'||ev.id::text AS id,ev.event_type AS kind,ev.recorded_at AS at,ev.employee_id,em.full_name AS employee_name,st.name AS store_name,s.id AS schedule_id,a.id AS session_id,NULL::uuid AS approval_id,ev.review_status,NULL::text AS request_type
    FROM attendance.attendance_events ev JOIN attendance.attendance_sessions a ON a.id=ev.session_id AND a.employee_id=ev.employee_id
    JOIN attendance.employees em ON em.id=ev.employee_id AND em.business_id=$1 JOIN attendance.schedules s ON s.id=a.schedule_id AND s.employee_id=em.id JOIN attendance.stores st ON st.id=ev.store_id AND st.business_id=$1
    WHERE ev.recorded_at >= $2::timestamptz AND ev.recorded_at < $3::timestamptz AND ($4::uuid IS NULL OR s.store_id=$4) AND ($5::uuid IS NULL OR em.id=$5)
    UNION ALL SELECT 'request:'||id::text,'approval_submitted',created_at,requester_id,employee_name,store_name,schedule_id,session_id,id,status,type FROM scoped_requests WHERE created_at >= $2::timestamptz AND created_at < $3::timestamptz
    UNION ALL SELECT 'decision:'||id::text,status,decided_at,requester_id,employee_name,store_name,schedule_id,session_id,id,status,type FROM scoped_requests WHERE decided_at >= $2::timestamptz AND decided_at < $3::timestamptz
   ) SELECT * FROM feed ORDER BY at DESC,id DESC LIMIT 21 OFFSET $6`,[...context.params.slice(0,5),input.offset])).rows;
   return page(rows.map(r=>({id:String(r.id),kind:r.kind as Activity['kind'],at:iso(r.at)!,employeeId:String(r.employee_id),employeeName:String(r.employee_name),storeName:String(r.store_name),scheduleId:String(r.schedule_id),sessionId:r.session_id==null?null:String(r.session_id),approvalId:r.approval_id==null?null:String(r.approval_id),reviewStatus:r.review_status as string|null,requestType:r.request_type as string|null})),input.offset);
  });
 }
 async detail(token:string,id:string,raw:unknown):Promise<SessionDetail>{
  z.uuid().parse(id);const {requestOffset}=z.object({requestOffset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().parse(raw);
  return this.auth.withIdentity(token,async(c,actor)=>{
   await c.query("SET LOCAL statement_timeout='8s'");
   const source=(await c.query(`SELECT s.starts_at,s.employee_id,b.timezone,a.rule_snapshot FROM attendance.attendance_sessions a JOIN attendance.schedules s ON s.id=a.schedule_id AND s.employee_id=a.employee_id JOIN attendance.employees em ON em.id=a.employee_id JOIN attendance.businesses b ON b.id=em.business_id WHERE a.id=$1 AND em.business_id=$2 AND ($3::boolean OR a.employee_id=$4)`,[id,actor.businessId,actor.role==='owner',actor.id])).rows[0];
   if(!source)throw notFound();
   const start=iso((source.rule_snapshot as Row).schedule_starts_at??source.starts_at)!,now=iso((await c.query('SELECT clock_timestamp() AS time')).rows[0].time)!;
   const row=(await c.query(reportCte+' SELECT * FROM report_rows WHERE session_id=$7',[actor.businessId,start,new Date(Date.parse(start)+1).toISOString(),null,source.employee_id,now,id])).rows[0];if(!row)throw notFound();
   const events=(await c.query('SELECT id,event_type,recorded_at,location_status,review_status,lat,lng,accuracy_m,distance_m,reason,photo_path FROM attendance.attendance_events WHERE session_id=$1 ORDER BY recorded_at,id',[id])).rows;
   const requests=(await c.query(`SELECT ar.id,ar.type,ar.status,ar.reason,ar.created_at,ar.decided_at,ar.decision_note,rv.full_name AS reviewer_name,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('field',co.field,'before',co.old_value,'requested',co.requested_value,'applied',co.applied_value) ORDER BY co.field) FROM attendance.attendance_corrections co WHERE co.approval_request_id=ar.id),'[]'::jsonb) AS changes
    FROM attendance.approval_requests ar LEFT JOIN attendance.employees rv ON rv.id=ar.reviewer_id
    WHERE ar.requester_id=$1 AND ((ar.target_type='schedule' AND ar.target_id=$2) OR (ar.target_type='attendance_event' AND EXISTS(SELECT FROM attendance.attendance_events ev WHERE ev.id=ar.target_id AND ev.session_id=$3)))
    ORDER BY ar.created_at DESC,ar.id DESC LIMIT 21 OFFSET $4`,[source.employee_id,row.schedule_id,id,requestOffset])).rows;
   const snapshot=source.rule_snapshot as Row,number=(key:string)=>typeof snapshot[key]==='number'?snapshot[key] as number:null;
   return {attendance:attendance(row),timezone:String(snapshot.timezone??source.timezone),locationRule:{storeName:String(snapshot.store_name??row.store_name),lat:number('store_lat'),lng:number('store_lng'),radiusM:number('radius_m'),accuracyM:number('accuracy_m'),graceMinutes:number('grace_minutes')},events:events.map(e=>({id:String(e.id),eventType:String(e.event_type),recordedAt:iso(e.recorded_at)!,locationStatus:String(e.location_status),reviewStatus:String(e.review_status),lat:e.lat as number|null,lng:e.lng as number|null,accuracyM:e.accuracy_m as number|null,distanceM:e.distance_m as number|null,reason:e.reason as string|null,photoAvailable:!!e.photo_path})),requests:page(requests.map(r=>({requestId:String(r.id),type:String(r.type),status:String(r.status),reason:String(r.reason),createdAt:iso(r.created_at)!,decidedAt:iso(r.decided_at),reviewerName:r.reviewer_name as string|null,decisionNote:r.decision_note as string|null,changes:r.changes as SessionDetail['requests']['items'][number]['changes']})),requestOffset)};
  });
 }
}
