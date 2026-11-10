import { existsSync } from 'node:fs';
import pg from 'pg';
import { z } from 'zod';
import { authDatabase } from '../src/server/auth/database';
import { SupabaseStorage } from '../src/server/storage/supabase';
import { reconcileUploads } from '../src/server/attendance/service';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const config=z.object({DATABASE_URL:z.url(),SUPABASE_URL:z.url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().min(1)}).parse(process.env);
const pool=new pg.Pool({connectionString:config.DATABASE_URL,max:1,connectionTimeoutMillis:5000});
try{
 const storage=new SupabaseStorage(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,config.SUPABASE_STORAGE_BUCKET);
 const count=await authDatabase(pool).transaction(c=>reconcileUploads(c,storage));
 console.log('Jurnal upload kedaluwarsa diproses:',count);
}catch{console.error('Rekonsiliasi belum selesai. Jalankan kembali setelah koneksi DB/storage tersedia.');process.exitCode=1}finally{await pool.end()}
