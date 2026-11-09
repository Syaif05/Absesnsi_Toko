import { existsSync } from 'node:fs';
import pg from 'pg';
import { assertDevelopmentSeed,seedSql } from '../src/server/db/seed';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
assertDevelopmentSeed(process.env);
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
try{await client.connect();await client.query('BEGIN');await client.query(seedSql);await client.query('COMMIT');console.log('DEMO seed ready; no login credentials created')}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}finally{await client.end()}
