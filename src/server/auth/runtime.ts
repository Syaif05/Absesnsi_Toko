import 'server-only';
import { runtimeSchema } from '../security/config';
import { createPool } from '../security/pool';
import { AuthService } from './service';
import { authDatabase } from './database';
let service:AuthService|undefined;
export function authRuntime(){
 const config=runtimeSchema.parse(process.env);
 if(!service){
  const pool=createPool(config.DATABASE_URL,config.DATABASE_POOL_MAX);
  service=new AuthService(authDatabase(pool),config.APP_BUSINESS_ID,config.SESSION_SECRET);
 }
 return {service,origin:new URL(config.APP_BASE_URL).origin};
}
