import { z } from 'zod';
import { join } from 'node:path';
import { mkdir,readFile,writeFile,stat } from 'node:fs/promises';
import { decryptFile,encryptFile,fileHash } from './encryption';
export const photoPath=z.string().regex(/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.jpg$/);
const manifestSchema=z.object({version:z.literal(1),format:z.enum(['pg_dump_custom','pglite_test_snapshot']),createdAt:z.iso.datetime(),files:z.array(z.object({encrypted:z.string().regex(/^(?:database|photo-\d{8})\.enc$/),target:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(1)}).strict().superRefine((m,c)=>{
 const names=new Set<string>(),targets=new Set<string>();for(const item of m.files){if(names.has(item.encrypted)||targets.has(item.target))c.addIssue({code:'custom',message:'Entri backup berulang.'});names.add(item.encrypted);targets.add(item.target);if(item.encrypted==='database.enc'?item.target!=='database.dump':!photoPath.safeParse(item.target).success)c.addIssue({code:'custom',message:'Path backup tidak valid.'})}
 if(!names.has('database.enc'))c.addIssue({code:'custom',message:'Database backup tidak ada.'});
});
export type BackupManifest=z.infer<typeof manifestSchema>;
export async function writeManifest(folder:string,manifest:BackupManifest,key:Buffer,temporaryFolder:string){
 const valid=manifestSchema.parse(manifest),plain=join(temporaryFolder,'manifest.json');await writeFile(plain,JSON.stringify(valid),{mode:0o600,flag:'wx'});await encryptFile(plain,join(folder,'manifest.enc'),key);
}
export async function extractArchive(folder:string,output:string,key:Buffer):Promise<BackupManifest>{
 // Caller creates a NEW private output directory; this function never overwrites a file.
 if((await stat(join(folder,'manifest.enc'))).size>16*1024*1024)throw new Error('Manifest terlalu besar.');
 const manifestPath=join(output,'manifest.json');await decryptFile(join(folder,'manifest.enc'),manifestPath,key);
 if((await stat(manifestPath)).size>16*1024*1024)throw new Error('Manifest terlalu besar.')
 const manifest=manifestSchema.parse(JSON.parse(await readFile(manifestPath,'utf8')));
 for(const item of manifest.files){const target=item.target==='database.dump'?join(output,'database.dump'):join(output,'photos',item.target);await mkdir(join(target,'..'),{recursive:true,mode:0o700});await decryptFile(join(folder,item.encrypted),target,key);if(await fileHash(target)!==item.sha256)throw new Error('Checksum backup tidak sesuai.')}
 return manifest;
}
