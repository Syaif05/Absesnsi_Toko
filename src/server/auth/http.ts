import { NextRequest,NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthError } from './types';
import { SESSION_SECONDS,type AuthService } from './service';
export const cookieName=process.env.NODE_ENV==='production'?'__Host-princes-session':'princes-session';
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
export function assertSameOrigin(request:Request,origin:string){
 if(request.headers.get('origin')!==origin)throw new AuthError('INVALID_ORIGIN',403,'Permintaan tidak diizinkan.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError('INVALID_INPUT',400,'Kirim data JSON.');
}
export async function readBody(request:Request){
 const reader=request.body?.getReader();let text='';let bytes=0;
 if(reader){const decoder=new TextDecoder();while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>4096){await reader.cancel();throw new AuthError('INVALID_INPUT',400,'Data terlalu besar.')}text+=decoder.decode(next.value,{stream:true})}}
 try{return JSON.parse(text) as unknown}catch{throw new AuthError('INVALID_INPUT',400,'Data tidak valid.')}
}
const input=z.object({code:z.unknown(),credential:z.unknown()}).strict();
export function createAuthHandler(getRuntime:()=>{service:AuthService;origin:string}){
 return async(request:NextRequest,action:string,targetId?:string)=>{
  try{
   // Validate config before touching DB; unavailable infrastructure never becomes demo success.
   let runtime:ReturnType<typeof getRuntime>;
   try{runtime=getRuntime()}catch{throw new AuthError('AUTH_UNAVAILABLE',503,'Login belum tersedia. Konfigurasi database perlu disiapkan.')}
   const {service,origin}=runtime;const token=request.cookies.get(cookieName)?.value??'';
   let response:NextResponse;
   if(request.method==='GET'&&action==='me'){
    response=NextResponse.json({data:await service.me(token,true)});
   }else{
    assertSameOrigin(request,origin);const body=await readBody(request);
    if(action==='employee-login'||action==='owner-login'){
     const data=input.parse(body);const result=await service.login(action==='owner-login'?'owner':'employee',data.code,data.credential);
     response=NextResponse.json({data:{mustChangePin:result.mustChangePin}});
     response.cookies.set(cookieName,result.token,{...cookieOptions,maxAge:SESSION_SECONDS});
    }else if(action==='logout'){
     await service.logout(token);response=NextResponse.json({data:{success:true}});response.cookies.set(cookieName,'',{...cookieOptions,maxAge:0});
    }else if(action==='change-pin'){
     const data=z.object({currentPin:z.unknown(),newPin:z.unknown()}).strict().parse(body);
     await service.changePin(token,data.currentPin,data.newPin);response=NextResponse.json({data:{success:true}});response.cookies.set(cookieName,'',{...cookieOptions,maxAge:0});
    }else if(action==='reset-pin'&&targetId){
     z.object({}).strict().parse(body);response=NextResponse.json({data:await service.resetPin(token,targetId)});
    }else throw new AuthError('NOT_FOUND',404,'Halaman tidak ditemukan.');
   }
   response.headers.set('Cache-Control','no-store');return response;
  }catch(error){
   const known=error instanceof AuthError;const validation=error instanceof z.ZodError;
   return NextResponse.json({error:{code:known?error.code:validation?'INVALID_INPUT':'AUTH_UNAVAILABLE',message:known?error.message:validation?'Periksa kembali data yang Anda masukkan.':'Layanan belum tersedia. Coba lagi nanti.',requestId:randomUUID()}},{status:known?error.status:validation?400:503,headers:{'Cache-Control':'no-store'}});
  }
 };
}
