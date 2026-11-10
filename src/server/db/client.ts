import 'server-only';
import { createPool } from '../security/pool';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export function createDatabase(connectionString:string){
 if(!connectionString)throw new Error('DATABASE_URL is required');
 const pool=createPool(connectionString);
 return {db:drizzle(pool,{schema}),close:()=>pool.end()};
}
