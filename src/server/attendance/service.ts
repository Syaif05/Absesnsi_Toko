import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AuthService } from '../auth/service';
import { AuthError, requireOwnResource, type SqlConnection } from '../auth/types';
import type { StorageProvider } from '../storage/provider';
import { submissionSchema, ruleSchema, classifyLocation } from './validation';
import { validatePhoto } from './photo';
export type EventType = 'check_in' | 'check_out';
type Row = Record<string,unknown>;
const iso=(value:unknown)=>value instanceof Date?value.toISOString():String(value);
const uuid=z.uuid();
function conflict(code:string,message:string):never {throw new AuthError(code,409,message)}
export class AttendanceService {
  constructor(private auth:AuthService, private storage:StorageProvider) {}
  // Separate durable transaction survives an upload followed by a lost DB connection.
  async submit(token:string,type:EventType,raw:unknown,bytes:Uint8Array,mime:string) {
    const input=submissionSchema.parse(raw);
    await this.auth.me(token); // authorize before expensive decoding
    const photo=await validatePhoto(bytes,mime);
    const hash=createHash('sha256').update(JSON.stringify({type,...input})).update(photo).digest('hex');
    const intent=await this.auth.withIdentity(token,async(c,actor)=>{
      const existing=(await c.query('SELECT * FROM attendance.attendance_uploads WHERE employee_id=$1 AND idempotency_key=$2',[actor.id,input.idempotencyKey])).rows[0];
      if(existing) {
        if(existing.payload_hash!==hash) conflict('IDEMPOTENCY_CONFLICT','Kunci pengiriman telah dipakai untuk data berbeda.');
        return existing;
      }
      const count=(await c.query('SELECT count(*)::int AS n FROM attendance.attendance_uploads WHERE employee_id=$1 AND created_at>now()-interval \'1 hour\'',[actor.id])).rows[0];
      if(Number(count.n)>=20)throw new AuthError('RATE_LIMITED',429,'Terlalu banyak pengiriman. Coba lagi nanti.');
      const id=randomUUID(), path=`${actor.businessId}/${actor.id}/${id}.jpg`;
      return (await c.query(`INSERT INTO attendance.attendance_uploads(id,employee_id,idempotency_key,payload_hash,photo_path,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '24 hours') RETURNING *`,[id,actor.id,input.idempotencyKey,hash,path])).rows[0];
    });
    return this.auth.withIdentity(token,async(c,actor)=>{
      const upload=(await c.query('SELECT *, expires_at>clock_timestamp() AS valid FROM attendance.attendance_uploads WHERE id=$1 FOR UPDATE',[intent.id])).rows[0];
      const duplicate=(await c.query('SELECT id,session_id,event_type,recorded_at,location_status,review_status,rule_snapshot FROM attendance.attendance_events WHERE employee_id=$1 AND idempotency_key=$2',[actor.id,input.idempotencyKey])).rows[0];
      if(duplicate)return this.result(duplicate);
      if(upload.state!=='pending'||!upload.valid)conflict('UPLOAD_EXPIRED','Pengiriman kedaluwarsa. Ambil selfie baru.');
      const open=(await c.query('SELECT * FROM attendance.attendance_sessions WHERE employee_id=$1 AND check_out_at IS NULL FOR UPDATE',[actor.id])).rows[0];
      let session:Row|undefined, schedule:Row, snapshot:Row;
      if(type==='check_in') {
        if(open) conflict('OPEN_SESSION','Masih ada sesi tanpa absen pulang. Selesaikan sesi tersebut terlebih dahulu.');
        const found=(await c.query(`SELECT s.*, st.name AS store_name FROM attendance.schedules s JOIN attendance.stores st ON st.id=s.store_id WHERE s.id=$1 AND s.employee_id=$2 AND st.business_id=$3 AND st.is_active AND s.status='published' AND s.starts_at<=clock_timestamp() AND s.ends_at>clock_timestamp() FOR SHARE OF s,st`,[input.scheduleId,actor.id,actor.businessId])).rows[0];
        if(!found)conflict('ATTENDANCE_OUTSIDE_SCHEDULE','Tidak ada jadwal aktif yang sesuai. Hubungi owner untuk penugasan.');
        if((await c.query('SELECT id FROM attendance.attendance_sessions WHERE schedule_id=$1',[input.scheduleId])).rows.length)conflict('ALREADY_CHECKED_IN','Jadwal ini sudah memiliki absensi.');
        schedule=found;
        snapshot={...ruleSchema.parse(schedule.rule_snapshot),schedule_starts_at:iso(schedule.starts_at),schedule_ends_at:iso(schedule.ends_at),store_name:schedule.store_name};
      } else {
        if(!open||open.schedule_id!==input.scheduleId)conflict('NO_OPEN_SESSION','Tidak ada sesi milik Anda yang dapat diabsen pulang.');
        session=open;
        const original=(await c.query(`SELECT store_id,rule_snapshot FROM attendance.attendance_events WHERE session_id=$1 AND event_type='check_in'`,[session.id])).rows[0];
        if(!original)conflict('MISSING_CHECK_IN','Bukti absen masuk belum tersedia. Hubungi owner.');
        snapshot=ruleSchema.parse(original.rule_snapshot);
        schedule={id:input.scheduleId,store_id:original.store_id};
      }
      const location=classifyLocation(input.location,ruleSchema.parse(snapshot)),pending=location.status!=='inside';
      if(pending&&input.reason.length<5)throw new AuthError('REASON_REQUIRED',400,'Isi alasan minimal 5 karakter untuk pengecualian lokasi.');
      const now=iso((await c.query('SELECT clock_timestamp() AS time')).rows[0].time);
      const late=type==='check_in'&&Date.parse(now)>Date.parse(String(snapshot.schedule_starts_at))+Number(snapshot.grace_minutes)*60000;
      snapshot={...snapshot,...(type==='check_in'?{late}:{}),location_policy:'schedule_snapshot'};
      await this.storage.uploadPrivate(String(upload.photo_path),photo);
      if(!session)session=(await c.query(`INSERT INTO attendance.attendance_sessions(employee_id,schedule_id,check_in_at,status) VALUES($1,$2,$3,$4) RETURNING *`,[actor.id,input.scheduleId,now,pending?'needs_review':'open'])).rows[0];
      const gps=input.location.status==='available'?input.location:null;
      const event=(await c.query(`INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,recorded_at,photo_path,lat,lng,accuracy_m,distance_m,location_status,review_status,reason,idempotency_key,rule_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,session_id,event_type,recorded_at,location_status,review_status,rule_snapshot`,[session.id,actor.id,schedule.store_id,type,now,upload.photo_path,gps?.lat??null,gps?.lng??null,gps?.accuracyM??null,location.distance,location.status,pending?'pending':'not_required',input.reason||null,input.idempotencyKey,JSON.stringify(snapshot)])).rows[0];
      if(pending)await c.query(`INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason) VALUES($1,'location_exception','attendance_event',$2,$3)`,[actor.id,event.id,input.reason]);
      if(type==='check_out') {
        const needsReview=pending||(await c.query(`SELECT id FROM attendance.attendance_events WHERE session_id=$1 AND review_status IN ('pending','rejected')`,[session.id])).rows.length>0;
        await c.query('UPDATE attendance.attendance_sessions SET check_out_at=$1,status=$2 WHERE id=$3',[now,needsReview?'needs_review':'completed',session.id]);
      }
      await c.query("UPDATE attendance.attendance_uploads SET state='completed' WHERE id=$1",[upload.id]);
      await c.query(`INSERT INTO attendance.audit_logs(actor_id,action,entity_type,entity_id,metadata_redacted) VALUES($1,$2,'attendance_event',$3,$4)`,[actor.id,'attendance.'+type,event.id,JSON.stringify({sessionId:session.id,locationStatus:location.status,reviewStatus:event.review_status})]);
      return this.result(event);
    });
  }
  private result(event:Row) {
    return {id:String(event.id),sessionId:String(event.session_id),eventType:event.event_type,recordedAt:iso(event.recorded_at),locationStatus:event.location_status,reviewStatus:event.review_status,late:Boolean((event.rule_snapshot as Row).late)};
  }
  async context(token:string) {
    return this.auth.withIdentity(token,async(c,actor)=>{
      const open=(await c.query(`SELECT a.id,a.schedule_id,a.check_in_at,a.status,e.rule_snapshot,st.name AS store_name,st.lat,st.lng,st.radius_m FROM attendance.attendance_sessions a JOIN attendance.attendance_events e ON e.session_id=a.id AND e.event_type='check_in' JOIN attendance.stores st ON st.id=e.store_id WHERE a.employee_id=$1 AND a.check_out_at IS NULL`,[actor.id])).rows[0];
      const shifts=(await c.query(`SELECT s.id,s.starts_at,s.ends_at,s.rule_snapshot,st.name AS store_name FROM attendance.schedules s JOIN attendance.stores st ON st.id=s.store_id WHERE s.employee_id=$1 AND s.status='published' AND st.is_active AND s.starts_at<=clock_timestamp() AND s.ends_at>clock_timestamp() AND NOT EXISTS(SELECT FROM attendance.attendance_sessions a WHERE a.schedule_id=s.id) ORDER BY s.starts_at LIMIT 5`,[actor.id])).rows;
      const now=iso((await c.query('SELECT clock_timestamp() AS time')).rows[0].time);
      const rules=(await c.query("SELECT key,value_json FROM attendance.business_settings WHERE business_id=$1 AND key='retention_policy'",[actor.businessId])).rows[0]?.value_json??null;
      const timezone=String((await c.query('SELECT timezone FROM attendance.businesses WHERE id=$1',[actor.businessId])).rows[0].timezone);
      return {serverTime:now,timezone,open:open?{id:open.id,scheduleId:open.schedule_id,storeName:(open.rule_snapshot as Row).store_name??open.store_name,checkInAt:iso(open.check_in_at),status:open.status,missingCheckout:Date.parse(now)>Date.parse(String((open.rule_snapshot as Row).schedule_ends_at)),rules:ruleSchema.parse(open.rule_snapshot)}:null,shifts:shifts.map(s=>({id:s.id,storeName:s.store_name,startsAt:iso(s.starts_at),endsAt:iso(s.ends_at),rules:ruleSchema.parse(s.rule_snapshot)})),retentionPolicy:rules};
    });
  }
  async own(token:string,raw:unknown) {
    const {offset}=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().parse(raw);
    return this.auth.withIdentity(token,async(c,actor)=>{
      const rows=(await c.query(`SELECT id,session_id,event_type,recorded_at,location_status,review_status,rule_snapshot FROM attendance.attendance_events WHERE employee_id=$1 ORDER BY recorded_at DESC,id DESC LIMIT 21 OFFSET $2`,[actor.id,offset])).rows;
      return {items:rows.slice(0,20).map(e=>this.result(e)),hasMore:rows.length>20,nextOffset:offset+20};
    });
  }
  async photo(token:string,id:string) {
    uuid.parse(id);
    return this.auth.withIdentity(token,async(c,actor)=>{
      const event=(await c.query(`SELECT e.photo_path,e.employee_id,p.business_id FROM attendance.attendance_events e JOIN attendance.employees p ON p.id=e.employee_id WHERE e.id=$1`,[id])).rows[0];
      if(!event)throw new AuthError('NOT_FOUND',404,'Foto tidak ditemukan.');
      requireOwnResource(actor,String(event.employee_id),String(event.business_id));
      return {url:await this.storage.getSignedReadUrl(String(event.photo_path),60),expiresIn:60};
    });
  }
}
// Run only via the maintenance CLI. Same row lock as submit; completed evidence is never removed.
export async function reconcileUploads(c:SqlConnection,storage:StorageProvider) {
  const rows=(await c.query(`SELECT id,photo_path FROM attendance.attendance_uploads WHERE state='pending' AND expires_at<clock_timestamp() ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED`)).rows;
  for(const row of rows) {
    if((await c.query('SELECT id FROM attendance.attendance_events WHERE photo_path=$1',[row.photo_path])).rows.length)continue;
    await storage.delete(String(row.photo_path));
    await c.query("UPDATE attendance.attendance_uploads SET state='removed' WHERE id=$1",[row.id]);
  }
  return rows.length;
}
