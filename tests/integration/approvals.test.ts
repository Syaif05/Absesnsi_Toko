import { readFileSync,readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { NextRequest } from 'next/server';
import { AuthService } from '../../src/server/auth/service';
import { tokenHash } from '../../src/server/auth/crypto';
import type { AuthDatabase } from '../../src/server/auth/types';
import { ApprovalService } from '../../src/server/approvals/service';
import { createApprovalHandler } from '../../src/server/approvals/http';
import { AttendanceService } from '../../src/server/attendance/service';
import { cookieName } from '../../src/server/auth/http';
import type { CorrectionField } from '../../src/server/approvals/models';
import sharp from 'sharp';
const pg=new PGlite({extensions:{btree_gist}}),businessId=randomUUID(),storeId=randomUUID();
let failAudit=false;
const db:AuthDatabase={transaction:work=>pg.transaction(tx=>work({query:async(text,values)=>{
 if(failAudit&&text.includes('INSERT INTO attendance.audit_logs')&&String(values?.[1]).startsWith('approval.')){failAudit=false;throw new Error('simulated audit failure')}
 return tx.query(text,values);
}}))};
const auth=new AuthService(db,businessId,'approval-test-secret-'.repeat(4)),service=new ApprovalService(auth);
const handler=createApprovalHandler(()=>({approvals:service,origin:'http://localhost:3000'}));
let owner:{id:string;token:string},otherOwner:{id:string;token:string},jpeg:Buffer;
const q=(text:string,values?:unknown[])=>pg.query<Record<string,unknown>>(text,values);
async function actor(role='employee',biz=businessId){
 const id=randomUUID(),token=randomUUID();await q("INSERT INTO attendance.employees(id,business_id,employee_code,full_name,role) VALUES($1,$2,$3,'Pengguna tes fiktif',$4)",[id,biz,id,role]);
 await q("INSERT INTO attendance.auth_sessions(employee_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",[id,tokenHash(token)]);return {id,token};
}
const iso=(v:unknown)=>v instanceof Date?v.toISOString():String(v);
async function fixture(options:{pending?:boolean;checkout?:boolean;missing?:boolean}={}){
 const employee=await actor(),scheduleId=randomUUID();
 const schedule=(await q("INSERT INTO attendance.schedules(id,employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot) VALUES($1,$2,$3,now()-interval '8 hours',now()-interval '1 hour','published',$4,$5) RETURNING *",[scheduleId,employee.id,storeId,owner.id,JSON.stringify({radius_m:100,accuracy_m:100,store_lat:-6.2,store_lng:106.8,grace_minutes:5})])).rows[0];
 const start=iso(schedule.starts_at),end=iso(schedule.ends_at),rules={...(schedule.rule_snapshot as object),store_id:storeId,store_name:'Toko jadwal tes',schedule_starts_at:start,schedule_ends_at:end};
 let sessionId:string|null=null,eventId:string|null=null,approvalId:string|null=null;
 const checkIn=new Date(Date.parse(start)+10*60000).toISOString(),checkOut=new Date(Date.parse(end)-10*60000).toISOString();
 if(!options.missing){
  sessionId=String((await q('INSERT INTO attendance.attendance_sessions(employee_id,schedule_id,check_in_at,check_out_at,status,rule_snapshot) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[employee.id,scheduleId,checkIn,options.checkout?checkOut:null,options.pending?'needs_review':options.checkout?'completed':'open',JSON.stringify(rules)])).rows[0].id);
  eventId=String((await q(`INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,recorded_at,photo_path,lat,lng,accuracy_m,distance_m,location_status,review_status,reason,idempotency_key,rule_snapshot) VALUES($1,$2,$3,'check_in',$4,'fixture/selfie.jpg',-6.2,106.8,25,150,$5,$6,$7,$8,$9) RETURNING id`,[sessionId,employee.id,storeId,checkIn,options.pending?'outside':'inside',options.pending?'pending':'not_required',options.pending?'Penugasan di luar area':null,randomUUID(),JSON.stringify(rules)])).rows[0].id);
  if(options.checkout)await q(`INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,recorded_at,photo_path,location_status,review_status,idempotency_key,rule_snapshot) VALUES($1,$2,$3,'check_out',$4,'fixture/pulang.jpg','inside','not_required',$5,$6)`,[sessionId,employee.id,storeId,checkOut,randomUUID(),JSON.stringify(rules)]);
  if(options.pending)approvalId=String((await q("INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason) VALUES($1,'location_exception','attendance_event',$2,'Penugasan di luar area') RETURNING id",[employee.id,eventId])).rows[0].id);
 }
 return {...employee,scheduleId,sessionId,eventId,approvalId,start,end,checkIn,checkOut,rules};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
const input=(f:Fixture,fields:CorrectionField[]=['check_in_at'])=>({type:'attendance_correction' as const,requestKey:randomUUID(),scheduleId:f.scheduleId,reason:'Memperbaiki waktu sesuai kejadian sebenarnya',changes:fields.map(field=>({field,value:field==='check_in_at'?f.start:f.checkOut}))});
const decide=(id:string,status:'approved'|'rejected'='approved',token=owner.token)=>service.decide(token,id,{status,note:'Sudah diperiksa bersama bukti',confirmed:true});
function req(method:string,body?:unknown,token=owner.token,origin='http://localhost:3000'){
 return new NextRequest('http://localhost:3000/api/v1/approvals',{method,headers:{origin,'content-type':'application/json',cookie:cookieName+'='+token},body:body===undefined?undefined:JSON.stringify(body)});
}
beforeAll(async()=>{
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync('drizzle/'+file,'utf8'));
 await q("INSERT INTO attendance.businesses(id,name) VALUES($1,'Usaha tes')",[businessId]);
 await q("INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng) VALUES($1,$2,'TEST','Toko jadwal tes','Alamat tes',-6.2,106.8)",[storeId,businessId]);
 owner=await actor('owner');otherOwner=await actor('owner');jpeg=await sharp({create:{width:320,height:400,channels:3,background:'#8095f5'}}).jpeg().toBuffer();
},30000);
afterAll(()=>pg.close());
it('employee correction stays pending with immutable before/requested values and own detail',async()=>{
 const f=await fixture({checkout:true}),body=input(f),created=await service.submit(f.token,body);
 expect(created.status).toBe('pending');expect(created.corrections[0]).toEqual({field:'check_in_at',oldValue:f.checkIn,requestedValue:f.start,appliedValue:null});
 expect(created.session?.checkInAt).toBe(f.checkIn);expect(created.evidence[0].recordedAt).toBe(f.checkIn);
 expect(JSON.stringify(created)).not.toContain('photo_path');expect((await service.list(f.token,{view:'mine'})).items.map(v=>v.id)).toContain(created.id);
 const duplicate=await service.submit(f.token,body);expect(duplicate.id).toBe(created.id);
 expect((await q('SELECT attempts FROM attendance.auth_rate_limits WHERE key=$1',['approval:submit:'+f.id])).rows[0].attempts).toBe(1);
 await expect(service.submit(f.token,{...body,reason:'Alasan berubah setelah dikirim'})).rejects.toMatchObject({status:409});
 expect((await q('SELECT * FROM attendance.attendance_corrections WHERE approval_request_id=$1',[created.id])).rows).toHaveLength(1);
});
it('approval applies official time atomically, recomputes late, preserves original events and reviewer',async()=>{
 const f=await fixture({checkout:true}),created=await service.submit(f.token,input(f)),before=Date.now(),approved=await decide(created.id);
 expect(approved.status).toBe('approved');expect(approved.session?.checkInAt).toBe(f.start);expect(approved.session?.late).toBe(false);expect(approved.session?.status).toBe('corrected');
 expect(approved.evidence[0].recordedAt).toBe(f.checkIn);expect(approved.corrections[0].appliedValue).toBe(f.start);expect(approved.reviewerName).toBeTruthy();expect(Date.parse(approved.decidedAt!)).toBeGreaterThanOrEqual(before-1000);
 const audit=(await q("SELECT * FROM attendance.audit_logs WHERE entity_id=$1 AND action='approval.approved'",[created.id])).rows;
 expect(audit).toHaveLength(1);expect((audit[0].metadata_redacted as {before:{check_in_at:string}}).before.check_in_at).toBe(f.checkIn);
});
it('rejection keeps official times and original evidence, with no applied value',async()=>{
 const f=await fixture({checkout:true}),created=await service.submit(f.token,input(f)),rejected=await decide(created.id,'rejected');
 expect(rejected.status).toBe('rejected');expect(rejected.session?.checkInAt).toBe(f.checkIn);expect(rejected.session?.isCorrected).toBe(false);expect(rejected.corrections[0].appliedValue).toBeNull();
 await expect(decide(created.id)).rejects.toMatchObject({status:409});
});
it('approves pending location and computes completed/open correctly',async()=>{
 for(const checkout of [false,true]){
  const f=await fixture({pending:true,checkout}),approved=await decide(f.approvalId!);
  expect(approved.evidence[0].reviewStatus).toBe('approved');expect(approved.evidence[0].locationStatus).toBe('outside');expect(approved.session?.status).toBe(checkout?'completed':'open');
 }
});
it('rejects location without deleting the attempt or allowing a second decision',async()=>{
 const f=await fixture({pending:true,checkout:true}),rejected=await decide(f.approvalId!,'rejected');
 expect(rejected.evidence).toHaveLength(2);expect(rejected.evidence[0].reviewStatus).toBe('rejected');expect(rejected.session?.status).toBe('needs_review');
 await expect(decide(f.approvalId!,'approved')).rejects.toMatchObject({status:409});
});
it('double decision from two owner sessions produces one result and one audit',async()=>{
 const f=await fixture({pending:true}),results=await Promise.allSettled([decide(f.approvalId!,'approved'),decide(f.approvalId!,'rejected',otherOwner.token)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 expect((await q("SELECT * FROM attendance.audit_logs WHERE entity_id=$1 AND action IN ('approval.approved','approval.rejected')",[f.approvalId])).rows).toHaveLength(1);
});
it('keeps correction history across successive approvals',async()=>{
 const f=await fixture({checkout:true}),first=await service.submit(f.token,input(f));await decide(first.id);
 const second=await service.submit(f.token,{...input(f),changes:[{field:'check_in_at',value:new Date(Date.parse(f.start)+60000).toISOString()}]});
 expect(second.corrections[0].oldValue).toBe(f.start);await decide(second.id);
 expect((await service.get(f.token,first.id)).corrections[0].appliedValue).toBe(f.start);
 expect((await service.get(f.token,second.id)).evidence[0].recordedAt).toBe(f.checkIn);
});
it('one pending correction per schedule and duplicate field changes are rejected',async()=>{
 const f=await fixture(),created=await service.submit(f.token,input(f));
 await expect(service.submit(f.token,input(f))).rejects.toMatchObject({status:409});
 await expect(service.submit(f.token,{...input(f),changes:[{field:'check_in_at',value:f.start},{field:'check_in_at',value:f.start}]})).rejects.toThrow();
 await expect(q("INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason) VALUES($1,'attendance_correction','schedule',$2,'Concurrent duplicate')",[f.id,f.scheduleId])).rejects.toThrow();
 expect((await service.get(f.token,created.id)).status).toBe('pending');
});
it('stale baseline after a real checkout blocks approval and allows rejection',async()=>{
 const f=await fixture(),created=await service.submit(f.token,input(f));
 await q('UPDATE attendance.attendance_sessions SET check_out_at=$1 WHERE id=$2',[f.checkOut,f.sessionId]);
 await expect(decide(created.id)).rejects.toMatchObject({code:'APPROVAL_CONFLICT'});
 expect((await service.get(f.token,created.id)).corrections[0].appliedValue).toBeNull();
 expect((await decide(created.id,'rejected')).status).toBe('rejected');
});
it('missing checkout is filled only by an approved correction, without a fabricated event',async()=>{
 const f=await fixture(),created=await service.submit(f.token,input(f,['check_out_at']));
 expect(created.session?.checkOutAt).toBeNull();const approved=await decide(created.id);
 expect(approved.session?.checkOutAt).toBe(f.checkOut);expect(approved.session?.status).toBe('corrected');expect(approved.evidence).toHaveLength(1);expect(approved.evidence[0].eventType).toBe('check_in');
});
it('missing check-in/out on a published schedule creates a corrected session after approval only',async()=>{
 const f=await fixture({missing:true}),created=await service.submit(f.token,input(f,['check_in_at','check_out_at']));
 expect(created.session).toBeNull();expect(created.evidence).toHaveLength(0);
 const approved=await decide(created.id);expect(approved.session?.checkInAt).toBe(f.start);expect(approved.session?.checkOutAt).toBe(f.checkOut);expect(approved.session?.status).toBe('corrected');expect(approved.evidence).toHaveLength(0);
});
it('approved missing check-in permits camera/GPS checkout using stored rules',async()=>{
 const f=await fixture({missing:true}),created=await service.submit(f.token,input(f));await decide(created.id);
 const attendance=new AttendanceService(auth,{uploadPrivate:async()=>{},getSignedReadUrl:async()=>'',delete:async()=>{}});
 const context=await attendance.context(f.token);expect(context.open?.scheduleId).toBe(f.scheduleId);expect(context.open?.missingCheckout).toBe(true);
 const checkout=await attendance.submit(f.token,'check_out',{idempotencyKey:randomUUID(),scheduleId:f.scheduleId,location:{status:'available',lat:-6.2,lng:106.8,accuracyM:20},reason:''},jpeg,'image/jpeg');
 expect(checkout.locationStatus).toBe('inside');expect((await service.get(f.token,created.id)).session?.status).toBe('corrected');
});
it('correcting time never clears an outstanding or rejected location review',async()=>{
 const f=await fixture({pending:true,checkout:true}),correction=await service.submit(f.token,input(f));
 expect((await decide(correction.id)).session?.status).toBe('needs_review');
 expect((await decide(f.approvalId!)).session?.status).toBe('corrected');
});
it('failed audit rolls back approval, session time, applied value and event review',async()=>{
 const f=await fixture({checkout:true}),created=await service.submit(f.token,input(f));failAudit=true;
 await expect(decide(created.id)).rejects.toThrow('simulated audit failure');
 const unchanged=await service.get(f.token,created.id);expect(unchanged.status).toBe('pending');expect(unchanged.session?.checkInAt).toBe(f.checkIn);expect(unchanged.corrections[0].appliedValue).toBeNull();
 const location=await fixture({pending:true});failAudit=true;await expect(decide(location.approvalId!)).rejects.toThrow();expect((await service.get(location.token,location.approvalId!)).evidence[0].reviewStatus).toBe('pending');
});
it('original events, requested corrections, request contents, decisions and audit cannot be rewritten',async()=>{
 const f=await fixture({checkout:true}),created=await service.submit(f.token,input(f));
 await expect(q("UPDATE attendance.attendance_events SET recorded_at=now() WHERE id=$1",[f.eventId])).rejects.toThrow('immutable');
 await expect(q("UPDATE attendance.attendance_events SET photo_path='replaced.jpg' WHERE id=$1",[f.eventId])).rejects.toThrow('immutable');
 await expect(q('DELETE FROM attendance.attendance_events WHERE id=$1',[f.eventId])).rejects.toThrow();
 await expect(q("UPDATE attendance.attendance_corrections SET requested_value='\"2000-01-01T00:00:00Z\"'::jsonb WHERE approval_request_id=$1",[created.id])).rejects.toThrow('immutable');
 await expect(q("UPDATE attendance.approval_requests SET reason='Changed reason' WHERE id=$1",[created.id])).rejects.toThrow('immutable');
 await decide(created.id);
 await expect(q('UPDATE attendance.attendance_corrections SET applied_value=null WHERE approval_request_id=$1',[created.id])).rejects.toThrow('immutable');
 await expect(q("UPDATE attendance.approval_requests SET decision_note='Changed note' WHERE id=$1",[created.id])).rejects.toThrow();
 await expect(q('DELETE FROM attendance.approval_requests WHERE id=$1',[created.id])).rejects.toThrow();
 await expect(q("DELETE FROM attendance.audit_logs WHERE entity_id=$1",[created.id])).rejects.toThrow();
});
it('rejects corrections for other employees, future/unpublished schedules, future times and inverted dates',async()=>{
 const f=await fixture(),other=await fixture();
 await expect(service.submit(other.token,input(f))).rejects.toMatchObject({status:404});
 await expect(service.submit(f.token,{...input(f),changes:[{field:'check_in_at',value:new Date(Date.now()+86400000).toISOString()}]})).rejects.toMatchObject({code:'INVALID_CORRECTION'});
 await expect(service.submit(f.token,{...input(f,['check_out_at']),changes:[{field:'check_out_at',value:new Date(Date.parse(f.checkIn)-60000).toISOString()}]})).rejects.toMatchObject({code:'INVALID_CORRECTION'});
 const missing=await fixture({missing:true});await q("UPDATE attendance.schedules SET status='draft' WHERE id=$1",[missing.scheduleId]);
 await expect(service.submit(missing.token,input(missing))).rejects.toMatchObject({status:409});
 await expect(service.submit(f.token,{...input(f),employeeId:other.id})).rejects.toThrow();
});
it('employee and manager cannot decide or read another employee request; cross-business owner is blocked',async()=>{
 const f=await fixture({pending:true}),other=await fixture(),manager=await actor('manager');
 await expect(decide(f.approvalId!,'approved',f.token)).rejects.toMatchObject({status:403});
 await expect(decide(f.approvalId!,'approved',manager.token)).rejects.toMatchObject({status:403});
 await expect(service.get(other.token,f.approvalId!)).rejects.toMatchObject({status:404});
 await expect(service.list(f.token,{view:'inbox'})).rejects.toMatchObject({status:403});
 const foreignId=randomUUID();await q("INSERT INTO attendance.businesses(id,name) VALUES($1,'Foreign business')",[foreignId]);
 const foreign=await actor('owner',foreignId),foreignAuth=new AuthService(db,foreignId,'approval-test-secret-'.repeat(4)),foreignService=new ApprovalService(foreignAuth);
 await expect(foreignService.get(foreign.token,f.approvalId!)).rejects.toMatchObject({status:404});
 await expect(foreignService.decide(foreign.token,f.approvalId!,{status:'approved',note:'Tinjau bukti',confirmed:true})).rejects.toMatchObject({status:404});
});
it('inactive/revoked and temporary-PIN sessions are denied for submissions and detail',async()=>{
 const f=await fixture({pending:true});await q('UPDATE attendance.auth_sessions SET revoked_at=now() WHERE employee_id=$1',[f.id]);
 await expect(service.get(f.token,f.approvalId!)).rejects.toMatchObject({status:401});
 const temp=await fixture();await q("INSERT INTO attendance.employee_credentials(employee_id,pin_hash,must_change_pin) VALUES($1,'fixture-not-login',true)",[temp.id]);
 await expect(service.submit(temp.token,input(temp))).rejects.toMatchObject({code:'PIN_CHANGE_REQUIRED'});
 const inactive=await fixture();await q("UPDATE attendance.employees SET status='inactive' WHERE id=$1",[inactive.id]);await expect(service.targets(inactive.token,{})).rejects.toMatchObject({status:401});
});
it('location submissions reuse the existing automatic pending request and cannot bypass an inside event',async()=>{
 const f=await fixture({pending:true}),created=await service.submit(f.token,{type:'location_exception',requestKey:randomUUID(),eventId:f.eventId,reason:'Penugasan di luar area'});
 expect(created.id).toBe(f.approvalId);expect((await q("SELECT * FROM attendance.approval_requests WHERE target_id=$1",[f.eventId])).rows).toHaveLength(1);
 const inside=await fixture();await expect(service.submit(inside.token,{type:'location_exception',requestKey:randomUUID(),eventId:inside.eventId,reason:'Ingin mengganti status'})).rejects.toMatchObject({status:409});
});
it('lists owner inbox with filters, employee own data, targets, pagination and history',async()=>{
 const f=await fixture({pending:true});expect((await service.list(f.token,{})).items.every(r=>r.requesterId===f.id)).toBe(true);
 const own=await service.targets(f.token,{});expect(own.items.map(r=>r.scheduleId)).toContain(f.scheduleId);expect(own.items.every(r=>r.storeName==='Toko jadwal tes')).toBe(true);
 const pending=await service.list(owner.token,{view:'inbox',status:'pending',type:'location_exception',storeId});expect(pending.items.every(r=>r.status==='pending'&&r.type==='location_exception')).toBe(true);
 const full=await service.list(owner.token,{});expect(full.items).toHaveLength(20);expect(full.hasMore).toBe(true);const next=await service.list(owner.token,{offset:20});expect(next.items.some(r=>full.items.some(v=>v.id===r.id))).toBe(false);
});
it('HTTP validates CSRF, confirmation, reason, size and role; returns no-store and safe 503',async()=>{
 const f=await fixture({pending:true});
 expect((await handler(req('POST',{status:'approved',note:'Tinjau bukti',confirmed:true},owner.token,'https://evil.example'),'decision',f.approvalId!)).status).toBe(403);
 expect((await handler(req('POST',{status:'approved',note:'Tinjau bukti'}),'decision',f.approvalId!)).status).toBe(400);
 expect((await handler(req('POST',{status:'approved',note:'',confirmed:true}),'decision',f.approvalId!)).status).toBe(400);
 expect((await handler(req('POST',{status:'approved',note:'Tinjau bukti',confirmed:true},f.token),'decision',f.approvalId!)).status).toBe(403);
 expect((await handler(req('POST',{...input(f),reason:'x'.repeat(5000)},f.token),'requests')).status).toBe(400);
 const response=await handler(req('GET',undefined,f.token),'requests',f.approvalId!);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 const unavailable=createApprovalHandler(()=>{throw new Error('private-secret-fixture')});const failure=await unavailable(req('GET'),'requests');expect(failure.status).toBe(503);expect(JSON.stringify(await failure.json())).not.toContain('private-secret-fixture');
});
it('schedule edits invalidate missing-session proposals while existing evidence still permits correction',async()=>{
 const missing=await fixture({missing:true}),request=await service.submit(missing.token,input(missing));
 await q('UPDATE attendance.schedules SET version=version+1 WHERE id=$1',[missing.scheduleId]);
 await expect(decide(request.id)).rejects.toMatchObject({status:409});expect((await service.get(missing.token,request.id)).session).toBeNull();
 const existing=await fixture();await q("UPDATE attendance.schedules SET starts_at=now()+interval '1 hour',ends_at=now()+interval '8 hours',version=version+1 WHERE id=$1",[existing.scheduleId]);
 const correction=await service.submit(existing.token,input(existing));expect((await decide(correction.id)).session?.checkInAt).toBe(existing.start);
});
it('missing-check-in approval cannot open a second work session for the same employee',async()=>{
 const f=await fixture({missing:true}),created=await service.submit(f.token,input(f));
 const prior=(await q("INSERT INTO attendance.schedules(employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot) VALUES($1,$2,now()-interval '24 hours',now()-interval '16 hours','published',$3,$4) RETURNING id",[f.id,storeId,owner.id,JSON.stringify(f.rules)])).rows[0];
 await q("INSERT INTO attendance.attendance_sessions(employee_id,schedule_id,check_in_at) VALUES($1,$2,now()-interval '23 hours')",[f.id,prior.id]);
 await expect(decide(created.id)).rejects.toMatchObject({status:409});expect((await service.get(f.token,created.id)).session).toBeNull();
});
it('historical timezone from schedule remains explicit after business timezone changes',async()=>{
 const f=await fixture();await q(`UPDATE attendance.schedules SET rule_snapshot=rule_snapshot || '{"timezone":"Asia/Jakarta"}'::jsonb WHERE id=$1`,[f.scheduleId]);
 await q("UPDATE attendance.businesses SET timezone='Asia/Makassar' WHERE id=$1",[businessId]);
 try{
  expect((await service.targets(f.token,{})).items[0].timezone).toBe('Asia/Jakarta');
  expect((await service.submit(f.token,input(f))).timezone).toBe('Asia/Jakarta');
 }finally{await q("UPDATE attendance.businesses SET timezone='Asia/Jakarta' WHERE id=$1",[businessId])}
});
it('a revoked owner session cannot decide and leaves the request pending',async()=>{
 const f=await fixture({pending:true}),revoked=await actor('owner');await q('UPDATE attendance.auth_sessions SET revoked_at=now() WHERE employee_id=$1',[revoked.id]);
 await expect(decide(f.approvalId!,'approved',revoked.token)).rejects.toMatchObject({status:401});expect((await service.get(f.token,f.approvalId!)).status).toBe('pending');
});
it('decision rate limit persists when a decision fails and does not change request state',async()=>{
 const f=await fixture({pending:true});await q("INSERT INTO attendance.auth_rate_limits(key,attempts,resets_at) VALUES($1,60,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=60,resets_at=excluded.resets_at",['approval:decision:'+otherOwner.id]);
 await expect(decide(f.approvalId!,'approved',otherOwner.token)).rejects.toMatchObject({status:429});
 expect((await service.get(f.token,f.approvalId!)).status).toBe('pending');
 expect((await q('SELECT attempts FROM attendance.auth_rate_limits WHERE key=$1',['approval:decision:'+otherOwner.id])).rows[0].attempts).toBe(61);
});
