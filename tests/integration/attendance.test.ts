import { readFileSync,readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { AuthService } from '../../src/server/auth/service';
import { tokenHash } from '../../src/server/auth/crypto';
import type { AuthDatabase } from '../../src/server/auth/types';
import { AttendanceService,reconcileUploads } from '../../src/server/attendance/service';
import { createAttendanceHandler } from '../../src/server/attendance/http';
import { cookieName } from '../../src/server/auth/http';
import { classifyLocation,haversine,type Submission } from '../../src/server/attendance/validation';
import { validatePhoto } from '../../src/server/attendance/photo';
import { SupabaseStorage } from '../../src/server/storage/supabase';
import type { StorageProvider } from '../../src/server/storage/provider';
const pg=new PGlite({extensions:{btree_gist}}),businessId=randomUUID(),storeId=randomUUID();
let failInsert=false;
const db:AuthDatabase={transaction:work=>pg.transaction(tx=>work({query:async(text,values)=>{
 if(failInsert&&text.startsWith('INSERT INTO attendance.attendance_events')){failInsert=false;throw new Error('simulated connection failure')}
 return tx.query(text,values);
}}))};
class MemoryStorage implements StorageProvider {
 objects=new Map<string,Uint8Array>(); fail=false; writes=0; reads=0;
 async uploadPrivate(path:string,bytes:Uint8Array){if(this.fail)throw new Error('storage unavailable');this.objects.set(path,bytes);this.writes++}
 async getSignedReadUrl(path:string,seconds:number){this.reads++;return `https://storage.example/${path}?expires=${seconds}`}
 async delete(path:string){this.objects.delete(path)}
}
const storage=new MemoryStorage(),auth=new AuthService(db,businessId,'attendance-test-secret-'.repeat(3)),service=new AttendanceService(auth,storage);
const rules={radius_m:100,accuracy_m:100,store_lat:-6.2,store_lng:106.8,grace_minutes:5};
let jpeg:Buffer;
async function fixture(role='employee',biz=businessId){
 const id=randomUUID(),scheduleId=randomUUID(),token=randomUUID();
 await pg.query<Record<string,unknown>>(`INSERT INTO attendance.employees(id,business_id,employee_code,full_name,role) VALUES($1,$2,$3,'Pengguna fiktif',$4)`,[id,biz,id,role]);
 await pg.query<Record<string,unknown>>(`INSERT INTO attendance.auth_sessions(employee_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')`,[id,tokenHash(token)]);
 await pg.query<Record<string,unknown>>(`INSERT INTO attendance.schedules(id,employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot) VALUES($1,$2,$3,now()-interval '30 minutes',now()+interval '7 hours','published',$2,$4)`,[scheduleId,id,storeId,JSON.stringify(rules)]);
 const input:Submission={idempotencyKey:randomUUID(),scheduleId,location:{status:'available',lat:-6.2,lng:106.8,accuracyM:20},reason:''};
 return {id,token,scheduleId,input};
}
const submit=(f:Awaited<ReturnType<typeof fixture>>,type:'check_in'|'check_out'='check_in',input=f.input)=>service.submit(f.token,type,input,jpeg,'image/jpeg');
beforeAll(async()=>{
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync('drizzle/'+file,'utf8'));
 await pg.query<Record<string,unknown>>(`INSERT INTO attendance.businesses(id,name) VALUES($1,'Usaha fiktif')`,[businessId]);
 await pg.query<Record<string,unknown>>(`INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng) VALUES($1,$2,'TEST','Toko penugasan','Alamat fiktif',-6.2,106.8)`,[storeId,businessId]);
 jpeg=await sharp({create:{width:320,height:400,channels:3,background:'#8095f5'}}).jpeg().toBuffer();
},30000);
afterAll(()=>pg.close());
it('classifies distance and GPS independently, including exact threshold and poles',()=>{
 expect(haversine(-6.2,106.8,-6.2,106.8)).toBe(0);
 expect(haversine(0,0,0,1)).toBeCloseTo(111195,0);
 expect(Number.isFinite(haversine(90,0,-90,180))).toBe(true);
 expect(classifyLocation({status:'available',lat:-6.2,lng:106.8,accuracyM:100},rules).status).toBe('inside');
 expect(classifyLocation({status:'available',lat:-6.2,lng:106.8,accuracyM:101},rules).status).toBe('inaccurate');
});
it('records normal check-in/out with server time, snapshots and private paths only',async()=>{
 const f=await fixture(),before=Date.now(),saved=await submit(f);
 expect(saved.reviewStatus).toBe('not_required');expect(saved.locationStatus).toBe('inside');expect(saved.late).toBe(true);
 expect(Date.parse(saved.recordedAt)).toBeGreaterThanOrEqual(before-1000);
 const event=(await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_events WHERE id=$1',[saved.id])).rows[0];
 expect(event.photo_path).toMatch(/\.jpg$/);expect(event.photo_path).not.toContain('http');expect(storage.objects.has(String(event.photo_path))).toBe(true);
 expect((event.rule_snapshot as Record<string,unknown>).schedule_starts_at).toBeTruthy();
 expect((await pg.query<Record<string,unknown>>('SELECT * FROM attendance.approval_requests WHERE target_id=$1',[saved.id])).rows).toHaveLength(0);
 const checkout=await submit(f,'check_out',{...f.input,idempotencyKey:randomUUID()});
 expect(checkout.eventType).toBe('check_out');
 await expect(submit(f,'check_in',{...f.input,idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'ALREADY_CHECKED_IN'});
 expect((await pg.query<Record<string,unknown>>('SELECT status FROM attendance.attendance_sessions WHERE id=$1',[saved.sessionId])).rows[0].status).toBe('completed');
});
it('applies schedule grace to server time and blocks an ended shift',async()=>{
 const f=await fixture();
 await pg.query<Record<string,unknown>>("UPDATE attendance.schedules SET starts_at=now()-interval '1 minute' WHERE id=$1",[f.scheduleId]);
 expect((await submit(f)).late).toBe(false);
 const ended=await fixture();
 await pg.query<Record<string,unknown>>("UPDATE attendance.schedules SET starts_at=now()-interval '8 hours',ends_at=now()-interval '1 minute' WHERE id=$1",[ended.scheduleId]);
 await expect(submit(ended)).rejects.toMatchObject({code:'ATTENDANCE_OUTSIDE_SCHEDULE'});
});
it('double submission and concurrent retry return one event and one upload',async()=>{
 const f=await fixture(),before=storage.writes;
 const [a,b]=await Promise.all([submit(f),submit(f)]);expect(a).toEqual(b);expect(storage.writes-before).toBe(1);
 expect((await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_events WHERE employee_id=$1',[f.id])).rows).toHaveLength(1);
 await expect(submit(f,'check_in',{...f.input,reason:'Changed body'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
});
it.each(['outside','inaccurate','denied','unavailable'] as const)('creates atomic pending exception for %s and permits checkout',async(status)=>{
 const f=await fixture();
 const location:Submission['location']=status==='outside'?{status:'available',lat:-6.3,lng:106.8,accuracyM:20}:status==='inaccurate'?{status:'available',lat:-6.2,lng:106.8,accuracyM:200}:{status};
 const input={...f.input,location,reason:'GPS sedang bermasalah di lokasi kerja'};
 const saved=await submit(f,'check_in',input);expect(saved.locationStatus).toBe(status);expect(saved.reviewStatus).toBe('pending');
 const approval=(await pg.query<Record<string,unknown>>('SELECT * FROM attendance.approval_requests WHERE target_id=$1',[saved.id])).rows;
 expect(approval).toHaveLength(1);expect(approval[0].status).toBe('pending');
 await submit(f,'check_out',{...f.input,idempotencyKey:randomUUID()});
 expect((await pg.query<Record<string,unknown>>('SELECT status FROM attendance.attendance_sessions WHERE id=$1',[saved.sessionId])).rows[0].status).toBe('needs_review');
});
it('exception without reason fails without uploading or creating a work session',async()=>{
 const f=await fixture(),before=storage.writes;
 await expect(submit(f,'check_in',{...f.input,location:{status:'denied'}})).rejects.toMatchObject({code:'REASON_REQUIRED'});
 expect(storage.writes).toBe(before);expect((await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_sessions WHERE employee_id=$1',[f.id])).rows).toHaveLength(0);
});
it('failed storage never creates attendance and the same payload can be retried',async()=>{
 const f=await fixture();storage.fail=true;
 try{await expect(submit(f)).rejects.toThrow('storage unavailable')}finally{storage.fail=false}
 expect((await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_events WHERE employee_id=$1',[f.id])).rows).toHaveLength(0);
 const journal=(await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_uploads WHERE employee_id=$1',[f.id])).rows;
 expect(journal).toHaveLength(1);expect(journal[0].state).toBe('pending');
 const saved=await submit(f);expect(saved.id).toBeTruthy();expect((await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_uploads WHERE employee_id=$1',[f.id])).rows).toHaveLength(1);
});
it('DB failure after upload rolls back event/approval/session and preserves a recoverable journal',async()=>{
 const f=await fixture();failInsert=true;
 await expect(submit(f)).rejects.toThrow('simulated connection failure');
 const intent=(await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_uploads WHERE employee_id=$1',[f.id])).rows[0];
 expect(storage.objects.has(String(intent.photo_path))).toBe(true);expect(intent.state).toBe('pending');
 expect((await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_sessions WHERE employee_id=$1',[f.id])).rows).toHaveLength(0);
 const saved=await submit(f);expect(saved.id).toBeTruthy();expect(storage.objects.has(String(intent.photo_path))).toBe(true);
});
it('expired orphan reconciliation removes unreferenced photos but keeps completed evidence',async()=>{
 const f=await fixture();failInsert=true;await expect(submit(f)).rejects.toThrow();
 const intent=(await pg.query<Record<string,unknown>>('SELECT * FROM attendance.attendance_uploads WHERE employee_id=$1',[f.id])).rows[0];
 await pg.query<Record<string,unknown>>("UPDATE attendance.attendance_uploads SET expires_at=now()-interval '1 hour' WHERE id=$1",[intent.id]);
 const completed=await fixture(),saved=await submit(completed),event=(await pg.query<Record<string,unknown>>('SELECT photo_path FROM attendance.attendance_events WHERE id=$1',[saved.id])).rows[0];
 await db.transaction(c=>reconcileUploads(c,storage));
 expect(storage.objects.has(String(intent.photo_path))).toBe(false);expect(storage.objects.has(String(event.photo_path))).toBe(true);
 await expect(submit(f)).rejects.toMatchObject({code:'UPLOAD_EXPIRED'});
});
it('rejects draft/cancelled/future/ended and other employee schedules, and checkout without own session',async()=>{
 const f=await fixture(),other=await fixture();
 for(const status of ['draft','cancelled']){
  await pg.query<Record<string,unknown>>('UPDATE attendance.schedules SET status=$1 WHERE id=$2',[status,f.scheduleId]);
  await expect(submit(f)).rejects.toMatchObject({code:'ATTENDANCE_OUTSIDE_SCHEDULE'});
 }
 await pg.query<Record<string,unknown>>("UPDATE attendance.schedules SET status='published',starts_at=now()+interval '1 hour',ends_at=now()+interval '8 hours' WHERE id=$1",[f.scheduleId]);
 await expect(submit(f)).rejects.toMatchObject({code:'ATTENDANCE_OUTSIDE_SCHEDULE'});
 await expect(submit(f,'check_in',{...f.input,idempotencyKey:randomUUID(),scheduleId:other.scheduleId})).rejects.toMatchObject({code:'ATTENDANCE_OUTSIDE_SCHEDULE'});
 await expect(submit(f,'check_out',{...f.input,idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'NO_OPEN_SESSION'});
});
it('preserves check-in rules for checkout after schedule, radius or store status changes',async()=>{
 const f=await fixture(),saved=await submit(f);
 await pg.query<Record<string,unknown>>("UPDATE attendance.schedules SET status='cancelled',rule_snapshot=$2 WHERE id=$1",[f.scheduleId,JSON.stringify({...rules,store_lat:0,store_lng:0})]);
 await pg.query<Record<string,unknown>>('UPDATE attendance.stores SET is_active=false WHERE id=$1',[storeId]);
 try{
  const checkout=await submit(f,'check_out',{...f.input,idempotencyKey:randomUUID()});expect(checkout.locationStatus).toBe('inside');
  const event=(await pg.query<Record<string,unknown>>('SELECT rule_snapshot FROM attendance.attendance_events WHERE id=$1',[checkout.id])).rows[0].rule_snapshot as Record<string,unknown>;
  expect(event.store_lat).toBe(rules.store_lat);expect(checkout.sessionId).toBe(saved.sessionId);
 }finally{await pg.query<Record<string,unknown>>('UPDATE attendance.stores SET is_active=true WHERE id=$1',[storeId])}
});
it('never fills missing checkout and blocks a new check-in while an old session remains open',async()=>{
 const f=await fixture(),saved=await submit(f);
 const event=(await pg.query<Record<string,unknown>>('SELECT rule_snapshot FROM attendance.attendance_events WHERE id=$1',[saved.id])).rows[0].rule_snapshot as Record<string,unknown>;
 await pg.query<Record<string,unknown>>('UPDATE attendance.attendance_events SET rule_snapshot=$2 WHERE id=$1',[saved.id,JSON.stringify({...event,schedule_ends_at:'2020-01-01T00:00:00Z'})]);
 expect((await service.context(f.token)).open?.missingCheckout).toBe(true);
 expect((await pg.query<Record<string,unknown>>('SELECT check_out_at FROM attendance.attendance_sessions WHERE id=$1',[saved.sessionId])).rows[0].check_out_at).toBeNull();
 await expect(submit(f,'check_in',{...f.input,idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'OPEN_SESSION'});
});
it('authorizes photo access for self and same-business owner only; history has no photo paths',async()=>{
 const f=await fixture(),other=await fixture(),owner=await fixture('owner'),saved=await submit(f);
 expect((await service.photo(f.token,saved.id)).expiresIn).toBe(60);
 expect((await service.photo(owner.token,saved.id)).url).toContain('expires=60');
 const reads=storage.reads;
 await expect(service.photo(other.token,saved.id)).rejects.toMatchObject({status:403});expect(storage.reads).toBe(reads);
 const foreignId=randomUUID();await pg.query<Record<string,unknown>>("INSERT INTO attendance.businesses(id,name) VALUES($1,'Other')",[foreignId]);
 const foreign=await fixture('owner',foreignId),foreignAuth=new AuthService(db,foreignId,'attendance-test-secret-'.repeat(3));
 await expect(new AttendanceService(foreignAuth,storage).photo(foreign.token,saved.id)).rejects.toMatchObject({status:403});
 expect((await service.own(other.token,{})).items).toHaveLength(0);
 const own=await service.own(f.token,{});expect(own.items).toHaveLength(1);expect(JSON.stringify(own)).not.toContain('photo_path');
});
it('revoked, inactive and temporary-PIN sessions cannot submit or read photos',async()=>{
 const f=await fixture(),saved=await submit(f);
 await pg.query<Record<string,unknown>>('UPDATE attendance.auth_sessions SET revoked_at=now() WHERE employee_id=$1',[f.id]);
 await expect(submit(f)).rejects.toMatchObject({status:401});await expect(service.photo(f.token,saved.id)).rejects.toMatchObject({status:401});
 const inactive=await fixture();await pg.query<Record<string,unknown>>("UPDATE attendance.employees SET status='inactive' WHERE id=$1",[inactive.id]);
 await expect(service.context(inactive.token)).rejects.toMatchObject({status:401});
 const temporary=await fixture();await pg.query<Record<string,unknown>>("INSERT INTO attendance.employee_credentials(employee_id,pin_hash,must_change_pin) VALUES($1,'fixture-not-a-login-hash',true)",[temporary.id]);
 await expect(submit(temporary)).rejects.toMatchObject({code:'PIN_CHANGE_REQUIRED'});
});
it('rejects spoofed time/identity, invalid GPS, fake MIME/JPEG, excessive size and strips metadata',async()=>{
 const f=await fixture();
 for(const extra of [{employeeId:f.id},{recordedAt:'2000-01-01T00:00:00Z'},{location:{status:'available',lat:999,lng:0,accuracyM:1}}])await expect(service.submit(f.token,'check_in',{...f.input,...extra},jpeg,'image/jpeg')).rejects.toThrow();
 await expect(validatePhoto(jpeg,'image/png')).rejects.toMatchObject({code:'INVALID_PHOTO'});
 await expect(validatePhoto(new Uint8Array(600000),'image/jpeg')).rejects.toThrow();
 await expect(validatePhoto(new Uint8Array([255,216,255,0,1]),'image/jpeg')).rejects.toThrow();
 const withExif=await sharp(jpeg).withMetadata({exif:{IFD0:{Copyright:'fixture'}}}).jpeg().toBuffer();
 expect((await sharp(await validatePhoto(withExif,'image/jpeg')).metadata()).exif).toBeUndefined();
});
it('HTTP multipart enforces CSRF, login, bounded body and successful authorized upload',async()=>{
 const f=await fixture(),handler=createAttendanceHandler(()=>({attendance:service,origin:'http://localhost:3000',authorize:token=>auth.me(token)}));
 const request=(origin='http://localhost:3000',token:string=f.token)=>{
  const form=new FormData();form.set('metadata',JSON.stringify(f.input));form.set('photo',new Blob([new Uint8Array(jpeg)],{type:'image/jpeg'}),'selfie.jpg');
  return new NextRequest('http://localhost:3000/api/v1/attendance/check-in',{method:'POST',headers:{origin,cookie:cookieName+'='+token},body:form});
 };
 expect((await handler(request('https://evil.example'),'check_in')).status).toBe(403);
 expect((await handler(request('http://localhost:3000','invalid'),'check_in')).status).toBe(401);
 const tooLarge=request();tooLarge.headers.set('content-length','99999999');expect((await handler(tooLarge,'check_in')).status).toBe(413);
 const response=await handler(request(),'check_in');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect((await response.json()).data.id).toBeTruthy();
});
it('configuration failure returns 503 without exposing credentials',async()=>{
 const handler=createAttendanceHandler(()=>{throw new Error('private-configuration-fixture')});
 const response=await handler(new NextRequest('http://localhost:3000/api/v1/me/attendance/context'),'context');
 expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private-configuration-fixture');
});
it('limits durable new upload attempts, including repeated failed validation',async()=>{
 const f=await fixture();
 await pg.query<Record<string,unknown>>(`INSERT INTO attendance.attendance_uploads(employee_id,idempotency_key,payload_hash,photo_path,expires_at) SELECT $1,gen_random_uuid(),'hash','fixture',now()+interval '1 day' FROM generate_series(1,20)`,[f.id]);
 await expect(submit(f)).rejects.toMatchObject({status:429});
});
it('storage adapter refuses public buckets and uses private upload/sign/delete endpoints',async()=>{
 let isPublic=true;const calls:{url:string;init?:RequestInit}[]=[];
 const send=async(url:URL|RequestInfo,init?:RequestInit)=>{
  calls.push({url:String(url),init});return Response.json(String(url).includes('/bucket/')?{public:isPublic}:String(url).includes('/object/sign/')?{signedURL:'/object/sign/photos/biz/photo.jpg?token=fixture'}:{});
 };
 const provider=new SupabaseStorage('https://fixture.supabase.co','server-secret-fixture','photos',send);
 const path=`${randomUUID()}/${randomUUID()}/${randomUUID()}.jpg`;
 await expect(provider.uploadPrivate(path,jpeg)).rejects.toMatchObject({code:'STORAGE_UNSAFE'});
 expect(calls).toHaveLength(1);isPublic=false;
 await provider.uploadPrivate(path,jpeg);expect(calls.at(-1)?.init?.method).toBe('POST');
 expect(await provider.getSignedReadUrl(path,60)).toMatch(/^https:\/\/fixture.supabase.co\/storage\/v1\/object\/sign\//);
 await provider.delete(path);expect(calls.at(-1)?.init?.method).toBe('DELETE');
 await expect(provider.uploadPrivate('../private.jpg',jpeg)).rejects.toThrow('Invalid photo path');
});
