import { NextRequest,NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthError } from '../auth/types';
import { cookieName } from '../auth/http';
import type { AttendanceService } from './service';
import { MAX_PHOTO_BYTES } from './photo';
export function createAttendanceHandler(getRuntime:()=>{attendance:AttendanceService;origin:string;authorize:(token:string)=>Promise<unknown>}) {
  return async(request:NextRequest,action:'context'|'mine'|'check_in'|'check_out'|'photo',id?:string)=>{
    try {
      let runtime:ReturnType<typeof getRuntime>;
      try{runtime=getRuntime()}catch{throw new AuthError('UNAVAILABLE',503,'Konfigurasi layanan absensi belum siap. Hubungi owner.')}
      const {attendance,origin,authorize}=runtime, token=request.cookies.get(cookieName)?.value??'';
      let data:unknown;
      if(request.method==='GET'&&action==='context')data=await attendance.context(token);
      else if(request.method==='GET'&&action==='mine')data=await attendance.own(token,Object.fromEntries(request.nextUrl.searchParams));
      else if(request.method==='GET'&&action==='photo'&&id)data=await attendance.photo(token,id);
      else if(request.method==='POST'&&(action==='check_in'||action==='check_out')) {
        if(request.headers.get('origin')!==origin)throw new AuthError('INVALID_ORIGIN',403,'Permintaan tidak diizinkan.');
        await authorize(token);
        if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new AuthError('INVALID_INPUT',400,'Kirim selfie dan metadata.');
        const limit=MAX_PHOTO_BYTES+16384;
        if(Number(request.headers.get('content-length'))>limit)throw new AuthError('PAYLOAD_TOO_LARGE',413,'Foto terlalu besar. Ambil ulang.');
        const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
        if(!reader)throw new AuthError('INVALID_INPUT',400,'Selfie belum tersedia.');
        while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>limit){await reader.cancel();throw new AuthError('PAYLOAD_TOO_LARGE',413,'Foto terlalu besar. Ambil ulang.')}chunks.push(next.value)}
        const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
        let form:FormData;
        try{form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData()}catch{throw new AuthError('INVALID_INPUT',400,'Data selfie tidak valid.')}
        const photo=form.get('photo'),meta=form.get('metadata');
        if([...form.keys()].length!==2||!(photo instanceof File)||typeof meta!=='string'||meta.length>4096)throw new AuthError('INVALID_INPUT',400,'Selfie dan informasi lokasi wajib tersedia.');
        let input:unknown;try{input=JSON.parse(meta)}catch{throw new AuthError('INVALID_INPUT',400,'Informasi lokasi tidak valid.')}
        data=await attendance.submit(token,action,input,new Uint8Array(await photo.arrayBuffer()),photo.type);
      }else throw new AuthError('METHOD_NOT_ALLOWED',405,'Metode tidak diizinkan.');
      return NextResponse.json({data},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }catch(error){
      const known=error instanceof AuthError,invalid=error instanceof z.ZodError;
      return NextResponse.json({error:{code:known?error.code:invalid?'INVALID_INPUT':'UNAVAILABLE',message:known?error.message:invalid?'Periksa data selfie dan lokasi.':'Layanan absensi belum tersedia. Pengiriman belum dikonfirmasi; coba lagi dengan foto yang sama.',requestId:randomUUID()}},{status:known?error.status:invalid?400:503,headers:{'Cache-Control':'no-store'}});
    }
  };
}
