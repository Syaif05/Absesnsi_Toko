import { existsSync } from 'node:fs';
import { createPool } from '../src/server/security/pool';
import { z } from 'zod';
import { authDatabase } from '../src/server/auth/database';
import { AuthService } from '../src/server/auth/service';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const config=z.object({DATABASE_URL:z.url(),APP_BUSINESS_ID:z.uuid(),SESSION_SECRET:z.string().min(32),BOOTSTRAP_OWNER_ID:z.string().min(1),BOOTSTRAP_OWNER_PASSWORD:z.string().min(12),BOOTSTRAP_OWNER_NAME:z.string().default('Owner Reza'),BOOTSTRAP_BUSINESS_NAME:z.string().default('Absensi Kita')}).parse(process.env);
const pool=createPool(config.DATABASE_URL,1);
try{
 await new AuthService(authDatabase(pool),config.APP_BUSINESS_ID,config.SESSION_SECRET).bootstrap({code:config.BOOTSTRAP_OWNER_ID,password:config.BOOTSTRAP_OWNER_PASSWORD,fullName:config.BOOTSTRAP_OWNER_NAME,businessName:config.BOOTSTRAP_BUSINESS_NAME});
 console.log('Owner berhasil dibuat. Hapus variabel BOOTSTRAP_OWNER_* dari environment.');
}finally{await pool.end()}
