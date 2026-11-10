import { it,expect } from 'vitest';
import { randomBytes,randomUUID } from 'node:crypto';
import { mkdtemp,mkdir,rm,writeFile,readFile,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync,readdirSync } from 'node:fs';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { backupKey,encryptFile,decryptFile,fileHash } from '../../src/server/ops/encryption';
import { writeManifest,extractArchive,type BackupManifest } from '../../src/server/ops/archive';
it('encrypted files authenticate before plaintext is published; wrong key/tampering never overwrite output',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'princes-crypto-test-'));try{
  const input=join(folder,'source'),encrypted=join(folder,'source.enc'),restored=join(folder,'restored'),key=randomBytes(32);await writeFile(input,'sensitive fixture data');await encryptFile(input,encrypted,key);
  expect((await stat(encrypted)).mode&0o777).toBe(0o600);expect((await readFile(encrypted)).includes(Buffer.from('sensitive fixture data'))).toBe(false);
  await expect(decryptFile(encrypted,restored,randomBytes(32))).rejects.toThrow();await expect(stat(restored)).rejects.toThrow();await decryptFile(encrypted,restored,key);expect(await readFile(restored,'utf8')).toBe('sensitive fixture data');
  await expect(decryptFile(encrypted,restored,key)).rejects.toThrow();expect(await readFile(restored,'utf8')).toBe('sensitive fixture data');
  const bytes=await readFile(encrypted);bytes[21]^=1;await writeFile(encrypted,bytes);await expect(decryptFile(encrypted,join(folder,'tampered'),key)).rejects.toThrow();await expect(stat(join(folder,'tampered'))).rejects.toThrow();
  expect(()=>backupKey('weak')).toThrow();expect(backupKey('ab'.repeat(32))).toHaveLength(32);
 }finally{await rm(folder,{recursive:true,force:true})}
});
it('backup rejects path traversal and duplicate/invalid manifest targets',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'princes-manifest-test-'));try{const archive=join(folder,'archive'),scratch=join(folder,'scratch'),output=join(folder,'output');await Promise.all([mkdir(archive),mkdir(scratch),mkdir(output)]);const key=randomBytes(32),plain=join(scratch,'malicious.json');await writeFile(plain,JSON.stringify({version:1,format:'pg_dump_custom',createdAt:new Date().toISOString(),files:[{encrypted:'database.enc',target:'../../stolen',sha256:'a'.repeat(64)}]}));await encryptFile(plain,join(archive,'manifest.enc'),key);await expect(extractArchive(archive,output,key)).rejects.toThrow();await expect(stat(join(folder,'stolen'))).rejects.toThrow()}finally{await rm(folder,{recursive:true,force:true})}
});
it('restores encrypted PostgreSQL test snapshot, photo bytes, FK/RLS and immutable audit into a fresh isolated database',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'princes-restore-drill-')),source=new PGlite({extensions:{btree_gist}});let restored:PGlite|undefined;
 try{
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await source.exec(readFileSync('drizzle/'+file,'utf8'));
  const business=randomUUID(),employee=randomUUID(),photoPath=`${business}/${employee}/${randomUUID()}.jpg`;
  await source.query("INSERT INTO attendance.businesses(id,name) VALUES($1,'Restore drill fiktif')",[business]);await source.query("INSERT INTO attendance.employees(id,business_id,employee_code,full_name) VALUES($1,$2,'RESTORE-1','Orang fiktif')",[employee,business]);
  const store=randomUUID(),schedule=randomUUID(),session=randomUUID();
  await source.query("INSERT INTO attendance.stores(id,business_id,code,name,address,lat,lng) VALUES($1,$2,'RESTORE','Toko tes','Alamat fiktif',0,0)",[store,business]);
  await source.query("INSERT INTO attendance.schedules(id,employee_id,store_id,starts_at,ends_at,status,created_by,rule_snapshot) VALUES($1,$2,$3,now()-interval '1 hour',now()+interval '1 hour','published',$2,'{}')",[schedule,employee,store]);
  await source.query('INSERT INTO attendance.attendance_sessions(id,employee_id,schedule_id,check_in_at) VALUES($1,$2,$3,now())',[session,employee,schedule]);
  await source.query("INSERT INTO attendance.attendance_events(session_id,employee_id,store_id,event_type,photo_path,location_status,review_status,idempotency_key,rule_snapshot) VALUES($1,$2,$3,'check_in',$4,'inside','not_required',$5,'{}')",[session,employee,store,photoPath,randomUUID()]);
  await source.query("INSERT INTO attendance.audit_logs(actor_id,action,entity_type,metadata_redacted) VALUES($1,'test.restore','test','{}')",[employee]);
  const archive=join(folder,'archive'),scratch=join(folder,'scratch'),output=join(folder,'output');await Promise.all([mkdir(archive),mkdir(scratch),mkdir(output)]);
  const snapshot=await source.dumpDataDir('gzip'),raw=join(scratch,'database.dump'),photo=join(scratch,'photo.jpg'),key=randomBytes(32);await writeFile(raw,new Uint8Array(await snapshot.arrayBuffer()));await writeFile(photo,await sharp({create:{width:320,height:400,channels:3,background:'#8095f5'}}).jpeg().toBuffer());
  const manifest:BackupManifest={version:1,format:'pglite_test_snapshot',createdAt:new Date().toISOString(),files:[{encrypted:'database.enc',target:'database.dump',sha256:await fileHash(raw)},{encrypted:'photo-00000000.enc',target:photoPath,sha256:await fileHash(photo)}]};
  await encryptFile(raw,join(archive,'database.enc'),key);await encryptFile(photo,join(archive,'photo-00000000.enc'),key);await writeManifest(archive,manifest,key,scratch);
  const verified=await extractArchive(archive,output,key);expect(verified.format).toBe('pglite_test_snapshot');expect(await fileHash(join(output,'photos',photoPath))).toBe(await fileHash(photo));
  restored=new PGlite({loadDataDir:new Blob([new Uint8Array(await readFile(join(output,'database.dump')))]),extensions:{btree_gist}});
  expect((await restored.query<{photo_path:string}>('SELECT photo_path FROM attendance.attendance_events WHERE session_id=$1',[session])).rows[0].photo_path).toBe(photoPath);
  expect((await restored.query('SELECT * FROM attendance.employees WHERE id=$1',[employee])).rows).toHaveLength(1);
  expect((await restored.query<{n:number}>("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='attendance' AND c.relkind='r' AND c.relrowsecurity")).rows[0].n).toBe(18);
  await expect(restored.query('DELETE FROM attendance.audit_logs')).rejects.toThrow('append-only');await expect(restored.query("INSERT INTO attendance.employees(business_id,employee_code,full_name) VALUES($1,'BAD','Bad')",[randomUUID()])).rejects.toThrow();
 }finally{await restored?.close();await source.close();await rm(folder,{recursive:true,force:true})}
},30000);
