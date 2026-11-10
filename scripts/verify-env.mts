import { existsSync } from 'node:fs';
import { z } from 'zod';
import { runtimeSchema } from '../src/server/security/config';
import { postgresOptions } from '../src/server/security/pool';
import { backupKey } from '../src/server/ops/encryption';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
try{
 const config=runtimeSchema.parse(process.env);postgresOptions(config.DATABASE_URL,config.DATABASE_POOL_MAX);
 z.object({STORAGE_DRIVER:z.literal('supabase'),SUPABASE_URL:z.url().refine(v=>new URL(v).protocol==='https:'),SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),SUPABASE_STORAGE_BUCKET:z.string().regex(/^[a-z0-9-]+$/)}).parse(process.env);
 if(process.env.BACKUP_ENCRYPTION_KEY)backupKey(process.env.BACKUP_ENCRYPTION_KEY);
 console.log('ENV runtime valid; nilai rahasia tidak ditampilkan. Koneksi database/storage belum diuji oleh perintah ini.');
}catch(error){
 const fields=error instanceof z.ZodError?[...new Set(error.issues.map(i=>i.path.join('.')))].join(', '):'TLS database atau key backup';
 console.error('Konfigurasi belum valid. Periksa: '+fields+'.');process.exitCode=1;
}
