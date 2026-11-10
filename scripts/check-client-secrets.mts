import { existsSync } from 'node:fs';
import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const folder=join('.next','static');if(!existsSync(folder))throw new Error('Jalankan pnpm build terlebih dahulu.');
const names=['DATABASE_URL','SESSION_SECRET','SUPABASE_SERVICE_ROLE_KEY','BOOTSTRAP_OWNER_PASSWORD','BACKUP_ENCRYPTION_KEY'];
const needles=names.flatMap(name=>{const value=process.env[name];return value&&value.length>=12?[{name,values:[value,encodeURIComponent(value),JSON.stringify(value).slice(1,-1)]}]:[]});
async function inspect(directory:string){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await inspect(path);else if(/\.(?:js|json|map|html|css)$/.test(entry.name)){const content=await readFile(path,'utf8');for(const needle of needles)if(needle.values.some(value=>content.includes(value)))throw new Error('Secret server ditemukan di artefak browser: '+needle.name)}}}
try{await inspect(folder);console.log('Artefak browser tidak mengandung nilai secret server yang dikonfigurasi.')}catch{console.error('Pemeriksaan secret browser gagal. Jangan deploy artefak ini; periksa impor/env publik.');process.exitCode=1}
