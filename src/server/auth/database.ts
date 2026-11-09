import pg from 'pg';
import type { AuthDatabase } from './types';
export function authDatabase(pool:pg.Pool):AuthDatabase{
 return {async transaction(work){
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await work({query:(text,values)=>client.query(text,values)});await client.query('COMMIT');return result}
  catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 }};
}
