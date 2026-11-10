import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthError,invalidLogin,requireOwner,type AuthDatabase,type SqlConnection,type Identity } from './types';
import { hashCredential,verifyCredential,dummyHash,newToken,tokenHash,throttleKey,temporaryPin } from './crypto';
export const loginCode=z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const pinSchema=z.string().regex(/^\d{6,12}$/);
export const passwordSchema=z.string().min(12).max(128);
const secretInput=z.string().min(1).max(128);
export const SESSION_SECONDS=7*24*60*60;
type AccountRow={id:string;business_id:string;full_name:string;role:Identity['role'];status:string;credential:string|null;must_change_pin:boolean|null;is_active:boolean};
export class AuthService {
 constructor(private db:AuthDatabase,private businessId:string,private secret:string){if(secret.length<32)throw new Error('SESSION_SECRET must be at least 32 characters')}
 private async audit(c:SqlConnection,actor:string,action:string,target:string){await c.query('insert into attendance.audit_logs(actor_id,action,entity_type,entity_id,metadata_redacted) values($1,$2,$3,$4,$5)',[actor,action,'employee',target,'{}'])}
 private async limit(c:SqlConnection,key:string,max:number){
  const result=await c.query<{attempts:number}>(`insert into attendance.auth_rate_limits(key,attempts,resets_at) values($1,1,now()+interval '15 minutes') on conflict(key) do update set attempts=case when attendance.auth_rate_limits.resets_at<=now() then 1 else attendance.auth_rate_limits.attempts+1 end,resets_at=case when attendance.auth_rate_limits.resets_at<=now() then now()+interval '15 minutes' else attendance.auth_rate_limits.resets_at end returning attempts`,[throttleKey(this.secret,this.businessId+':'+key)]);
  return result.rows[0].attempts<=max;
 }
 async login(role:'owner'|'employee',codeValue:unknown,credentialValue:unknown){
  const code=loginCode.parse(codeValue);const credential=secretInput.parse(credentialValue);
  const result=await this.db.transaction(async c=>{
   // Persistent limits also cover nonexistent IDs and distributed function instances.
   const global=await this.limit(c,'login:global',100);
   const account=await this.limit(c,'login:'+role+':'+code,5);
   if(!global||!account)return {error:new AuthError('RATE_LIMITED',429,'Terlalu banyak percobaan. Coba lagi dalam 15 menit.')};
   const table=role==='owner'?'owner_credentials':'employee_credentials';
   const column=role==='owner'?'password_hash':'pin_hash';
   const row=(await c.query<AccountRow>(`select e.id,e.business_id,e.full_name,e.role,e.status,b.is_active,c.${column} as credential,${role==='owner'?'false':'c.must_change_pin'} as must_change_pin from attendance.employees e join attendance.businesses b on b.id=e.business_id left join attendance.${table} c on c.employee_id=e.id where e.business_id=$1 and e.employee_code=$2 and e.role=$3 for update of e`,[this.businessId,code,role])).rows[0];
   const valid=await verifyCredential(row?.credential??await dummyHash(),credential);
   if(!row||!valid||row.status!=='active'||!row.is_active||!row.credential){
    if(row&&role==='employee')await c.query("update attendance.employee_credentials set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts>=4 then now()+interval '15 minutes' else locked_until end where employee_id=$1",[row.id]);
    return {error:invalidLogin()};
   }
   if(role==='employee'){
    const locked=(await c.query<{locked:boolean}>('select coalesce(locked_until>now(),false) as locked from attendance.employee_credentials where employee_id=$1',[row.id])).rows[0]?.locked;
    if(locked)return {error:invalidLogin()};
    await c.query('update attendance.employee_credentials set failed_attempts=0,locked_until=null where employee_id=$1',[row.id]);
   }
   // Per-account throttling counts failures since the last successful login.
   // The independent global budget still limits credential-spraying/CPU usage.
   await c.query('delete from attendance.auth_rate_limits where key=$1',[throttleKey(this.secret,this.businessId+':login:'+role+':'+code)]);
   const token=newToken();
   await c.query("insert into attendance.auth_sessions(employee_id,token_hash,expires_at) values($1,$2,now()+interval '7 days')",[row.id,tokenHash(token)]);
   await this.audit(c,row.id,'auth.login',row.id);
   // Legacy DB flag is informational; initial/reset PIN never limits resource access.
   return {token,pinChangeSuggested:!!row.must_change_pin};
  });
  if('error' in result)throw result.error;
  return result;
 }
 private async identity(c:SqlConnection,token:string,lock=true):Promise<Identity>{
  const row=(await c.query<AccountRow>(`select e.id,e.business_id,e.full_name,e.role,e.status,b.is_active,coalesce(cr.must_change_pin,false) as must_change_pin,null as credential from attendance.auth_sessions s join attendance.employees e on e.id=s.employee_id join attendance.businesses b on b.id=e.business_id left join attendance.employee_credentials cr on cr.employee_id=e.id where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now() and e.business_id=$2 ${lock?'for update of e':''}`,[tokenHash(token),this.businessId])).rows[0];
  if(!row||row.status!=='active'||!row.is_active)throw new AuthError('UNAUTHENTICATED',401,'Silakan masuk kembali.');
  return {id:row.id,businessId:row.business_id,fullName:row.full_name,role:row.role,pinChangeSuggested:!!row.must_change_pin};
 }
 withIdentity<T>(token:string,work:(c:SqlConnection,actor:Identity)=>Promise<T>){return this.db.transaction(async c=>work(c,await this.identity(c,token)))}
 withOwner<T>(token:string,work:(c:SqlConnection,actor:Identity)=>Promise<T>){
  return this.db.transaction(async c=>{const actor=await this.identity(c,token);requireOwner(actor);return work(c,actor)});
 }
 // Approval may touch both owner and employee. Lock UUIDs in a stable order, then
 // revalidate the owner's session after waiting; this avoids cross-owner/FK deadlocks.
 withOwnerAndEmployee<T>(token:string,employeeId:string,work:(c:SqlConnection,actor:Identity)=>Promise<T>){
  z.uuid().parse(employeeId);
  return this.db.transaction(async c=>{
   const actor=await this.identity(c,token,false);requireOwner(actor);
   await c.query('select id from attendance.employees where business_id=$1 and id=ANY($2::uuid[]) order by id for update',[actor.businessId,[actor.id,employeeId]]);
   const current=await this.identity(c,token);requireOwner(current);
   return work(c,current);
  });
 }
 me(token:string){return this.db.transaction(c=>this.identity(c,token))}
 async logout(token:string){await this.db.transaction(async c=>{await c.query('update attendance.auth_sessions set revoked_at=now() where token_hash=$1 and revoked_at is null',[tokenHash(token)])})}
 async changePin(token:string,currentValue:unknown,nextValue:unknown){
  const current=secretInput.parse(currentValue),next=pinSchema.parse(nextValue);
  if(current===next)throw new AuthError('INVALID_PIN',400,'PIN baru harus berbeda.');
  const result=await this.db.transaction(async c=>{
   const actor=await this.identity(c,token);
   if(actor.role!=='employee')throw new AuthError('FORBIDDEN',403,'Akses tidak diizinkan.');
   if(!await this.limit(c,'change-pin:'+actor.id,5))return new AuthError('RATE_LIMITED',429,'Terlalu banyak percobaan. Coba lagi nanti.');
   const credential=(await c.query<{pin_hash:string}>('select pin_hash from attendance.employee_credentials where employee_id=$1 for update',[actor.id])).rows[0];
   if(!credential||!await verifyCredential(credential.pin_hash,current))return invalidLogin();
   await c.query('update attendance.employee_credentials set pin_hash=$1,must_change_pin=false,failed_attempts=0,locked_until=null,changed_at=now() where employee_id=$2',[await hashCredential(next),actor.id]);
   await c.query('update attendance.auth_sessions set revoked_at=now() where employee_id=$1 and revoked_at is null',[actor.id]);
   await this.audit(c,actor.id,'auth.change_pin',actor.id);return null;
  });if(result)throw result;
 }
 async changeOwnerPassword(token:string,currentValue:unknown,nextValue:unknown){
  const current=secretInput.parse(currentValue),next=passwordSchema.parse(nextValue);
  if(current===next)throw new AuthError('INVALID_PASSWORD',400,'Password baru harus berbeda.');
  const result=await this.db.transaction(async c=>{
   const actor=await this.identity(c,token);requireOwner(actor);
   if(!await this.limit(c,'change-password:'+actor.id,5))return new AuthError('RATE_LIMITED',429,'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
   const credential=(await c.query<{password_hash:string}>('select password_hash from attendance.owner_credentials where employee_id=$1 for update',[actor.id])).rows[0];
   if(!credential||!await verifyCredential(credential.password_hash,current))return invalidLogin();
   await c.query('update attendance.owner_credentials set password_hash=$1,changed_at=now() where employee_id=$2',[await hashCredential(next),actor.id]);
   await c.query('update attendance.auth_sessions set revoked_at=now() where employee_id=$1 and revoked_at is null',[actor.id]);
   await this.audit(c,actor.id,'auth.change_password',actor.id);return null;
  });if(result)throw result;
 }
 async resetPin(token:string,targetId:string){
  z.uuid().parse(targetId);
  return this.db.transaction(async c=>{
   const actor=await this.identity(c,token);requireOwner(actor);
   if(!await this.limit(c,'reset-pin:'+actor.id,20))return {error:new AuthError('RATE_LIMITED',429,'Terlalu banyak reset. Coba lagi nanti.')};
   const target=(await c.query<{id:string}>("select id from attendance.employees where id=$1 and business_id=$2 and role='employee' for update",[targetId,actor.businessId])).rows[0];
   if(!target)throw new AuthError('NOT_FOUND',404,'Karyawan tidak ditemukan.');
   const pin=temporaryPin();
   await c.query('insert into attendance.employee_credentials(employee_id,pin_hash,must_change_pin) values($1,$2,true) on conflict(employee_id) do update set pin_hash=excluded.pin_hash,must_change_pin=true,failed_attempts=0,locked_until=null,changed_at=now()',[target.id,await hashCredential(pin)]);
   await c.query('update attendance.auth_sessions set revoked_at=now() where employee_id=$1 and revoked_at is null',[target.id]);
   await this.audit(c,actor.id,'auth.reset_pin',target.id);
   return {temporaryPin:pin};
  }).then(result=>{if('error' in result)throw result.error;return result});
 }
 async bootstrap(input:{code:string;password:string;fullName:string;businessName:string}){
  const code=loginCode.parse(input.code),password=passwordSchema.parse(input.password);
  const fullName=z.string().trim().min(1).max(120).parse(input.fullName),businessName=z.string().trim().min(1).max(120).parse(input.businessName);
  const encoded=await hashCredential(password);
  return this.db.transaction(async c=>{
   await c.query("select pg_advisory_xact_lock(hashtext('princes-owner-bootstrap'))");
   const existing=(await c.query('select business_id from attendance.bootstrap_state where business_id=$1 union all select business_id from attendance.employees where business_id=$1 and role=\'owner\'',[this.businessId])).rows;
   if(existing.length)throw new AuthError('BOOTSTRAP_COMPLETED',409,'Owner sudah disiapkan.');
   await c.query('insert into attendance.businesses(id,name) values($1,$2) on conflict(id) do nothing',[this.businessId,businessName]);
   const id=randomUUID();
   await c.query("insert into attendance.employees(id,business_id,employee_code,full_name,role) values($1,$2,$3,$4,'owner')",[id,this.businessId,code,fullName]);
   await c.query('insert into attendance.owner_credentials(employee_id,password_hash) values($1,$2)',[id,encoded]);
   await c.query('insert into attendance.bootstrap_state(business_id) values($1)',[this.businessId]);
   await this.audit(c,id,'auth.bootstrap_owner',id);return {id};
  });
 }
}
