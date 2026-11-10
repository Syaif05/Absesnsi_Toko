import sharp from 'sharp';
import { AuthError } from '../auth/types';
export const MAX_PHOTO_BYTES = 512 * 1024;
export async function validatePhoto(bytes:Uint8Array, mime:string) {
  if(mime!=='image/jpeg'||bytes.length<4||bytes.length>MAX_PHOTO_BYTES||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)
    throw new AuthError('INVALID_PHOTO',400,'Gunakan selfie JPEG maksimal 512 KB. Ambil foto ulang.');
  try {
    const image=sharp(bytes,{limitInputPixels:4096*4096,failOn:'warning'}), meta=await image.metadata();
    if(meta.format!=='jpeg'||!meta.width||!meta.height||Math.min(meta.width,meta.height)<160)throw new Error('Invalid dimensions');
    // Re-encoding removes EXIF (including embedded location) and trailing payloads.
    const clean=await image.rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
    if(clean.length>MAX_PHOTO_BYTES)throw new Error('Too large');
    return clean;
  }catch { throw new AuthError('INVALID_PHOTO',400,'Foto tidak dapat dibaca. Ambil selfie ulang.'); }
}
