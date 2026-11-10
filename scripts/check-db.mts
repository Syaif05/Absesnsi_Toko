import { existsSync } from 'node:fs';
import { createPool } from '../src/server/security/pool';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.DATABASE_URL){console.error('DATABASE_URL belum diisi.');process.exit(1)}
const pool=createPool(process.env.DATABASE_URL,1);
try{const result=await pool.query('select current_database() as database');console.log('Database terhubung:',result.rows[0].database)}
catch(error){const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'UNAVAILABLE';console.error('Koneksi database gagal ('+(/^[A-Z0-9_]{2,24}$/.test(code)?code:'UNAVAILABLE')+'). Periksa konfigurasi/koneksi.');process.exitCode=1}
finally{await pool.end()}
