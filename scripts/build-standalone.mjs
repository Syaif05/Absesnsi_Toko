import { spawnSync } from 'node:child_process';
import { cp,mkdir,readdir,rm,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env:{...process.env,BUILD_STANDALONE:'true',NODE_ENV:'production'},stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
const output=join('.next','standalone');
if(existsSync('public'))await cp('public',join(output,'public'),{recursive:true});
await mkdir(join(output,'.next'),{recursive:true});await cp(join('.next','static'),join(output,'.next','static'),{recursive:true});
const secrets=['DATABASE_URL','SESSION_SECRET','SUPABASE_SERVICE_ROLE_KEY','BOOTSTRAP_OWNER_PASSWORD','BACKUP_ENCRYPTION_KEY'].flatMap(key=>{const value=process.env[key];return value&&value.length>=12?[value,encodeURIComponent(value),JSON.stringify(value).slice(1,-1)]:[]});
async function sanitize(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name);if(entry.name.startsWith('.env'))await rm(path,{force:true,recursive:true});else if(entry.isDirectory())await sanitize(path);else if(/\.(js|json|map|html|css|ts)$/.test(entry.name)){const content=await readFile(path,'utf8');if(secrets.some(value=>content.includes(value)))throw new Error('Secret detected in standalone artifact')}}}
try{await sanitize(output);console.log('Standalone tersedia di .next/standalone; ENV harus diinjeksi saat runtime. Jangan menyalin .env ke paket.')}catch{await rm(output,{recursive:true,force:true});console.error('Paket standalone ditolak karena pemeriksaan secret gagal.');process.exitCode=1}
