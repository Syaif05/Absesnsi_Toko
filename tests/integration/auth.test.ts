import { readFileSync,readdirSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { NextRequest } from 'next/server';
import { AuthService } from '../../src/server/auth/service';
import { hashCredential,tokenHash } from '../../src/server/auth/crypto';
import { createAuthHandler,cookieName } from '../../src/server/auth/http';
import { requireOwnResource } from '../../src/server/auth/types';
import type { AuthDatabase } from '../../src/server/auth/types';
const pg=new PGlite({extensions:{btree_gist}});
const database:AuthDatabase={transaction:work=>pg.transaction(tx=>work({query:(text,values)=>tx.query(text,values)}))};
const businessId='a0000000-0000-4000-8000-000000000001';
const employeeId='a1000000-0000-4000-8000-000000000001';
const service=new AuthService(database,businessId,'test-secret-'.repeat(5));
const handler=createAuthHandler(()=>({service,origin:'http://localhost:3000'}));
let ownerToken='';let employeeToken='';
beforeAll(async()=>{for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await pg.exec(readFileSync('drizzle/'+f,'utf8'));},30000);
afterAll(()=>pg.close());
it('bootstrap creates exactly one owner and cannot repeat',async()=>{
 await service.bootstrap({code:'reza',password:'owner-password-for-test',fullName:'Owner Reza',businessName:'Absensi Kita'});
 await expect(service.bootstrap({code:'second',password:'owner-password-for-test',fullName:'Other',businessName:'Other'})).rejects.toMatchObject({code:'BOOTSTRAP_COMPLETED'});
 expect((await pg.query('select * from attendance.owner_credentials')).rows).toHaveLength(1);
 await pg.query("insert into attendance.employees(id,business_id,employee_code,full_name) values($1,$2,'EMP-1','Contoh')",[employeeId,businessId]);
 await pg.query('insert into attendance.employee_credentials(employee_id,pin_hash) values($1,$2)',[employeeId,await hashCredential('123456')]);
});
it('login hashes credentials, returns no old PIN, and stores only token hash',async()=>{
 ownerToken=(await service.login('owner','reza','owner-password-for-test')).token;
 const result=await service.login('employee','EMP-1','123456');employeeToken=result.token;
 expect(result.mustChangePin).toBe(true);
 const row=(await pg.query<{pin_hash:string}>('select pin_hash from attendance.employee_credentials')).rows[0];
 expect(row.pin_hash).toContain('$argon2id$');expect(row.pin_hash).not.toBe('123456');
 expect((await pg.query('select * from attendance.auth_sessions where token_hash=$1',[tokenHash(employeeToken)])).rows).toHaveLength(1);
 expect((await pg.query('select * from attendance.auth_sessions where token_hash=$1',[employeeToken])).rows).toHaveLength(0);
});
it('temporary PIN session cannot access normal protected resources or reset another employee',async()=>{
 await expect(service.me(employeeToken)).rejects.toMatchObject({code:'PIN_CHANGE_REQUIRED'});
 expect((await service.me(employeeToken,true)).mustChangePin).toBe(true);
 await expect(service.resetPin(employeeToken,employeeId)).rejects.toMatchObject({status:403});
});
it('change PIN requires current secret and revokes old sessions',async()=>{
 await expect(service.changePin(employeeToken,'999999','654321')).rejects.toMatchObject({code:'INVALID_LOGIN'});
 await service.changePin(employeeToken,'123456','654321');
 await expect(service.me(employeeToken)).rejects.toMatchObject({status:401});
 const result=await service.login('employee','EMP-1','654321');employeeToken=result.token;expect(result.mustChangePin).toBe(false);
 await expect(service.resetPin(employeeToken,employeeId)).rejects.toMatchObject({status:403});
});
it('owner reset returns a temporary PIN once and revokes existing sessions',async()=>{
 const result=await service.resetPin(ownerToken,employeeId);expect(result.temporaryPin).toMatch(/^\d{6}$/);
 await expect(service.me(employeeToken)).rejects.toMatchObject({status:401});
 const newSession=await service.login('employee','EMP-1',result.temporaryPin);expect(newSession.mustChangePin).toBe(true);
 employeeToken=newSession.token;
 const logs=JSON.stringify((await pg.query('select metadata_redacted from attendance.audit_logs')).rows);
 expect(logs).not.toContain(result.temporaryPin);
 expect(JSON.stringify(await service.me(ownerToken))).not.toContain('password');
});
it('inactive employees and expired/revoked sessions are rejected',async()=>{
 await pg.query("update attendance.employees set status='inactive' where id=$1",[employeeId]);
 await expect(service.me(employeeToken,true)).rejects.toMatchObject({status:401});
 await pg.query("update attendance.employees set status='active' where id=$1",[employeeId]);
 await service.logout(employeeToken);await expect(service.me(employeeToken,true)).rejects.toMatchObject({status:401});
 await pg.query('update attendance.auth_sessions set expires_at=now()-interval \'1 minute\' where token_hash=$1',[tokenHash(ownerToken)]);
 await expect(service.me(ownerToken)).rejects.toMatchObject({status:401});
 ownerToken=(await service.login('owner','reza','owner-password-for-test')).token;
});
it('RBAC prevents cross-employee and cross-business reads',()=>{
 const actor={id:employeeId,businessId,fullName:'Contoh',role:'employee' as const,mustChangePin:false};
 expect(()=>requireOwnResource(actor,employeeId,businessId)).not.toThrow();
 expect(()=>requireOwnResource(actor,'another',businessId)).toThrow();
 expect(()=>requireOwnResource({...actor,role:'owner'},employeeId,'another-business')).toThrow();
});
it('nonexistent and wrong account failures match and are persistently throttled',async()=>{
 await expect(service.login('owner','reza','wrong')).rejects.toMatchObject({code:'INVALID_LOGIN'});
 for(let i=0;i<5;i++)await expect(service.login('employee','missing','wrong')).rejects.toMatchObject({code:'INVALID_LOGIN'});
 await expect(service.login('employee','missing','wrong')).rejects.toMatchObject({status:429});
 expect(JSON.stringify((await pg.query('select key from attendance.auth_rate_limits')).rows)).not.toContain('missing');
});
it('HTTP rejects CSRF and issues HttpOnly cookie with no token in JSON',async()=>{
 const req=(origin:string)=>new NextRequest('http://localhost:3000/api/v1/auth/owner/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({code:'reza',credential:'owner-password-for-test'})});
 expect((await handler(req('https://evil.example'),'owner-login')).status).toBe(403);
 const response=await handler(req('http://localhost:3000'),'owner-login');expect(response.status).toBe(200);
 expect(response.headers.get('set-cookie')).toContain('HttpOnly');expect(response.headers.get('set-cookie')).toContain('SameSite=lax');expect(response.headers.get('cache-control')).toBe('no-store');
 expect(JSON.stringify(await response.json())).not.toContain('token');
 const noSession=new NextRequest('http://localhost:3000/api/v1/me');expect((await handler(noSession,'me')).status).toBe(401);
 const cookie=new NextRequest('http://localhost:3000/api/v1/me',{headers:{cookie:cookieName+'='+ownerToken}});expect((await handler(cookie,'me')).status).toBe(200);
});
it('missing database config returns 503 with no false success',async()=>{
 const unavailable=createAuthHandler(()=>{throw new Error('secret connection string')});
 const response=await unavailable(new NextRequest('http://localhost:3000/api/v1/me'),'me');expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('secret connection');
});
it('Supabase SQL bundle installs on an empty PostgreSQL without demo accounts',async()=>{
 const fresh=new PGlite({extensions:{btree_gist}});
 try{
  await fresh.exec(readFileSync('supabase/sql/001_schema_all.sql','utf8'));
  expect((await fresh.query('select * from attendance.employees')).rows).toHaveLength(0);
  expect((await fresh.query('select * from attendance.bootstrap_state')).rows).toHaveLength(0);
  const tables=await fresh.query<{count:number}>("select count(*)::int as count from pg_tables where schemaname='attendance'");expect(tables.rows[0].count).toBe(17);
 }finally{await fresh.close()}
});

it('wrong PIN attempts lock existing accounts without exposing credentials',async()=>{
 const id='a1000000-0000-4000-8000-000000000002';
 await pg.query("insert into attendance.employees(id,business_id,employee_code,full_name) values($1,$2,'EMP-2','Contoh Dua')",[id,businessId]);
 await pg.query('insert into attendance.employee_credentials(employee_id,pin_hash) values($1,$2)',[id,await hashCredential('123456')]);
 for(let i=0;i<5;i++)await expect(service.login('employee','EMP-2','000000')).rejects.toMatchObject({status:401});
 await expect(service.login('employee','EMP-2','123456')).rejects.toMatchObject({status:429});
 expect((await pg.query<{locked:boolean}>('select locked_until>now() as locked from attendance.employee_credentials where employee_id=$1',[id])).rows[0].locked).toBe(true);
 await expect(service.resetPin(ownerToken,'a1000000-0000-4000-8000-000000000099')).rejects.toMatchObject({status:404});
});
