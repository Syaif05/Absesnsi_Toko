import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
import { createReadStream,createWriteStream } from 'node:fs';
import { appendFile,link,open,unlink,writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
const magic=Buffer.from('PRINCBK1');
export function backupKey(value:string){if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('BACKUP_ENCRYPTION_KEY harus 64 digit hex acak.');return Buffer.from(value,'hex')}
export async function fileHash(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')}
export async function encryptFile(source:string,destination:string,key:Buffer){
 const temporary=destination+'.partial-'+randomBytes(8).toString('hex'),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(magic);
 try{
  await writeFile(temporary,Buffer.concat([magic,nonce]),{flag:'wx',mode:0o600});
  await pipeline(createReadStream(source),cipher,createWriteStream(temporary,{flags:'a',mode:0o600}));
  await appendFile(temporary,cipher.getAuthTag());await link(temporary,destination);
 }finally{await unlink(temporary).catch(()=>{})}
}
export async function decryptFile(source:string,destination:string,key:Buffer){
 const temporary=destination+'.partial-'+randomBytes(8).toString('hex'),file=await open(source,'r');
 try{
  const {size}=await file.stat();if(size<36)throw new Error('Backup tidak lengkap.');
  const header=Buffer.alloc(20),tag=Buffer.alloc(16);await file.read(header,0,20,0);await file.read(tag,0,16,size-16);
  if(!header.subarray(0,8).equals(magic))throw new Error('Format backup tidak didukung.');
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8));decipher.setAAD(magic);decipher.setAuthTag(tag);
  // Plaintext is published only after the entire GCM authentication succeeds.
  await pipeline(size===36?Readable.from([]):createReadStream(source,{start:20,end:size-17}),decipher,createWriteStream(temporary,{flags:'wx',mode:0o600}));
  await link(temporary,destination);
 }finally{await file.close();await unlink(temporary).catch(()=>{})}
}
