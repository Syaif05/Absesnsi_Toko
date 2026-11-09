// Fixed identifiers are scoped to fictitious development fixtures only.
export const demoBusinessId='d0000000-0000-4000-8000-000000000001';
export function assertDevelopmentSeed(env:Record<string,string|undefined>){
 if(env.NODE_ENV==='production'||env.APP_ENV!=='development'||env.ALLOW_DEMO_SEED!=='true') throw new Error('Seed refused: APP_ENV=development and ALLOW_DEMO_SEED=true required; production forbidden');
}
export const seedSql = `
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM attendance.businesses WHERE id='${demoBusinessId}' AND NOT is_demo) THEN RAISE EXCEPTION 'Demo ID conflicts with real business'; END IF;
END $$;
INSERT INTO attendance.businesses(id,name,is_demo) VALUES('${demoBusinessId}','Absensi Kita · DEMO',true) ON CONFLICT DO NOTHING;
INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng,radius_m)
SELECT ('d1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${demoBusinessId}','DEMO-'||n,'Toko Demo '||n,'Alamat fiktif '||n,-6.2,106.8,100 FROM generate_series(1,2) n ON CONFLICT DO NOTHING;
INSERT INTO attendance.employees(id,business_id,employee_code,full_name,role,status,primary_store_id)
SELECT ('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${demoBusinessId}','DEMO-'||lpad(n::text,3,'0'),CASE WHEN n=1 THEN 'Owner Reza · DEMO' ELSE 'Karyawan Contoh '||n END,CASE WHEN n=1 THEN 'owner' ELSE 'employee' END,'inactive',('d1000000-0000-4000-8000-'||lpad((1+n%2)::text,12,'0'))::uuid FROM generate_series(1,9) n ON CONFLICT DO NOTHING;
INSERT INTO attendance.shift_templates(id,business_id,name,start_local_time,end_local_time,crosses_midnight)
VALUES('d3000000-0000-4000-8000-000000000001','${demoBusinessId}','Pagi DEMO','08:00','16:00',false),('d3000000-0000-4000-8000-000000000002','${demoBusinessId}','Malam DEMO','20:00','05:00',true) ON CONFLICT DO NOTHING;
INSERT INTO attendance.schedules(id,employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot)
SELECT ('d4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('d1000000-0000-4000-8000-'||lpad((1+n%2)::text,12,'0'))::uuid,'2026-11-09T01:00:00Z','2026-11-09T09:00:00Z','published','d2000000-0000-4000-8000-000000000001','{"grace_minutes":5,"radius_m":100,"demo":true}' FROM generate_series(2,9) n ON CONFLICT DO NOTHING;
INSERT INTO attendance.attendance_sessions(id,employee_id,schedule_id,status,check_in_at,check_out_at)
SELECT ('d5000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('d4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'completed','2026-11-09T00:55:00Z','2026-11-09T09:02:00Z' FROM generate_series(2,4) n ON CONFLICT DO NOTHING;
INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,recorded_at,photo_path,location_status,review_status,idempotency_key,rule_snapshot)
SELECT s.id,s.employee_id,sc.store_id,e.kind,CASE WHEN e.kind='check_in' THEN s.check_in_at ELSE s.check_out_at END,'demo/no-photo-available','inside','not_required',md5(s.id::text||e.kind)::uuid,'{"demo":true}' FROM attendance.attendance_sessions s JOIN attendance.schedules sc ON sc.id=s.schedule_id CROSS JOIN (VALUES ('check_in'),('check_out')) e(kind) WHERE sc.created_by='d2000000-0000-4000-8000-000000000001' ON CONFLICT DO NOTHING;
`;
