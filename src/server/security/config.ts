import { z } from 'zod';
export const databaseUrl=z.url().refine(value=>['postgres:','postgresql:'].includes(new URL(value).protocol),'Gunakan URI PostgreSQL.');
const appUrl=z.url().refine(value=>{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'},'Gunakan origin aplikasi tanpa path/credential.');
export const runtimeSchema=z.object({
 DATABASE_URL:databaseUrl,APP_BUSINESS_ID:z.uuid(),SESSION_SECRET:z.string().min(32).max(512).refine(v=>!/(REPLACE_|CHANGE_ME)/.test(v)),APP_BASE_URL:appUrl,
 DATABASE_POOL_MAX:z.coerce.number().int().min(1).max(10).default(3),NODE_ENV:z.enum(['development','test','production']).default('development'),
}).superRefine((value,ctx)=>{if(value.NODE_ENV==='production'&&new URL(value.APP_BASE_URL).protocol!=='https:')ctx.addIssue({code:'custom',path:['APP_BASE_URL'],message:'Produksi memerlukan HTTPS.'})});
