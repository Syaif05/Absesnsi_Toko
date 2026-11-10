import { AuthError } from '../auth/types';
export async function readBoundedBytes(request:Pick<Request,'body'|'headers'>,limit:number,timeoutMs=30000){
 if(Number(request.headers.get('content-length'))>limit)throw new AuthError('PAYLOAD_TOO_LARGE',413,'Data terlalu besar.');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AuthError('REQUEST_TIMEOUT',408,'Pengiriman terlalu lama. Periksa koneksi lalu coba lagi.')),timeoutMs)});
 try{
  while(true){const next=await Promise.race([reader.read(),deadline]);if(next.done)break;size+=next.value.length;if(size>limit)throw new AuthError('PAYLOAD_TOO_LARGE',413,'Data terlalu besar.');chunks.push(next.value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
 }catch(error){await reader.cancel().catch(()=>{});throw error}
 finally{clearTimeout(timer);reader.releaseLock()}
}
