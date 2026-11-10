import { reportFailure } from '../security/observability';
import { NextRequest,NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthError } from '../auth/types';
import { cookieName } from '../auth/http';
import type { ReportingService } from './service';
export function createReportingHandler(getRuntime:()=>{reporting:ReportingService}){
 return async(request:NextRequest,resource:'summary'|'stores'|'activity'|'history'|'employee'|'detail',id?:string)=>{
  try{
   if(request.method!=='GET')throw new AuthError('METHOD_NOT_ALLOWED',405,'Laporan hanya dapat dibaca.');
   let runtime:ReturnType<typeof getRuntime>;
   try{runtime=getRuntime()}catch{throw new AuthError('UNAVAILABLE',503,'Konfigurasi monitoring belum tersedia.')}
   const token=request.cookies.get(cookieName)?.value??'',input=Object.fromEntries(request.nextUrl.searchParams),service=runtime.reporting;
   const data=resource==='summary'?await service.summary(token,input):resource==='stores'?await service.stores(token,input):resource==='activity'?await service.activity(token,input):resource==='history'?await service.history(token,input):resource==='employee'&&id?await service.employee(token,id,input):resource==='detail'&&id?await service.detail(token,id,input):null;
   if(data===null)throw new AuthError('NOT_FOUND',404,'Laporan tidak ditemukan.');
   return NextResponse.json({data},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }catch(error){
      const requestId=randomUUID();if(!(error instanceof AuthError)&&!(error instanceof z.ZodError))reportFailure(error,requestId,"reporting");
   const known=error instanceof AuthError,invalid=error instanceof z.ZodError;
   return NextResponse.json({error:{code:known?error.code:invalid?'INVALID_INPUT':'UNAVAILABLE',message:known?error.message:invalid?'Periksa rentang tanggal dan filter laporan.':'Monitoring belum dapat dimuat. Coba lagi nanti.',requestId}},{status:known?error.status:invalid?400:503,headers:{'Cache-Control':'no-store'}});
  }
 };
}
