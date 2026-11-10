import { readFileSync,readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { NextRequest } from 'next/server';
import { AuthService } from '../../src/server/auth/service';
import { tokenHash } from '../../src/server/auth/crypto';
import type { AuthDatabase } from '../../src/server/auth/types';
import { ReportingService } from '../../src/server/reporting/service';
import { createReportingHandler } from '../../src/server/reporting/http';
import { cookieName } from '../../src/server/auth/http';
import { dayAfter } from '../../src/lib/schedule-dates';
const pg=new PGlite({extensions:{btree_gist}}),businessId=randomUUID(),stores=[randomUUID(),randomUUID()];
const db:AuthDatabase={transaction:work=>pg.transaction(tx=>work({query:(text,values)=>tx.query(text,values)}))};
const auth=new AuthService(db,businessId,'reporting-test-secret-'.repeat(4)),service=new ReportingService(auth),handler=createReportingHandler(()=>({reporting:service}));
const q=(sql:string,args?:unknown[])=>pg.query<Record<string,unknown>>(sql,args);
let owner:{id:string;token:string},today:string,past:string,range:{from:string;to:string},normal:Shift,pending:Shift,rejected:Shift,corrected:Shift,missing:Shift,second:Shift;
async function actor(role='employee',biz=businessId){
 const id=randomUUID(),token=randomUUID();await q("INSERT INTO attendance.employees(id,business_id,employee_code,full_name,role,primary_store_id) VALUES($1,$2,$3,'Karyawan fiktif',$4,$5)",[id,biz,id,role,biz===businessId?stores[0]:null]);
 await q("INSERT INTO attendance.auth_sessions(employee_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')",[id,tokenHash(token)]);return {id,token};
}
async function shift(options:{store?:number;date?:string;employee?:{id:string;token:string};status?:string;record?:boolean;out?:boolean;reviews?:string[];corrected?:boolean;late?:boolean}={}){
 const employee=options.employee??await actor(),scheduleId=randomUUID(),date=options.date??past,storeId=stores[options.store??0];
 const start=new Date(date+'T08:00:00+07:00').toISOString(),end=new Date(date+'T16:00:00+07:00').toISOString();
 const rules={timezone:'Asia/Jakarta',store_id:storeId,store_name:'Toko '+(options.store??0),store_lat:-6.2,store_lng:106.8,radius_m:100,accuracy_m:100,grace_minutes:5,schedule_starts_at:start,schedule_ends_at:end};
 await q("INSERT INTO attendance.schedules(id,employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[scheduleId,employee.id,storeId,start,end,options.status??'published',owner.id,JSON.stringify(rules)]);
 let sessionId:string|null=null;const eventIds:string[]=[];
 const checkIn=new Date(Date.parse(start)+(options.late?10:2)*60000).toISOString(),checkOut=end;
 if(options.record){
  sessionId=String((await q('INSERT INTO attendance.attendance_sessions(employee_id,schedule_id,check_in_at,check_out_at,is_corrected,rule_snapshot) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[employee.id,scheduleId,options.corrected?start:checkIn,options.out===false?null:checkOut,!!options.corrected,JSON.stringify(rules)])).rows[0].id);
  if(!options.corrected){
   for(const [i,type] of ['check_in',...(options.out===false?[]:['check_out'])].entries()){
    const review=options.reviews?.[i]??'not_required';
    const id=String((await q(`INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,recorded_at,photo_path,location_status,review_status,idempotency_key,rule_snapshot) VALUES($1,$2,$3,$4,$5,'fixture/photo.jpg',$6,$7,$8,$9) RETURNING id`,[sessionId,employee.id,storeId,type,i===0?checkIn:checkOut,review==='not_required'?'inside':'outside',review,randomUUID(),JSON.stringify(rules)])).rows[0].id);eventIds.push(id);
    if(review==='pending'||review==='rejected')await q(`INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason,status,reviewer_id,decided_at) VALUES($1,'location_exception','attendance_event',$2,'Alasan tes lokasi',$3,$4,$5)`,[employee.id,id,review,review==='rejected'?owner.id:null,review==='rejected'?new Date().toISOString():null]);
   }
  }
 }
 return {...employee,scheduleId,sessionId,eventIds,storeId,start,end,checkIn,checkOut};
}
type Shift=Awaited<ReturnType<typeof shift>>;
const params=(extra:Record<string,unknown>={})=>({...range,...extra});
beforeAll(async()=>{
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync('drizzle/'+file,'utf8'));
 await q("INSERT INTO attendance.businesses(id,name) VALUES($1,'Usaha Nyata Tes')",[businessId]);
 for(const [index,id] of stores.entries())await q("INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng) VALUES($1,$2,$3,$4,'Alamat tes',-6.2,106.8)",[id,businessId,'S'+index,'Toko '+index]);
 owner=await actor('owner');today=(await service.context(owner.token)).today;past=dayAfter(today,-3);range={from:past,to:dayAfter(today,2)};
 normal=await shift({record:true});pending=await shift({record:true,reviews:['pending','pending']});rejected=await shift({record:true,reviews:['rejected','pending']});
 await shift({store:1});corrected=await shift({store:1,record:true,corrected:true});await shift({store:1,date:dayAfter(today,1)});
 await shift({status:'draft'});await shift({status:'cancelled'});await shift({status:'cancelled',record:true});
 second=await shift({employee:{id:normal.id,token:normal.token},store:1,date:dayAfter(past,1),record:true,late:true});missing=await shift({record:true,out:false});
 await q("INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason) VALUES($1,'attendance_correction','schedule',$2,'Waktu perlu ditinjau')",[normal.id,normal.scheduleId]);
},30000);
afterAll(()=>pg.close());
it('counts one shift once, with disjoint categories and no inflation from two events or approvals',async()=>{
 const summary=await service.summary(owner.token,params());expect(summary.businessName).toBe('Usaha Nyata Tes');
 expect(summary.metrics).toEqual({total:9,recorded:7,valid:5,pending:1,rejected:1,notRecorded:1,upcoming:1,employees:8,late:1,missingCheckout:1});
 expect(summary.pendingRequests).toBe(4);const m=summary.metrics;expect(m.valid+m.pending+m.rejected+m.notRecorded+m.upcoming).toBe(m.total);
 expect(summary.daily.reduce((n,d)=>n+d.total,0)).toBe(m.total);expect(summary.daily).toHaveLength(5);
});
it('two-store grouping is based on scheduled store, not employee home store',async()=>{
 const a=await service.summary(owner.token,params({storeId:stores[0]})),b=await service.summary(owner.token,params({storeId:stores[1]}));expect(a.metrics.total).toBe(5);expect(b.metrics.total).toBe(4);
 expect((await service.summary(owner.token,params({employeeId:normal.id,storeId:stores[1]}))).metrics.total).toBe(1);
 const branches=await service.stores(owner.token,params());expect(branches.items).toHaveLength(2);expect(branches.items.reduce((n,s)=>n+s.metrics.total,0)).toBe(9);
});
it('rejection has precedence over another pending event and no unreviewed category is counted as valid',async()=>{
 const history=await service.history(owner.token,params({employeeId:rejected.id}));expect(history.items[0].category).toBe('rejected');
 const p=await service.history(owner.token,params({employeeId:pending.id}));expect(p.items[0].category).toBe('pending');
});
it('corrected attendance without a camera event is valid, keeps effective time and has no fabricated photo',async()=>{
 const detail=await service.detail(owner.token,corrected.sessionId!,{});expect(detail.attendance.category).toBe('valid');expect(detail.attendance.checkInAt).toBe(corrected.start);expect(detail.attendance.isCorrected).toBe(true);expect(detail.events).toHaveLength(0);
});
it('history filters categories and orders deterministically, includes cancelled history but excludes empty drafts/cancellations',async()=>{
 const valid=await service.history(owner.token,params({category:'valid'}));expect(valid.items).toHaveLength(5);expect(valid.items.every(r=>r.category==='valid')).toBe(true);expect(valid.items.some(r=>r.scheduleStatus==='cancelled')).toBe(true);
 const all=await service.history(owner.token,params());expect(all.items).toHaveLength(9);expect(all.items.every(r=>r.scheduleStatus!=='draft')).toBe(true);
});
it('employee detail combines scoped metrics with paginated history and counts unique employees correctly',async()=>{
 const employee=await service.employee(owner.token,normal.id,params());expect(employee.employee.id).toBe(normal.id);expect(employee.summary.metrics.total).toBe(2);expect(employee.summary.metrics.employees).toBe(1);expect(employee.history.items).toHaveLength(2);
});
it('session detail shows original evidence and official time separately with private paths omitted',async()=>{
 const detail=await service.detail(normal.token,normal.sessionId!,{});expect(detail.events).toHaveLength(2);expect(detail.events[0].recordedAt).toBe(normal.checkIn);expect(detail.events[0].photoAvailable).toBe(true);expect(JSON.stringify(detail)).not.toContain('photo_path');expect(detail.requests.items).toHaveLength(1);
 await expect(service.detail(pending.token,normal.sessionId!,{})).rejects.toMatchObject({status:404});
});
it('latest activity is newest-first and includes actual event and approval submission/decision actions',async()=>{
 const activity=await service.activity(owner.token,params());expect(activity.items.some(r=>r.kind==='check_in'||r.kind==='check_out')).toBe(true);expect(activity.items.some(r=>r.kind==='approval_submitted')).toBe(true);expect(activity.items.some(r=>r.kind==='rejected')).toBe(true);
 expect(new Set(activity.items.map(r=>r.id)).size).toBe(activity.items.length);expect(activity.items.every((r,i)=>i===0||Date.parse(activity.items[i-1].at)>=Date.parse(r.at))).toBe(true);
 const own=await service.activity(owner.token,params({employeeId:normal.id,storeId:stores[1]}));expect(own.items.every(r=>r.employeeId===normal.id)).toBe(true);
});
it('invalid ranges and unexpected filters fail safely',async()=>{
 for(const values of [{from:today,to:today},{from:today,to:dayAfter(today,32)},{from:'2026-02-30',to:today},{...range,offset:1},{...range,employeeId:'invalid'}])await expect(service.summary(owner.token,values)).rejects.toThrow();
 await expect(service.history(owner.token,params({category:'approved'}))).rejects.toThrow();await expect(service.stores(owner.token,params({offset:-1}))).rejects.toThrow();
});
it('employees/managers cannot read monitoring or reports; revoked and temporary-PIN sessions fail',async()=>{
 await expect(service.summary(normal.token,params())).rejects.toMatchObject({status:403});
 const manager=await actor('manager');await expect(service.history(manager.token,params())).rejects.toMatchObject({status:403});
 const revoked=await actor('owner');await q('UPDATE attendance.auth_sessions SET revoked_at=now() WHERE employee_id=$1',[revoked.id]);await expect(service.context(revoked.token)).rejects.toMatchObject({status:401});
 const temporary=await actor();await q("INSERT INTO attendance.employee_credentials(employee_id,pin_hash,must_change_pin) VALUES($1,'fixture-not-login',true)",[temporary.id]);await expect(service.detail(temporary.token,normal.sessionId!,{})).rejects.toMatchObject({code:'PIN_CHANGE_REQUIRED'});
});
it('cross-business store, employee filters and session detail are inaccessible',async()=>{
 const foreign=randomUUID(),foreignStore=randomUUID();await q("INSERT INTO attendance.businesses(id,name) VALUES($1,'Foreign business')",[foreign]);await q("INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng) VALUES($1,$2,'X','Other','Other',0,0)",[foreignStore,foreign]);const employee=await actor('employee',foreign),foreignOwner=await actor('owner',foreign);
 await expect(service.summary(owner.token,params({storeId:foreignStore}))).rejects.toMatchObject({status:404});await expect(service.summary(owner.token,params({employeeId:employee.id}))).rejects.toMatchObject({status:404});
 await expect(service.employee(owner.token,employee.id,params())).rejects.toMatchObject({status:404});
 const other=new ReportingService(new AuthService(db,foreign,'reporting-test-secret-'.repeat(4)));expect((await other.summary(foreignOwner.token,params())).metrics.total).toBe(0);await expect(other.detail(foreignOwner.token,normal.sessionId!,{})).rejects.toMatchObject({status:404});
});
it('third store appears immediately with zero state and without changing code',async()=>{
 const id=randomUUID();await q("INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng) VALUES($1,$2,'THIRD','Toko ketiga','Alamat',0,0)",[id,businessId]);
 const branches=await service.stores(owner.token,params());expect(branches.items).toHaveLength(3);expect(branches.items.find(s=>s.id===id)?.metrics.total).toBe(0);expect((await service.summary(owner.token,params({storeId:id}))).metrics.total).toBe(0);
});
it('inactive stores and employees retain historical attendance and branch labels',async()=>{
 await q('UPDATE attendance.stores SET is_active=false WHERE id=$1',[stores[0]]);await q("UPDATE attendance.employees SET status='inactive' WHERE id=$1",[normal.id]);
 try{
  const history=await service.history(owner.token,params({employeeId:normal.id}));expect(history.items).toHaveLength(2);expect(history.items.every(r=>!r.employeeActive)).toBe(true);expect((await service.summary(owner.token,params())).metrics.total).toBe(9);expect((await service.stores(owner.token,params())).items.find(s=>s.id===stores[0])?.isActive).toBe(false);
 }finally{await q('UPDATE attendance.stores SET is_active=true WHERE id=$1',[stores[0]]);await q("UPDATE attendance.employees SET status='active' WHERE id=$1",[normal.id])}
});
it('editing a scheduled date after attendance does not move historical report attribution or lateness snapshot',async()=>{
 await q('UPDATE attendance.schedules SET starts_at=$1,ends_at=$2 WHERE id=$3',[dayAfter(today,8)+'T01:00:00Z',dayAfter(today,8)+'T09:00:00Z',second.scheduleId]);
 try{expect((await service.summary(owner.token,params({employeeId:normal.id}))).metrics.total).toBe(2);const detail=await service.detail(owner.token,second.sessionId!,{});expect(detail.attendance.startsAt).toBe(second.start);expect(detail.attendance.late).toBe(true)}finally{await q('UPDATE attendance.schedules SET starts_at=$1,ends_at=$2 WHERE id=$3',[second.start,second.end,second.scheduleId])}
});
it('HTTP enforces read-only, safe infrastructure errors, owner scope and no-store',async()=>{
 const query=new URLSearchParams(range),request=(token=owner.token,method='GET')=>new NextRequest('http://localhost:3000/api/v1/dashboard/summary?'+query,{method,headers:{cookie:cookieName+'='+token}});
 const response=await handler(request(),'summary');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect((await response.json()).data.metrics.total).toBe(9);
 expect((await handler(request(normal.token),'summary')).status).toBe(403);expect((await handler(request(owner.token,'POST'),'summary')).status).toBe(405);
 const bad=createReportingHandler(()=>{throw new Error('secret-test-value')});const result=await bad(request(),'summary');expect(result.status).toBe(503);expect(JSON.stringify(await result.json())).not.toContain('secret-test-value');
});

it('missing checkout is a separate flag and never receives the shift end automatically',async()=>{
 const detail=await service.detail(owner.token,missing.sessionId!,{});expect(detail.attendance.checkOutAt).toBeNull();expect(detail.attendance.missingCheckout).toBe(true);expect(detail.attendance.category).toBe('valid');
});
it('overnight shift belongs to the start day while checkout activity appears on its actual day',async()=>{
 const night=await shift({date:dayAfter(today,-10),record:false});
 const starts=new Date(dayAfter(today,-10)+'T20:00:00+07:00').toISOString(),ends=new Date(dayAfter(today,-9)+'T05:00:00+07:00').toISOString();
 const rules={timezone:'Asia/Jakarta',grace_minutes:5,schedule_starts_at:starts,schedule_ends_at:ends};
 await q('UPDATE attendance.schedules SET starts_at=$1,ends_at=$2,rule_snapshot=$3 WHERE id=$4',[starts,ends,JSON.stringify(rules),night.scheduleId]);
 const session=String((await q('INSERT INTO attendance.attendance_sessions(employee_id,schedule_id,check_in_at,check_out_at,rule_snapshot) VALUES($1,$2,$3,$4,$5) RETURNING id',[night.id,night.scheduleId,starts,ends,JSON.stringify(rules)])).rows[0].id);
 for(const [type,at] of [['check_in',starts],['check_out',ends]])await q("INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,recorded_at,photo_path,location_status,review_status,idempotency_key,rule_snapshot) VALUES($1,$2,$3,$4,$5,'fixture/night.jpg','inside','not_required',$6,$7)",[session,night.id,night.storeId,type,at,randomUUID(),JSON.stringify(rules)]);
 const first={from:dayAfter(today,-10),to:dayAfter(today,-9),employeeId:night.id},next={from:dayAfter(today,-9),to:dayAfter(today,-8),employeeId:night.id};
 expect((await service.summary(owner.token,first)).metrics.total).toBe(1);expect((await service.summary(owner.token,next)).metrics.total).toBe(0);
 expect((await service.activity(owner.token,next)).items.map(r=>r.kind)).toEqual(['check_out']);
});
it('date boundaries follow business timezone and report empty days as zero',async()=>{
 const boundary=await shift({date:dayAfter(today,-15)}),instant=dayAfter(today,-15)+'T16:30:00Z';
 await q('UPDATE attendance.schedules SET starts_at=$1,ends_at=$2 WHERE id=$3',[instant,dayAfter(today,-14)+'T00:30:00Z',boundary.scheduleId]);
 const period={from:dayAfter(today,-14),to:dayAfter(today,-13),employeeId:boundary.id};
 expect((await service.summary(owner.token,period)).metrics.total).toBe(0);
 await q("UPDATE attendance.businesses SET timezone='Asia/Makassar' WHERE id=$1",[businessId]);
 try{const summary=await service.summary(owner.token,period);expect(summary.timezone).toBe('Asia/Makassar');expect(summary.metrics.total).toBe(1);expect(summary.daily[0].date).toBe(period.from)}finally{await q("UPDATE attendance.businesses SET timezone='Asia/Jakarta' WHERE id=$1",[businessId])}
});
it('history and activity paginate without duplicates, including simultaneous timestamps',async()=>{
 for(let i=0;i<25;i++)await shift({date:dayAfter(today,-25),record:true});
 const filter={from:dayAfter(today,-25),to:dayAfter(today,-24)};
 const a=await service.history(owner.token,filter),b=await service.history(owner.token,{...filter,offset:20});expect(a.items).toHaveLength(20);expect(a.hasMore).toBe(true);expect(b.items).toHaveLength(5);expect(b.hasMore).toBe(false);expect(new Set([...a.items,...b.items].map(r=>r.scheduleId)).size).toBe(25);
 const x=await service.activity(owner.token,filter),y=await service.activity(owner.token,{...filter,offset:20});expect(x.items).toHaveLength(20);expect(y.items).toHaveLength(20);expect(new Set([...x.items,...y.items].map(r=>r.id)).size).toBe(40);
});
it('store pages and private request history stay bounded as the business grows',async()=>{
 for(let i=0;i<21;i++)await q("INSERT INTO attendance.stores(business_id,code,name,address,lat,lng) VALUES($1,$2,$3,'Alamat',0,0)",[businessId,'EXTRA'+i,'Cabang '+i]);
 const a=await service.stores(owner.token,params()),b=await service.stores(owner.token,params({offset:20}));expect(a.items).toHaveLength(20);expect(a.hasMore).toBe(true);expect(new Set([...a.items,...b.items].map(r=>r.id)).size).toBe(24);
 for(let i=0;i<22;i++)await q("INSERT INTO attendance.approval_requests(requester_id,type,target_type,target_id,reason,status,reviewer_id,decided_at) VALUES($1,'attendance_correction','schedule',$2,'Histori permintaan tes','rejected',$3,now())",[normal.id,normal.scheduleId,owner.id]);
 const first=await service.detail(owner.token,normal.sessionId!,{}),next=await service.detail(owner.token,normal.sessionId!,{requestOffset:20});expect(first.requests.items).toHaveLength(20);expect(first.requests.hasMore).toBe(true);expect(next.requests.items).toHaveLength(3);expect(new Set([...first.requests.items,...next.requests.items].map(r=>r.requestId)).size).toBe(23);
});

it('session detail uses original location rules after the store coordinates or radius change',async()=>{
 await q('UPDATE attendance.stores SET lat=0,lng=0,radius_m=999 WHERE id=$1',[normal.storeId]);
 try{const detail=await service.detail(owner.token,normal.sessionId!,{});expect(detail.locationRule.lat).toBe(-6.2);expect(detail.locationRule.lng).toBe(106.8);expect(detail.locationRule.radiusM).toBe(100);expect(detail.locationRule.graceMinutes).toBe(5)}finally{await q('UPDATE attendance.stores SET lat=-6.2,lng=106.8,radius_m=100 WHERE id=$1',[normal.storeId])}
});
