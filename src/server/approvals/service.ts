import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AuthService } from '../auth/service';
import { AuthError, requireOwner, type SqlConnection, type Identity } from '../auth/types';
import { refreshSessionStatus } from '../attendance/state';
import { ruleSchema } from '../attendance/validation';
import { decisionSchema,listSchema,submissionSchema } from './validation';
import type { ApprovalDetail,ApprovalSummary,CorrectionTarget,CorrectionField } from './models';
type Row=Record<string,unknown>;
const iso=(v:unknown):string|null=>v==null?null:v instanceof Date?v.toISOString():new Date(String(v)).toISOString();
const notFound=()=>new AuthError('NOT_FOUND',404,'Permintaan atau jadwal tidak ditemukan.');
const conflict=(message:string)=>new AuthError('APPROVAL_CONFLICT',409,message);
const base=`SELECT a.*,p.full_name AS requester_name,r.full_name AS reviewer_name,st.name AS store_name,s.id AS schedule_id
 FROM attendance.approval_requests a JOIN attendance.employees p ON p.id=a.requester_id
 LEFT JOIN attendance.employees r ON r.id=a.reviewer_id
 LEFT JOIN attendance.attendance_events ev ON a.target_type='attendance_event' AND ev.id=a.target_id AND ev.employee_id=p.id
 LEFT JOIN attendance.attendance_sessions es ON es.id=ev.session_id
 LEFT JOIN attendance.schedules s ON s.id=CASE WHEN a.target_type='schedule' THEN a.target_id ELSE es.schedule_id END AND s.employee_id=p.id
 LEFT JOIN attendance.stores st ON st.id=COALESCE(ev.store_id,s.store_id) AND st.business_id=p.business_id`;
