import { it,expect,vi } from 'vitest';
import type pg from 'pg';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { validatePhoto } from '../../src/server/attendance/photo';
import { readBoundedBytes } from '../../src/server/security/body';
import { runtimeSchema } from '../../src/server/security/config';
import { postgresOptions } from '../../src/server/security/pool';
import { securityHeaders } from '../../src/server/security/headers';
import { reportFailure } from '../../src/server/security/observability';
import { authDatabase } from '../../src/server/auth/database';
import { createAuthHandler,readBody,assertSameOrigin } from '../../src/server/auth/http';
const env={DATABASE_URL:'postgresql://test:private-value@db.example/postgres',APP_BUSINESS_ID:'a0000000-0000-4000-8000-000000000001',SESSION_SECRET:'only-a-test-secret-'.repeat(3),APP_BASE_URL:'http://localhost:3000'};
it('runtime rejects wrong DB protocol, production HTTP, credential-bearing origins and weak placeholders',()=>{
 expect(runtimeSchema.parse(env).DATABASE_POOL_MAX).toBe(3);
 for(const patch of [{DATABASE_URL:'https://example.com'},{NODE_ENV:'production'},{APP_BASE_URL:'https://user:password@example.com/'},{APP_BASE_URL:'https://example.com/path'},{SESSION_SECRET:'REPLACE_'.repeat(8)}])expect(runtimeSchema.safeParse({...env,...patch}).success).toBe(false);
 expect(runtimeSchema.safeParse({...env,NODE_ENV:'production',APP_BASE_URL:'https://attendance.example.com'}).success).toBe(true);
});
it('remote TLS cannot be downgraded by connection string flags; loopback development remains available',()=>{
 try{postgresOptions('private-url-fixture')}catch(error){expect(JSON.stringify(error)).not.toContain('private-url-fixture')}
 expect(postgresOptions(env.DATABASE_URL).ssl).toEqual({rejectUnauthorized:true});
 const options=postgresOptions(env.DATABASE_URL+'?sslmode=require&uselibpqcompat=true',2,'test-root-ca');expect(options.ssl).toEqual({rejectUnauthorized:true,ca:'test-root-ca'});expect(options.connectionString).not.toContain('sslmode');expect(options.lock_timeout).toBe(5000);
 expect(()=>postgresOptions(env.DATABASE_URL+'?sslmode=disable')).toThrow();expect(postgresOptions('postgresql://test:pass@127.0.0.1/db').ssl).toBe(false);
});
it('security headers prevent framing, sniffing and unnecessary device permissions without disabling selfie/GPS',()=>{
 const headers=Object.fromEntries(securityHeaders(true).map(v=>[v.key,v.value]));expect(headers['X-Frame-Options']).toBe('DENY');expect(headers['X-Content-Type-Options']).toBe('nosniff');expect(headers['Permissions-Policy']).toContain('camera=(self)');expect(headers['Permissions-Policy']).toContain('microphone=()');expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");expect(securityHeaders(false).some(h=>h.key==='Strict-Transport-Security')).toBe(false);
});
it('structured logs include correlation/code and exclude error text, query, cookie, PIN and keys',()=>{
 const output:string[]=[];reportFailure({code:'23505',message:'PIN=123456 secret=private-key',query:'select private',cookie:'session-cookie',stack:'DATABASE_URL=private'},'request-fixture','attendance',line=>output.push(line));
 expect(JSON.parse(output[0])).toEqual({level:'error',scope:'attendance',requestId:'request-fixture',code:'23505'});
 expect(output[0]).not.toMatch(/123456|private|session-cookie|DATABASE_URL/);
 reportFailure({code:'Bearer-SECRET-TOKEN'},'request-fixture','auth',line=>output.push(line));expect(JSON.parse(output[1]).code).toBe('UNEXPECTED');
});
it('JSON reader rejects oversized streamed data even without content-length and requires exact MIME',async()=>{
 const request=new Request('http://localhost',{method:'POST',body:'x'.repeat(4097)});await expect(readBody(request)).rejects.toMatchObject({status:400});
 expect(()=>assertSameOrigin(new Request('http://localhost',{headers:{origin:'http://localhost','content-type':'application/json-evil'}}),'http://localhost')).toThrow();
 expect(()=>assertSameOrigin(new Request('http://localhost',{headers:{origin:'http://localhost','content-type':'application/json; charset=utf-8'}}),'http://localhost')).not.toThrow();
 const handler=createAuthHandler(()=>{throw new Error('should not need config')});expect((await handler(new NextRequest('http://localhost',{method:'PATCH'}),'owner-login')).status).toBe(405);
});
function fakePool(failure:string,atCommit=false){
 let attempts=0,commits=0,rollbacks=0;const release=vi.fn();
 const pool={connect:async()=>({release,query:async(sql:string)=>{if(sql==='BEGIN')attempts++;if(sql==='ROLLBACK')rollbacks++;if(sql==='COMMIT'){commits++;if(atCommit)throw Object.assign(new Error('private connection failure'),{code:failure})}if(sql==='WORK'&&(!atCommit)&&(failure==='always'||attempts===1))throw Object.assign(new Error('private query failure'),{code:failure==='always'?'40P01':failure});return {rows:[]}}})} as unknown as pg.Pool;
 return {db:authDatabase(pool),stats:()=>({attempts,commits,rollbacks}),release};
}
it('only definite transaction aborts are retried, then commit once',async()=>{
 for(const code of ['40P01','40001']){const fake=fakePool(code);await fake.db.transaction(c=>c.query('WORK'));expect(fake.stats()).toEqual({attempts:2,commits:1,rollbacks:1});expect(fake.release).toHaveBeenCalledTimes(2)}
});
it('ambiguous COMMIT failure is never retried; persistent aborts stop at three attempts',async()=>{
 const ambiguous=fakePool('ECONNRESET',true);await expect(ambiguous.db.transaction(c=>c.query('WORK'))).rejects.toThrow();expect(ambiguous.stats().attempts).toBe(1);
 const busy=fakePool('always');await expect(busy.db.transaction(c=>c.query('WORK'))).rejects.toMatchObject({code:'TRANSACTION_BUSY',status:409});expect(busy.stats().attempts).toBe(3);
});
it('lock timeout returns a retryable business error without replaying an operation',async()=>{
 const fake=fakePool('55P03');await expect(fake.db.transaction(c=>c.query('WORK'))).rejects.toMatchObject({code:'TRANSACTION_BUSY'});expect(fake.stats().attempts).toBe(1);
});

it('stalled body streams time out and are cancelled, rather than holding a request indefinitely',async()=>{
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({cancel(){cancelled=true}});
 await expect(readBoundedBytes(new Response(stream),4096,5)).rejects.toMatchObject({status:408});expect(cancelled).toBe(true);
});
it('invalid UTF-8 JSON is rejected instead of silently changing input',async()=>{
 const bytes=new Uint8Array([123,34,97,34,58,34,255,34,125]);await expect(readBody(new Request('http://localhost',{method:'POST',body:bytes}))).rejects.toMatchObject({status:400});
});

it('small compressed JPEG with excessive pixel dimensions is rejected before expensive processing',async()=>{
 const jpeg=await sharp({create:{width:3072,height:3072,channels:3,background:'#8095f5'}}).jpeg({quality:40}).toBuffer();expect(jpeg.length).toBeLessThan(524288);await expect(validatePhoto(jpeg,'image/jpeg')).rejects.toMatchObject({code:'INVALID_PHOTO',status:400});
});
