import { NextRequest,NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthError } from '../auth/types';
import { assertSameOrigin,readBody,cookieName } from '../auth/http';
import type { ApprovalService } from './service';
export function createApprovalHandler(getRuntime:()=>{approvals:ApprovalService;origin:string}) {
 return async(request:NextRequest,resource:'requests'|'decision'|'targets',id?:string)=>{
  try{
   let runtime:ReturnType<typeof getRuntime>;
   try{runtime=getRuntime()}catch{throw new AuthError('UNAVAILABLE',503,'Konfigurasi persetujuan belum siap.')}
   const {approvals,origin}=runtime,token=request.cookies.get(cookieName)?.value??'';
   let data:unknown;
   if(request.method==='GET'&&resource==='requests')data=id?await approvals.get(token,id):await approvals.list(token,Object.fromEntries(request.nextUrl.searchParams));
   else if(request.method==='GET'&&resource==='targets')data=await approvals.targets(token,Object.fromEntries(request.nextUrl.searchParams));
   else if(request.method==='POST'){
    assertSameOrigin(request,origin);const input=await readBody(request);
    if(resource==='decision'&&id)data=await approvals.decide(token,id,input);
    else if(resource==='requests'&&!id)data=await approvals.submit(token,input);
    else throw new AuthError('METHOD_NOT_ALLOWED',405,'Metode tidak diizinkan.');
   }else throw new AuthError('METHOD_NOT_ALLOWED',405,'Metode tidak diizinkan.');
   return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
   const known=error instanceof AuthError,invalid=error instanceof z.ZodError,duplicate=typeof error==='object'&&error!==null&&'code' in error&&error.code==='23505';
   return NextResponse.json({error:{code:known?error.code:invalid?'INVALID_INPUT':duplicate?'APPROVAL_CONFLICT':'UNAVAILABLE',message:known?error.message:invalid?'Periksa alasan, waktu koreksi, dan konfirmasi Anda.':duplicate?'Catatan atau permintaan bersamaan sudah tersimpan. Muat ulang untuk memeriksa hasil.':'Layanan persetujuan belum tersedia. Periksa hasil sebelum mencoba ulang.',requestId:randomUUID()}},{status:known?error.status:invalid?400:duplicate?409:503,headers:{'Cache-Control':'no-store'}});
  }
 };
}
