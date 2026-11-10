import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { SupabaseStorage } from '../src/server/storage/supabase';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const config=z.object({SUPABASE_URL:z.url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().min(1)}).parse(process.env);
const storage=new SupabaseStorage(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,config.SUPABASE_STORAGE_BUCKET);
// Synthetic solid rectangle: no real face and never linked to an attendance event.
const path=`${randomUUID()}/${randomUUID()}/${randomUUID()}.jpg`;
try{
 const image=await sharp({create:{width:320,height:400,channels:3,background:'#8095f5'}}).jpeg().toBuffer();
 await storage.uploadPrivate(path,image);
 const url=await storage.getSignedReadUrl(path,60);
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok||!(await response.arrayBuffer()).byteLength)throw new Error('Signed read failed');
 const publicUrl=new URL(`/storage/v1/object/public/${config.SUPABASE_STORAGE_BUCKET}/${path}`,config.SUPABASE_URL);
 const anonymous=await fetch(publicUrl,{signal:AbortSignal.timeout(15000)});
 if(![400,401,403,404].includes(anonymous.status))throw new Error('Anonymous read was not denied');
 console.log('Upload privat dan signed URL berhasil; pembacaan publik ditolak.');
}catch{console.error('Pemeriksaan storage gagal. Tidak ada absensi dibuat.');process.exitCode=1}
finally{
 try{await storage.delete(path);console.log('Objek sintetis uji sudah dihapus.')}
 catch{console.error('Objek uji belum dapat dibersihkan; hapus path berikut secara manual:',path);process.exitCode=1}
}
