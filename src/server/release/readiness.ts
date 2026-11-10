import type { SqlConnection } from '../auth/types';
export type ReleaseCheck={id:string;ok:boolean;detail:string};
export const requiredTables=['businesses','stores','employees','employee_credentials','auth_sessions','employee_store_assignments','shift_templates','schedules','attendance_sessions','attendance_events','approval_requests','attendance_corrections','business_settings','audit_logs','owner_credentials','bootstrap_state','auth_rate_limits','attendance_uploads'];
export const requiredTriggers=['audit_append_only','approval_final','event_owner','attendance_evidence_immutable','correction_history_immutable','approval_content_immutable','workforce_store_business','workforce_template_business','workforce_employee_scope','workforce_assignment_scope','workforce_schedule_scope','workforce_session_scope','workforce_event_scope'];
export async function inspectDatabase(c:SqlConnection,businessId:string,migrations:{hash:string;createdAt:number}[]):Promise<ReleaseCheck[]>{
 const checks:ReleaseCheck[]=[],add=(id:string,ok:boolean,detail:string)=>checks.push({id,ok,detail});
 const tables=(await c.query<{tablename:string;rowsecurity:boolean}>("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='attendance'")).rows;
 const present=new Map(tables.map(t=>[t.tablename,t.rowsecurity]));
 add('schema',requiredTables.every(t=>present.has(t)),`${requiredTables.filter(t=>present.has(t)).length}/${requiredTables.length} tabel wajib`);
 add('rls',requiredTables.every(t=>present.get(t)===true),'RLS seluruh tabel aplikasi');
 const ledger=(await c.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS ledger")).rows[0]?.ledger;
 const journal=ledger?(await c.query<{hash:string;created_at:string|number}>('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at,id')).rows:[];
 add('migrations',journal.length===migrations.length&&journal.every((m,i)=>m.hash===migrations[i]?.hash&&Number(m.created_at)===migrations[i]?.createdAt),`${journal.length}/${migrations.length} jurnal migrasi, hash dan urutan diperiksa`);
 if(!requiredTables.every(t=>present.has(t)))return checks;
 const triggers=(await c.query<{tgname:string}>("SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='attendance' AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')")).rows.map(t=>t.tgname);
 add('triggers',requiredTriggers.every(t=>triggers.includes(t)),`${requiredTriggers.filter(t=>triggers.includes(t)).length}/${requiredTriggers.length} trigger wajib aktif`);
 const indexes=(await c.query<{indexname:string}>("SELECT indexname FROM pg_indexes WHERE schemaname='attendance'")).rows.map(r=>r.indexname);
 add('constraints', ['one_open_session','one_session_per_schedule','no_published_overlap','one_pending_time_correction','one_location_review'].every(name=>indexes.includes(name)),'Indeks integritas sesi, jadwal dan workflow');
 const insecure=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND has_schema_privilege(r.oid,'attendance','USAGE')`)).rows[0].n;
 const publicUsage=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM pg_namespace n,LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='attendance' AND a.grantee=0 AND a.privilege_type='USAGE'`)).rows[0].n;
 add('private_schema',Number(insecure)===0&&Number(publicUsage)===0,'Tidak ada akses schema untuk PUBLIC/anon/authenticated');
 const definers=(await c.query<{n:number}>("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='attendance' AND p.prosecdef")).rows[0].n;
 add('functions',Number(definers)===0,'Fungsi aplikasi tidak SECURITY DEFINER');
 const businesses=(await c.query<{id:string;is_demo:boolean;is_active:boolean}>('SELECT id,is_demo,is_active FROM attendance.businesses')).rows;
 add('business',businesses.length===1&&businesses[0].id===businessId&&businesses[0].is_active,'Satu bisnis aktif sesuai APP_BUSINESS_ID');
 add('no_demo',businesses.every(b=>!b.is_demo),'Tidak ada bisnis seed DEMO');
 const owner=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM attendance.employees e JOIN attendance.owner_credentials cr ON cr.employee_id=e.id JOIN attendance.bootstrap_state bs ON bs.business_id=e.business_id WHERE e.business_id=$1 AND e.role='owner' AND e.status='active' AND cr.password_hash LIKE '$argon2id$%'`,[businessId])).rows[0].n;
 add('owner',Number(owner)>0,'Owner aktif, bootstrap dan hash credential tersedia');
 const invalid=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM attendance.attendance_sessions a LEFT JOIN attendance.schedules s ON s.id=a.schedule_id WHERE s.id IS NULL OR s.employee_id<>a.employee_id`)).rows[0].n;
 add('session_scope',Number(invalid)===0,'Sesi mempunyai jadwal/kepemilikan sah');
 const photos=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM attendance.attendance_events ev JOIN attendance.employees e ON e.id=ev.employee_id WHERE ev.photo_path NOT LIKE e.business_id::text||'/'||e.id::text||'/%' OR ev.photo_path !~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+[.]jpg$'`)).rows[0].n;
 add('private_paths',Number(photos)===0,'Referensi foto berupa path privat sesuai bisnis/employee');
 return checks;
}
export function inspectBucket(bucket:{public?:boolean;file_size_limit?:number|null;allowed_mime_types?:string[]|null}):ReleaseCheck[]{
 return [
  {id:'bucket_private',ok:bucket.public===false,detail:'Bucket selfie privat'},
  {id:'bucket_size',ok:typeof bucket.file_size_limit==='number'&&bucket.file_size_limit>0&&bucket.file_size_limit<=524288,detail:'Batas ukuran bucket maksimal 512 KiB'},
  {id:'bucket_mime',ok:bucket.allowed_mime_types?.length===1&&bucket.allowed_mime_types[0]==='image/jpeg',detail:'Bucket hanya menerima JPEG'},
 ];
}
