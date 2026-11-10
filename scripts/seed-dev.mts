import { existsSync } from 'node:fs';
import { createPool } from '../src/server/security/pool';
import { assertDevelopmentSeed,seedSql } from '../src/server/db/seed';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
assertDevelopmentSeed(process.env);
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=createPool(process.env.DATABASE_URL,1);const client=await pool.connect();
try{await client.query('BEGIN');await client.query(seedSql);await client.query('COMMIT');console.log('DEMO seed ready; no login credentials created')}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{client.release();await pool.end()}
