import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { reportFailure } from './observability';
export function postgresOptions(connectionString:string,max=3,ca=process.env.DATABASE_SSL_CA):pg.PoolConfig{
 let url:URL;try{url=new URL(connectionString)}catch{throw new Error('PostgreSQL URI required')}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('PostgreSQL URI required');
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname),mode=url.searchParams.get('sslmode');
 if(!local&&['disable','no-verify'].includes(mode??''))throw new Error('Remote PostgreSQL requires verified TLS');
 const secure=!local||!!mode&&mode!=='disable';
 // node-postgres can override explicit TLS options with connection-string flags.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 return {connectionString:url.toString(),ssl:secure?{rejectUnauthorized:true,...(ca?{ca}:{})}:false,max,connectionTimeoutMillis:5000,statement_timeout:15000,lock_timeout:5000,idle_in_transaction_session_timeout:45000};
}
export function createPool(connectionString:string,max=3,options:Pick<pg.PoolConfig,'statement_timeout'|'idle_in_transaction_session_timeout'>={}){
 const pool=new pg.Pool({...postgresOptions(connectionString,max),...options});
 pool.on('error',error=>reportFailure(error,randomUUID(),'idle_database'));
 return pool;
}
