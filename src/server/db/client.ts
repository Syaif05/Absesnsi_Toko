import 'server-only';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export function createDatabase(connectionString:string){
 if(!connectionString)throw new Error('DATABASE_URL is required');
 const pool=new pg.Pool({connectionString,max:3,connectionTimeoutMillis:5000});
 return {db:drizzle(pool,{schema}),close:()=>pool.end()};
}
