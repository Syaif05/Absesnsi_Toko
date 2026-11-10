import { existsSync } from 'node:fs';
import { z } from 'zod';
import { SupabaseStorage } from '../src/server/storage/supabase';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const config=z.object({SUPABASE_URL:z.url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().regex(/^[a-z0-9-]+$/)}).parse(process.env);
const base=new URL(config.SUPABASE_URL).origin+'/storage/v1',headers={apikey:config.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+config.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'};
try{
 const response=await fetch(base+'/bucket',{headers,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Daftar bucket belum dapat diperiksa.');
 const buckets=z.array(z.object({id:z.string(),public:z.boolean()})).parse(await response.json());
 const bucket=buckets.find(b=>b.id===config.SUPABASE_STORAGE_BUCKET);
 if(!bucket){
  const created=await fetch(base+'/bucket',{method:'POST',headers,body:JSON.stringify({id:config.SUPABASE_STORAGE_BUCKET,name:config.SUPABASE_STORAGE_BUCKET,public:false,file_size_limit:524288,allowed_mime_types:['image/jpeg']}),signal:AbortSignal.timeout(15000)});
  if(!created.ok)throw new Error('Bucket belum dapat dibuat. Periksa service role key dan akses project.');
 }
 await new SupabaseStorage(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,config.SUPABASE_STORAGE_BUCKET).verifyPrivateBucket();
 console.log('Bucket privat siap. Tidak ada foto atau data karyawan yang dibuat.');
}catch(error){const cause=error instanceof Error&&'cause' in error?error.cause:undefined;const code=typeof cause==='object'&&cause!==null&&'code' in cause?String(cause.code):'';console.error('Storage belum siap.'+(code?' Kode jaringan: '+code+'.':'')+' Periksa koneksi, service role key, dan pastikan bucket tidak public.');process.exitCode=1}
