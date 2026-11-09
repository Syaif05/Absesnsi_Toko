import 'server-only';
import pg from 'pg';
import { z } from 'zod';
import { AuthService } from './service';
import { authDatabase } from './database';
const configSchema=z.object({DATABASE_URL:z.url(),APP_BUSINESS_ID:z.uuid(),SESSION_SECRET:z.string().min(32).refine(x=>!x.includes('REPLACE_')),APP_BASE_URL:z.url()});
let service:AuthService|undefined;
export function authRuntime(){
 const config=configSchema.parse(process.env);
 if(!service){
  const pool=new pg.Pool({connectionString:config.DATABASE_URL,max:3,connectionTimeoutMillis:5000});
  service=new AuthService(authDatabase(pool),config.APP_BUSINESS_ID,config.SESSION_SECRET);
 }
 return {service,origin:new URL(config.APP_BASE_URL).origin};
}
