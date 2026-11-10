import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { authRuntime } from '@/server/auth/runtime';
import { cookieName } from '@/server/auth/http';
import { AuthError } from '@/server/auth/types';
import { readBoundedBytes } from '@/server/security/body';
import { storageRuntime } from '@/server/storage/runtime';
import { validatePhoto } from '@/server/attendance/photo';
export const runtime='nodejs';
async function handle(request:NextRequest,context:{params:Promise<{id:string}>}) {
 try {
  const {id}=await context.params;z.uuid().parse(id);
  const {service,origin}=authRuntime();
  if(request.method==='POST'&&request.headers.get('origin')!==origin)throw new AuthError('INVALID_ORIGIN',403,'Permintaan tidak diizinkan.');
  return await service.withOwner(request.cookies.get(cookieName)?.value??'',async(c,actor)=>{
   const found=await c.query("select id from attendance.employees where id=$1 and business_id=$2 and role='employee'",[id,actor.businessId]);
   if(!found.rows.length)throw new AuthError('NOT_FOUND',404,'Karyawan tidak ditemukan.');
   const storage=storageRuntime(),path=`${actor.businessId}/${id}/${id}.jpg`;
   if(request.method==='POST'){
    const bytes=await readBoundedBytes(request,512*1024);
    const photo=await validatePhoto(bytes,request.headers.get('content-type')??'');
    await storage.uploadPrivate(path,photo);
    await c.query("insert into attendance.audit_logs(actor_id,action,entity_type,entity_id,metadata_redacted) values($1,'employee.photo','employee',$2,'{}')",[actor.id,id]);
    return NextResponse.json({data:{saved:true}},{headers:{'Cache-Control':'no-store'}});
   }
   const url=await storage.getSignedReadUrl(path,60);
   return NextResponse.redirect(url,{headers:{'Cache-Control':'private, no-store'}});
  });
 }catch(error){return NextResponse.json({error:{message:error instanceof AuthError?error.message:'Foto belum tersedia.'}},{status:error instanceof AuthError?error.status:400,headers:{'Cache-Control':'no-store'}})}
}
export const GET=handle;
export const POST=handle;
