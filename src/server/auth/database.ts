import type pg from 'pg';
import { AuthError,type AuthDatabase } from './types';
const code=(error:unknown)=>typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
export function authDatabase(pool:pg.Pool):AuthDatabase{
 return {async transaction(work){
  // Retry only explicit PostgreSQL aborts, never an ambiguous COMMIT/network failure.
  for(let attempt=0;attempt<3;attempt++){
   const client=await pool.connect();let broken=false;
   try{await client.query('BEGIN');const result=await work({query:(text,values)=>client.query(text,values)});await client.query('COMMIT');return result}
   catch(error){
    try{await client.query('ROLLBACK')}catch{broken=true}
    if(['40P01','40001'].includes(code(error))){if(attempt<2)continue;throw new AuthError('TRANSACTION_BUSY',409,'Data sedang diproses bersamaan. Muat ulang atau coba lagi dengan pengiriman yang sama.')}
    if(code(error)==='55P03')throw new AuthError('TRANSACTION_BUSY',409,'Data sedang diproses. Tunggu sebentar lalu coba lagi.');
    throw error;
   }finally{client.release(broken)}
  }
  throw new Error('Transaction retry exhausted');
 }};
}
