import { readFileSync,readdirSync } from 'node:fs';
import { afterAll,beforeAll,expect,it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/server/db/schema';
import { assertDevelopmentSeed,demoBusinessId,seedSql } from '../../src/server/db/seed';
import { workforceRepository } from '../../src/server/repositories/workforce';
const pg=new PGlite({extensions:{btree_gist}});
const db=drizzle(pg,{schema});
const repo=workforceRepository(db);
beforeAll(async()=>{
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync('drizzle/'+f,'utf8'));
 await pg.exec(seedSql);
},30000);
afterAll(()=>pg.close());
it('migrates empty PostgreSQL and creates all 17 protected tables',async()=>{
 const result=await pg.query<{count:number}>("select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='attendance' and c.relkind='r' and c.relrowsecurity");
 expect(result.rows[0].count).toBe(17);
});
it('seed is idempotent and creates no credentials',async()=>{
 await pg.exec(seedSql);expect(await repo.listEmployees(demoBusinessId)).toHaveLength(9);expect(await repo.listStores(demoBusinessId)).toHaveLength(2);
 expect((await pg.query('select * from attendance.employee_credentials')).rows).toHaveLength(0);
 expect((await pg.query('select * from attendance.attendance_events')).rows).toHaveLength(6);
});
it('refuses production seed even when opt-in is set',()=>{
 expect(()=>assertDevelopmentSeed({NODE_ENV:'production',APP_ENV:'development',ALLOW_DEMO_SEED:'true'})).toThrow();
 expect(()=>assertDevelopmentSeed({APP_ENV:'production',ALLOW_DEMO_SEED:'true'})).toThrow();
 expect(()=>assertDevelopmentSeed({APP_ENV:'development',ALLOW_DEMO_SEED:'true'})).not.toThrow();
});
it('employee code edit preserves UUID and schedule references',async()=>{
 const id='d2000000-0000-4000-8000-000000000002';
 expect((await repo.updateEmployeeCode(demoBusinessId,id,'CHANGED'))[0].id).toBe(id);
 expect((await pg.query('select id from attendance.schedules where employee_id=$1',[id])).rows).toHaveLength(1);
 expect(await repo.listEmployees('00000000-0000-4000-8000-000000000000')).toHaveLength(0);
 await repo.updateEmployeeCode(demoBusinessId,id,'DEMO-002');
});
it('rejects duplicate employee codes and invalid store radius',async()=>{
 await expect(pg.exec("update attendance.employees set employee_code='DEMO-002' where employee_code='DEMO-003'")).rejects.toThrow();
 await expect(pg.exec('update attendance.stores set radius_m=0')).rejects.toThrow();
});
it('rejects overlapping published shifts but accepts overnight schedule',async()=>{
 const base="insert into attendance.schedules(employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot) values ('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001',";
 await expect(pg.exec(base+"'2026-11-09T02:00Z','2026-11-09T10:00Z','published','d2000000-0000-4000-8000-000000000001','{}')")).rejects.toThrow();
 await pg.exec(base+"'2026-11-09T13:00Z','2026-11-09T22:00Z','published','d2000000-0000-4000-8000-000000000001','{}')");
 await expect(pg.exec(base+"'2026-11-10T02:00Z','2026-11-10T01:00Z','draft','d2000000-0000-4000-8000-000000000001','{}')")).rejects.toThrow();
});
it('rejects duplicate effective events and idempotency retries',async()=>{
 const columns='session_id,employee_id,store_id,event_type,recorded_at,photo_path,location_status,review_status,idempotency_key,rule_snapshot';
 await expect(pg.exec(`insert into attendance.attendance_events(${columns}) select ${columns} from attendance.attendance_events limit 1`)).rejects.toMatchObject({code:'23505'});
 await expect(pg.exec(`insert into attendance.attendance_events(${columns}) select session_id,employee_id,store_id,event_type,recorded_at,photo_path,location_status,review_status,gen_random_uuid(),rule_snapshot from attendance.attendance_events limit 1`)).rejects.toMatchObject({code:'23505',constraint:'attendance_events_session_id_event_type_unique'});
 const row=(await pg.query<{id:string}>('select id from attendance.attendance_events limit 1')).rows[0];
 await expect(pg.query("update attendance.attendance_events set accuracy_m=-1 where id=$1",[row.id])).rejects.toThrow();
});
it('audit is append-only and decision can only be applied once',async()=>{
 await pg.exec("insert into attendance.audit_logs(action,entity_type,metadata_redacted) values ('test','test','{}')");
 await expect(pg.exec("delete from attendance.audit_logs")).rejects.toThrow();
 const a=await pg.query<{id:string}>("insert into attendance.approval_requests(requester_id,type,target_type,target_id,reason) values ('d2000000-0000-4000-8000-000000000002','correction','session','d5000000-0000-4000-8000-000000000002','DEMO') returning id");
 await pg.query("update attendance.approval_requests set status='approved',reviewer_id='d2000000-0000-4000-8000-000000000001',decided_at=now() where id=$1",[a.rows[0].id]);
 await expect(pg.query("update attendance.approval_requests set status='rejected' where id=$1",[a.rows[0].id])).rejects.toThrow();
});
