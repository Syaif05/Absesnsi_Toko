import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool } from '../src/server/security/pool';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=createPool(process.env.DATABASE_URL,1,{statement_timeout:120000});
try{await migrate(drizzle(pool),{migrationsFolder:'./drizzle'});console.log('Migrations applied')}finally{await pool.end()}
