import { existsSync } from 'node:fs';
import { mkdir,mkdtemp,rm,writeFile,rename } from 'node:fs/promises';
import { join,resolve,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { readBoundedBytes } from '../src/server/security/body';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createPool } from '../src/server/security/pool';
import { z } from 'zod';
import { backupKey,encryptFile,fileHash } from '../src/server/ops/encryption';
import { extractArchive,writeManifest,photoPath,type BackupManifest } from '../src/server/ops/archive';
import { SupabaseStorage } from '../src/server/storage/supabase';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const [action,folderArg,outputArg]=process.argv.slice(2),key=backupKey(process.env.BACKUP_ENCRYPTION_KEY??'');
const temporary=await mkdtemp(join(tmpdir(),'princes-backup-'));let partial:string|undefined;
try{
 if(action==='verify'||action==='extract'){
  if(!folderArg)throw new Error('Folder backup wajib.');
  const output=action==='extract'?resolve(outputArg??''):temporary;
  if(action==='extract'){if(!outputArg||existsSync(output))throw new Error('Tujuan extract harus folder baru.');await mkdir(output,{mode:0o700})}
  try{const manifest=await extractArchive(resolve(folderArg),output,key);console.log('Backup terautentikasi; format:',manifest.format,'berkas:',manifest.files.length);if(action==='extract')console.log('Hasil plaintext ada pada folder tujuan privat. Hapus setelah restore selesai.')}
  catch(error){if(action==='extract')await rm(output,{recursive:true,force:true});throw error}
 }else if(action==='create'){
  const config=z.object({DATABASE_URL:z.url().refine(v=>['postgres:','postgresql:'].includes(new URL(v).protocol)),SUPABASE_URL:z.url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().min(1)}).parse(process.env);
  const destination=resolve(folderArg??join('.local','backups',new Date().toISOString().replace(/[:.]/g,'-')));if(existsSync(destination))throw new Error('Folder tujuan sudah ada.');await mkdir(dirname(destination),{recursive:true,mode:0o700});const staging=destination+'.incomplete-'+randomUUID();await mkdir(staging,{mode:0o700});partial=staging;
  if(process.env.DATABASE_SSL_CA)await writeFile(join(temporary,'root-ca.crt'),process.env.DATABASE_SSL_CA,{mode:0o600,flag:'wx'});
  const url=new URL(config.DATABASE_URL),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname),raw=join(temporary,'database.dump');
  const pool=createPool(config.DATABASE_URL,1,{statement_timeout:120000,idle_in_transaction_session_timeout:600000}),storage=new SupabaseStorage(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,config.SUPABASE_STORAGE_BUCKET);
  const connection=await pool.connect().catch(async error=>{await pool.end();throw error});
  const manifest:BackupManifest={version:1,format:'pg_dump_custom',createdAt:new Date().toISOString(),files:[]};
  try{
   await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const snapshot=String((await connection.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot);
   await new Promise<void>((resolveDone,reject)=>{
    const command=spawn('pg_dump',['--format=custom','--no-owner','--no-privileges','--schema=attendance','--schema=drizzle','--snapshot='+snapshot,'--file',raw],{env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:local?'disable':'verify-full',PGCONNECT_TIMEOUT:'10',PGSSLROOTCERT:process.env.DATABASE_SSL_CA?join(temporary,'root-ca.crt'):(process.env.PGSSLROOTCERT??'system')},stdio:'ignore',timeout:600000});
    command.once('error',()=>reject(new Error('pg_dump tidak tersedia atau gagal dijalankan.')));command.once('exit',exit=>exit===0?resolveDone():reject(new Error('pg_dump gagal. Periksa koneksi TLS dan versi client PostgreSQL.')));
   });
   manifest.files.push({encrypted:'database.enc',target:'database.dump',sha256:await fileHash(raw)});
   await encryptFile(raw,join(partial,'database.enc'),key);
   await storage.verifyPrivateBucket();let last='',index=0;
   while(true){const rows=(await connection.query<{photo_path:string}>('SELECT DISTINCT photo_path FROM attendance.attendance_events WHERE photo_path>$1 ORDER BY photo_path LIMIT 100',[last])).rows;if(!rows.length)break;
    for(const row of rows){const path=photoPath.parse(row.photo_path),url=await storage.getSignedReadUrl(path,60),response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Foto backup tidak dapat dibaca.');const bytes=await readBoundedBytes(response,524288);const rawPhoto=join(temporary,'photo-'+index+'.jpg'),encrypted='photo-'+String(index++).padStart(8,'0')+'.enc';await writeFile(rawPhoto,bytes,{flag:'wx',mode:0o600});manifest.files.push({encrypted,target:path,sha256:await fileHash(rawPhoto)});await encryptFile(rawPhoto,join(partial,encrypted),key);await rm(rawPhoto);last=path}
   }
   await connection.query('COMMIT');
  }catch(error){await connection.query('ROLLBACK').catch(()=>{});throw error}
  finally{connection.release();await pool.end()}
  await writeManifest(partial,manifest,key,temporary);await rename(partial,destination);partial=undefined;console.log('Backup database dan foto terenkripsi selesai; berkas:',manifest.files.length);
 }else throw new Error('Gunakan create, verify, atau extract.');
}catch{console.error('Operasi backup gagal; backup tidak dinyatakan selesai. Periksa konfigurasi, client PostgreSQL, koneksi, key, dan akses foto.');process.exitCode=1}
finally{await rm(temporary,{recursive:true,force:true});if(partial)await rm(partial,{recursive:true,force:true})}