function summary(r:Row):ApprovalSummary {
 return {id:String(r.id),type:r.type as ApprovalSummary['type'],requesterId:String(r.requester_id),requesterName:String(r.requester_name),storeName:String(r.store_name??'Toko historis'),scheduleId:String(r.schedule_id),status:r.status as ApprovalSummary['status'],reason:String(r.reason),createdAt:iso(r.created_at)!,decidedAt:iso(r.decided_at),reviewerName:r.reviewer_name==null?null:String(r.reviewer_name),decisionNote:r.decision_note==null?null:String(r.decision_note)};
}
function times(s:Row|undefined){return {check_in_at:iso(s?.check_in_at),check_out_at:iso(s?.check_out_at)}}
function validateTimes(values:ReturnType<typeof times>,now:string){
 if(!values.check_in_at)throw new AuthError('INVALID_CORRECTION',400,'Jam masuk wajib tersedia sebelum jam pulang.');
 if(values.check_out_at&&Date.parse(values.check_out_at)<Date.parse(values.check_in_at))throw new AuthError('INVALID_CORRECTION',400,'Jam pulang tidak boleh mendahului jam masuk. Periksa tanggal shift malam.');
 if(Object.values(values).some(v=>v&&Date.parse(v)>Date.parse(now)))throw new AuthError('INVALID_CORRECTION',400,'Waktu koreksi tidak boleh berada di masa depan.');
}
export class ApprovalService {
 constructor(private auth:AuthService){}
 private async limit(token:string,decision=false){
  const allowed=await this.auth.withIdentity(token,async(c,actor)=>{
   if(decision)requireOwner(actor);
   const key=`approval:${decision?'decision':'submit'}:${actor.id}`;
   const result=await c.query(`INSERT INTO attendance.auth_rate_limits(key,attempts,resets_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN attendance.auth_rate_limits.resets_at<=now() THEN 1 ELSE attendance.auth_rate_limits.attempts+1 END,resets_at=CASE WHEN attendance.auth_rate_limits.resets_at<=now() THEN now()+interval '15 minutes' ELSE attendance.auth_rate_limits.resets_at END RETURNING attempts`,[key]);
   return Number(result.rows[0].attempts)<=(decision?60:20);
  });
  if(!allowed)throw new AuthError('RATE_LIMITED',429,'Terlalu banyak permintaan persetujuan. Coba lagi dalam 15 menit.');
 }
 private async target(c:SqlConnection,actor:Identity,scheduleId:string,employeeId:string,lock=false){
  const schedule=(await c.query(`SELECT s.*,st.name AS store_name,COALESCE(s.rule_snapshot->>'timezone',b.timezone) AS timezone FROM attendance.schedules s JOIN attendance.stores st ON st.id=s.store_id JOIN attendance.businesses b ON b.id=st.business_id WHERE s.id=$1 AND s.employee_id=$2 AND st.business_id=$3 ${lock?'FOR UPDATE OF s':''}`,[scheduleId,employeeId,actor.businessId])).rows[0];
  if(!schedule)throw notFound();
  const session=(await c.query(`SELECT * FROM attendance.attendance_sessions WHERE schedule_id=$1 ${lock?'FOR UPDATE':''}`,[scheduleId])).rows[0];
  return {schedule,session};
 }
 async submit(token:string,raw:unknown){
  const input=submissionSchema.parse(raw),hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const previous=await this.auth.withIdentity(token,async(c,actor)=>(await c.query('SELECT id,request_hash FROM attendance.approval_requests WHERE requester_id=$1 AND request_key=$2',[actor.id,input.requestKey])).rows[0]);
  if(previous){if(previous.request_hash!==hash)throw conflict('Kunci pengiriman sudah dipakai untuk data berbeda.');return this.get(token,String(previous.id))}
  await this.limit(token);
  const id=await this.auth.withIdentity(token,async(c,actor)=>{
   const prior=(await c.query('SELECT id,request_hash FROM attendance.approval_requests WHERE requester_id=$1 AND request_key=$2',[actor.id,input.requestKey])).rows[0];
   if(prior){if(prior.request_hash!==hash)throw conflict('Kunci pengiriman sudah dipakai untuk data berbeda.');return String(prior.id)}
   if(input.type==='location_exception'){
    const event=(await c.query(`SELECT e.* FROM attendance.attendance_events e JOIN attendance.attendance_sessions s ON s.id=e.session_id WHERE e.id=$1 AND e.employee_id=$2`,[input.eventId,actor.id])).rows[0];
    if(!event)throw notFound();
    if(event.review_status!=='pending'||event.location_status==='inside')throw conflict('Bukti lokasi ini tidak sedang memerlukan persetujuan.');
    const existing=(await c.query("SELECT id FROM attendance.approval_requests WHERE type='location_exception' AND target_id=$1",[event.id])).rows[0];
    if(existing)return String(existing.id);
    const created=(await c.query(`INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason,request_key,request_hash) VALUES($1,'location_exception','attendance_event',$2,$3,$4,$5) RETURNING id`,[actor.id,event.id,input.reason,input.requestKey,hash])).rows[0];
    await this.audit(c,actor.id,'approval.submitted',String(created.id),{type:input.type});return String(created.id);
   }
   const {schedule,session}=await this.target(c,actor,input.scheduleId,actor.id,true);
   if(!session&&schedule.status!=='published')throw conflict('Koreksi tanpa sesi hanya dapat diajukan pada jadwal yang pernah diterbitkan dan masih sah.');
   const now=iso((await c.query('SELECT clock_timestamp() AS time')).rows[0].time)!;
   if(!session&&Date.parse(iso(schedule.starts_at)!)>Date.parse(now))throw new AuthError('INVALID_CORRECTION',400,'Jadwal belum dimulai.');
   if((await c.query("SELECT id FROM attendance.approval_requests WHERE type='attendance_correction' AND target_id=$1 AND status='pending'",[input.scheduleId])).rows.length)throw conflict('Masih ada koreksi menunggu persetujuan untuk jadwal ini.');
   const before=times(session),after={...before};
   for(const change of input.changes){if(before[change.field]===change.value)throw new AuthError('INVALID_CORRECTION',400,'Waktu yang diajukan sama dengan catatan saat ini.');after[change.field]=change.value}
   validateTimes(after,now);
   const source=session&&Object.keys(session.rule_snapshot as Row).length?session.rule_snapshot:schedule.rule_snapshot;
   const rules={...ruleSchema.parse(source),store_id:schedule.store_id,store_name:schedule.store_name,schedule_starts_at:(source as Row).schedule_starts_at??iso(schedule.starts_at),schedule_ends_at:(source as Row).schedule_ends_at??iso(schedule.ends_at)};
   const context={sessionId:session?.id??null,scheduleVersion:schedule.version,before,rules,timezone:schedule.timezone};
   const created=(await c.query(`INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason,request_key,request_hash,context_snapshot) VALUES($1,'attendance_correction','schedule',$2,$3,$4,$5,$6) RETURNING id`,[actor.id,input.scheduleId,input.reason,input.requestKey,hash,JSON.stringify(context)])).rows[0];
   for(const change of input.changes)await c.query('INSERT INTO attendance.attendance_corrections(approval_request_id,field,old_value,requested_value) VALUES($1,$2,$3,$4)',[created.id,change.field,JSON.stringify(before[change.field]),JSON.stringify(change.value)]);
   await this.audit(c,actor.id,'approval.submitted',String(created.id),{type:input.type,scheduleId:input.scheduleId,before,requested:after});
   return String(created.id);
  });
  return this.get(token,id);
 }
 async list(token:string,raw:unknown){
  const input=listSchema.parse(raw);
  return this.auth.withIdentity(token,async(c,actor)=>{
   const inbox=input.view==='inbox'||input.view===undefined&&actor.role==='owner';if(inbox)requireOwner(actor);
   const rows=(await c.query(base+` WHERE p.business_id=$1 AND ($2::boolean OR a.requester_id=$3) AND ($4='all' OR a.status=$4) AND ($5::text IS NULL OR a.type=$5) AND ($6::uuid IS NULL OR st.id=$6) ORDER BY a.created_at DESC,a.id DESC LIMIT 21 OFFSET $7`,[actor.businessId,inbox,actor.id,input.status,input.type??null,input.storeId??null,input.offset])).rows;
   return {items:rows.slice(0,20).map(summary),hasMore:rows.length>20,nextOffset:input.offset+20};
  });
 }
 async targets(token:string,raw:unknown){
  const {offset}=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().parse(raw);
  return this.auth.withIdentity(token,async(c,actor)=>{
   const rows=(await c.query(`SELECT s.id AS schedule_id,s.starts_at,s.ends_at,st.name AS store_name,COALESCE(s.rule_snapshot->>'timezone',b.timezone) AS timezone,a.id AS session_id,a.check_in_at,a.check_out_at,a.is_corrected FROM attendance.schedules s JOIN attendance.stores st ON st.id=s.store_id JOIN attendance.businesses b ON b.id=st.business_id LEFT JOIN attendance.attendance_sessions a ON a.schedule_id=s.id WHERE s.employee_id=$1 AND st.business_id=$2 AND s.starts_at<=clock_timestamp() AND (s.status='published' OR a.id IS NOT NULL) ORDER BY s.starts_at DESC,s.id DESC LIMIT 21 OFFSET $3`,[actor.id,actor.businessId,offset])).rows;
   const items:CorrectionTarget[]=rows.slice(0,20).map(r=>({scheduleId:String(r.schedule_id),storeName:String(r.store_name),startsAt:iso(r.starts_at)!,endsAt:iso(r.ends_at)!,timezone:String(r.timezone),checkInAt:iso(r.check_in_at),checkOutAt:iso(r.check_out_at),sessionId:r.session_id==null?null:String(r.session_id),isCorrected:!!r.is_corrected}));
   return {items,hasMore:rows.length>20,nextOffset:offset+20};
  });
 }
 async get(token:string,id:string):Promise<ApprovalDetail>{
  z.uuid().parse(id);
  return this.auth.withIdentity(token,async(c,actor)=>{
   const row=(await c.query(base+' WHERE a.id=$1 AND p.business_id=$2 AND ($3::boolean OR a.requester_id=$4)',[id,actor.businessId,actor.role==='owner',actor.id])).rows[0];
   if(!row||!row.schedule_id)throw notFound();
   const {schedule,session}=await this.target(c,actor,String(row.schedule_id),String(row.requester_id));
   const changes=(await c.query('SELECT field,old_value,requested_value,applied_value FROM attendance.attendance_corrections WHERE approval_request_id=$1 ORDER BY field',[id])).rows;
   const events=session?(await c.query('SELECT id,event_type,recorded_at,lat,lng,accuracy_m,distance_m,location_status,review_status,reason,photo_path FROM attendance.attendance_events WHERE session_id=$1 ORDER BY recorded_at,id',[session.id])).rows:[];
   const snapshot=(session?.rule_snapshot??(row.context_snapshot as {rules?:Row}|null)?.rules??schedule.rule_snapshot) as Row;
   const now=Date.parse(iso((await c.query('SELECT clock_timestamp() AS time')).rows[0].time)!);
   const effective=times(session);
   return {...summary(row),timezone:String(snapshot.timezone??schedule.timezone),schedule:{startsAt:String(snapshot.schedule_starts_at??iso(schedule.starts_at)),endsAt:String(snapshot.schedule_ends_at??iso(schedule.ends_at)),status:String(schedule.status)},session:session?{id:String(session.id),checkInAt:effective.check_in_at,checkOutAt:effective.check_out_at,status:String(session.status),isCorrected:!!session.is_corrected,late:!!effective.check_in_at&&Date.parse(effective.check_in_at)>Date.parse(String(snapshot.schedule_starts_at??iso(schedule.starts_at)))+Number(snapshot.grace_minutes??0)*60000,missingCheckout:!effective.check_out_at&&now>Date.parse(String(snapshot.schedule_ends_at??iso(schedule.ends_at)))}:null,
    corrections:changes.map(r=>({field:r.field as CorrectionField,oldValue:r.old_value as string|null,requestedValue:String(r.requested_value),appliedValue:r.applied_value as string|null})),
    evidence:events.map(e=>({id:String(e.id),eventType:String(e.event_type),recordedAt:iso(e.recorded_at)!,lat:e.lat as number|null,lng:e.lng as number|null,accuracyM:e.accuracy_m as number|null,distanceM:e.distance_m as number|null,locationStatus:String(e.location_status),reviewStatus:String(e.review_status),reason:e.reason as string|null,photoAvailable:!!e.photo_path})),
    storeLocation:{lat:typeof snapshot.store_lat==='number'?snapshot.store_lat:null,lng:typeof snapshot.store_lng==='number'?snapshot.store_lng:null,radiusM:typeof snapshot.radius_m==='number'?snapshot.radius_m:null}};
  });
 }
 async decide(token:string,id:string,raw:unknown){
  z.uuid().parse(id);const input=decisionSchema.parse(raw);await this.limit(token,true);
  const requesterId=await this.auth.withOwner(token,async(c,actor)=>{
   const request=(await c.query('SELECT a.requester_id FROM attendance.approval_requests a JOIN attendance.employees p ON p.id=a.requester_id WHERE a.id=$1 AND p.business_id=$2',[id,actor.businessId])).rows[0];
   if(!request)throw notFound();return String(request.requester_id);
  });
  await this.auth.withOwnerAndEmployee(token,requesterId,async(c,actor)=>{
   // Sorted owner/employee locks precede schedule -> session -> approval locks.
   const found=(await c.query(base+' WHERE a.id=$1 AND p.business_id=$2',[id,actor.businessId])).rows[0];
   if(!found||!found.schedule_id)throw notFound();
   const {schedule,session}=await this.target(c,actor,String(found.schedule_id),String(found.requester_id),true);
   const request=(await c.query('SELECT * FROM attendance.approval_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(request.status!=='pending')throw conflict('Permintaan ini sudah diputuskan. Muat ulang untuk melihat hasil.');
   const before=times(session),after={...before};let sessionId=session?.id;
   if(request.type==='location_exception'){
    const event=(await c.query('SELECT * FROM attendance.attendance_events WHERE id=$1 AND employee_id=$2 FOR UPDATE',[request.target_id,request.requester_id])).rows[0];
    if(!event||event.review_status!=='pending'||event.session_id!==sessionId)throw conflict('Status bukti lokasi sudah berubah.');
    await c.query('UPDATE attendance.attendance_events SET review_status=$1 WHERE id=$2',[input.status,event.id]);
   }else if(request.type==='attendance_correction'){
    if(input.status==='approved'){
     const context=request.context_snapshot as {sessionId:string|null;scheduleVersion:number;before:ReturnType<typeof times>;rules:Row};
     if(!context||context.sessionId!==(sessionId??null)||(context.before.check_in_at!==before.check_in_at||context.before.check_out_at!==before.check_out_at))throw conflict('Catatan absensi berubah sejak pengajuan. Tolak permintaan ini dan ajukan koreksi baru agar nilai terbaru ditinjau.');
     if(!session&&(schedule.status!=='published'||context.scheduleVersion!==schedule.version))throw conflict('Jadwal tanpa sesi berubah sejak pengajuan. Tolak dan ajukan ulang dengan jadwal terbaru.');
     const changes=(await c.query('SELECT * FROM attendance.attendance_corrections WHERE approval_request_id=$1 ORDER BY field FOR UPDATE',[id])).rows;
     if(!changes.length)throw conflict('Rincian koreksi tidak tersedia.');
     for(const change of changes){const field=z.enum(['check_in_at','check_out_at']).parse(change.field);after[field]=z.iso.datetime({offset:true}).parse(change.requested_value)}
     validateTimes(after,iso((await c.query('SELECT clock_timestamp() AS time')).rows[0].time)!);
     if(!session){
      if((await c.query('SELECT id FROM attendance.attendance_sessions WHERE employee_id=$1 AND check_out_at IS NULL FOR UPDATE',[request.requester_id])).rows.length&&!after.check_out_at)throw conflict('Karyawan masih memiliki sesi lain tanpa jam pulang.');
      sessionId=(await c.query(`INSERT INTO attendance.attendance_sessions(employee_id,schedule_id,check_in_at,check_out_at,is_corrected,rule_snapshot) VALUES($1,$2,$3,$4,true,$5) RETURNING id`,[request.requester_id,schedule.id,after.check_in_at,after.check_out_at,JSON.stringify(context.rules)])).rows[0].id;
     }else await c.query('UPDATE attendance.attendance_sessions SET check_in_at=$1,check_out_at=$2,is_corrected=true WHERE id=$3',[after.check_in_at,after.check_out_at,sessionId]);
     for(const change of changes)await c.query('UPDATE attendance.attendance_corrections SET applied_value=requested_value WHERE id=$1',[change.id]);
    }
   }else throw conflict('Jenis permintaan belum didukung.');
   await c.query(`UPDATE attendance.approval_requests SET status=$1,reviewer_id=$2,decision_note=$3,decided_at=clock_timestamp() WHERE id=$4 AND status='pending'`,[input.status,actor.id,input.note,id]);
   if(sessionId)await refreshSessionStatus(c,String(sessionId));
   await this.audit(c,actor.id,'approval.'+input.status,id,{requesterId:request.requester_id,type:request.type,sessionId:sessionId??null,before,after,decisionNote:input.note});
  });
  return this.get(token,id);
 }
 private async audit(c:SqlConnection,actorId:string,action:string,id:string,metadata:Row){
  await c.query(`INSERT INTO attendance.audit_logs(actor_id,action,entity_type,entity_id,metadata_redacted) VALUES($1,$2,'approval_request',$3,$4)`,[actorId,action,id,JSON.stringify(metadata)]);
 }
}
