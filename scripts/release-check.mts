import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type pg from 'pg';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { runtimeSchema } from '../src/server/security/config';
import { createPool } from '../src/server/security/pool';
import { inspectDatabase,inspectBucket,type ReleaseCheck } from '../src/server/release/readiness';
const envFile=process.env.RELEASE_ENV_FILE??'.env.production.local';if(existsSync(envFile))process.loadEnvFile(envFile);
const checks:ReleaseCheck[]=[],config=runtimeSchema.safeParse({...process.env,NODE_ENV:'production'});
checks.push({id:'production_config',ok:config.success,detail:'ENV runtime production/HTTPS valid'});
checks.push({id:'production_mode',ok:process.env.APP_ENV==='production'&&process.env.ALLOW_DEMO_SEED==='false',detail:'APP_ENV production; seed demo dinonaktifkan'});
checks.push({id:'bootstrap_removed',ok:!process.env.BOOTSTRAP_OWNER_PASSWORD&&!process.env.BOOTSTRAP_OWNER_ID,detail:'Secret/ID bootstrap sudah dihapus setelah initial setup'});
if(config.success){
 let pool:pg.Pool|undefined,client:pg.PoolClient|undefined;
 try{pool=createPool(config.data.DATABASE_URL,1);client=await pool.connect();await client.query('BEGIN READ ONLY');await client.query("SET LOCAL statement_timeout='8s'");checks.push(...await inspectDatabase({query:(sql,args)=>client!.query(sql,args)},config.data.APP_BUSINESS_ID,readMigrationFiles({migrationsFolder:'./drizzle'}).map(m=>({hash:m.hash,createdAt:m.folderMillis}))));await client.query('ROLLBACK')}
 catch{await client?.query('ROLLBACK').catch(()=>{});checks.push({id:'database',ok:false,detail:'Database/jurnal belum dapat diverifikasi; tidak ada perubahan data'})}
 finally{client?.release();await pool?.end()}
}
const storage=z.object({STORAGE_DRIVER:z.literal('supabase'),SUPABASE_URL:z.url().refine(v=>new URL(v).protocol==='https:'),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().regex(/^[a-z0-9-]+$/)}).safeParse(process.env);
if(storage.success){try{const c=storage.data,url=new URL('/storage/v1/bucket/'+c.SUPABASE_STORAGE_BUCKET,c.SUPABASE_URL),response=await fetch(url,{headers:{apikey:c.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+c.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Unavailable');checks.push(...inspectBucket(await response.json()))}catch{checks.push({id:'storage',ok:false,detail:'Metadata Storage belum dapat diverifikasi'})}}
else checks.push({id:'storage',ok:false,detail:'Konfigurasi Storage belum lengkap'});
const report={generatedAt:new Date().toISOString(),technicalReady:checks.every(c=>c.ok),operationalAcceptance:'NOT_VERIFIED',checks};
for(const check of checks)console.log(`${check.ok?'PASS':'FAIL'} ${check.id}: ${check.detail}`);
console.log('Hasil hanya kesiapan teknis; bukan persetujuan pilot/go-live.');
const output=process.argv[2];if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
if(!report.technicalReady)process.exitCode=1;
