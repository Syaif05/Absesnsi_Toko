import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { AuthService } from '../../src/server/auth/service';
import { inspectDatabase,inspectBucket } from '../../src/server/release/readiness';
import { demoEnabled } from '../../src/server/release/demo';
import { GET } from '../../src/app/api/health/live/route';
const db=new PGlite({extensions:{btree_gist}}),businessId='d0000000-0000-4000-8000-000000000010';
const migrations=readMigrationFiles({migrationsFolder:'./drizzle'}).map(m=>({hash:m.hash,createdAt:m.folderMillis}));
const inspect=()=>db.transaction(async tx=>{await tx.exec('SET TRANSACTION READ ONLY');return inspectDatabase({query:(sql,args)=>tx.query(sql,args)},businessId,migrations)});
beforeAll(()=>db.exec(readFileSync('supabase/sql/001_schema_all.sql','utf8')),30000);
afterAll(()=>db.close());
it('clean migration bundle stays unready until owner bootstrap, then passes read-only preflight',async()=>{
 const empty=await inspect();expect(empty.find(c=>c.id==='owner')?.ok).toBe(false);expect(empty.find(c=>c.id==='business')?.ok).toBe(false);
 const service=new AuthService({transaction:work=>db.transaction(tx=>work({query:(sql,args)=>tx.query(sql,args)}))},businessId,'release-test-secret-'.repeat(4));
 await service.bootstrap({code:'release-owner',password:'owner-password-for-isolated-test',fullName:'Owner Fiktif',businessName:'Bisnis Tes'});
 const checks=await inspect();expect(checks.filter(c=>!c.ok)).toEqual([]);
 expect((await db.query('SELECT * FROM attendance.stores')).rows).toHaveLength(0);
 expect((await db.query('SELECT * FROM attendance.attendance_events')).rows).toHaveLength(0);
});
it('preflight rejects schema exposure, disabled RLS, demo data and mismatched migration hashes',async()=>{
 await db.exec('GRANT USAGE ON SCHEMA attendance TO PUBLIC; ALTER TABLE attendance.stores DISABLE ROW LEVEL SECURITY;');
 await db.query('UPDATE attendance.businesses SET is_demo=true WHERE id=$1',[businessId]);
 const checks=await inspect();for(const id of ['private_schema','rls','no_demo'])expect(checks.find(c=>c.id===id)?.ok).toBe(false);
 const wrong=await inspectDatabase({query:(sql,args)=>db.query(sql,args)},businessId,[{...migrations[0],hash:'wrong'},...migrations.slice(1)]);expect(wrong.find(c=>c.id==='migrations')?.ok).toBe(false);
 await db.exec('REVOKE USAGE ON SCHEMA attendance FROM PUBLIC; ALTER TABLE attendance.stores ENABLE ROW LEVEL SECURITY;');await db.query('UPDATE attendance.businesses SET is_demo=false WHERE id=$1',[businessId]);
 expect((await inspect()).every(c=>c.ok)).toBe(true);
});
it('bucket preflight requires private JPEG and bounded uploads',()=>{
 expect(inspectBucket({public:false,file_size_limit:524288,allowed_mime_types:['image/jpeg']}).every(c=>c.ok)).toBe(true);
 expect(inspectBucket({public:true,file_size_limit:0,allowed_mime_types:['image/jpeg','image/png']}).every(c=>!c.ok)).toBe(true);
 expect(inspectBucket({public:false,file_size_limit:1048576}).find(c=>c.id==='bucket_size')?.ok).toBe(false);
});
it('production never enables prototype, even with development APP_ENV',()=>{
 expect(demoEnabled({NODE_ENV:'development',APP_ENV:'development'})).toBe(true);
 for(const APP_ENV of ['production','development',undefined])expect(demoEnabled({NODE_ENV:'production',APP_ENV})).toBe(false);
});
it('liveness is uncached and reveals no infrastructure or readiness claim',async()=>{
 const response=GET();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({status:'alive'});
});
