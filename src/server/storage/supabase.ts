import { AuthError } from '../auth/types';
import type { StorageProvider } from './provider';
export class SupabaseStorage implements StorageProvider {
  private base: string;
  constructor(url: string, private key: string, private bucket: string, private send: typeof fetch = fetch) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !key || !/^[a-z0-9-]+$/.test(bucket)) throw new Error('Invalid storage configuration');
    this.base = parsed.origin + '/storage/v1';
  }
  private path(path: string) {
    if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.jpg$/.test(path)) throw new Error('Invalid photo path');
    return this.bucket + '/' + path;
  }
  private async request(path: string, method = 'GET', body?: BodyInit, contentType = 'application/json') {
    const response = await this.send(this.base + path, {method, body, headers: {apikey:this.key, Authorization:'Bearer '+this.key, 'Content-Type':contentType, 'x-upsert':'true'}, cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new AuthError('STORAGE_UNAVAILABLE',503,'Penyimpanan foto gagal. Absensi belum berhasil; coba kirim ulang.');
    return response;
  }
  async verifyPrivateBucket() {
    const data = await (await this.request('/bucket/'+this.bucket)).json();
    if (data.public !== false) throw new AuthError('STORAGE_UNSAFE',503,'Penyimpanan foto privat belum siap. Hubungi owner.');
  }
  async uploadPrivate(path: string, bytes: Uint8Array) {
    await this.verifyPrivateBucket();
    await this.request('/object/'+this.path(path),'POST',new Uint8Array(bytes),'image/jpeg');
  }
  async getSignedReadUrl(path: string, seconds: number) {
    await this.verifyPrivateBucket();
    const data = await (await this.request('/object/sign/'+this.path(path),'POST',JSON.stringify({expiresIn:seconds}))).json();
    const signed:unknown = data.signedURL;
    if(typeof signed!=='string'||!signed.startsWith('/object/sign/'))throw new AuthError('STORAGE_UNAVAILABLE',503,'Tautan foto belum tersedia. Coba lagi.');
    return this.base + signed;
  }
  async delete(path: string) {
    await this.request('/object/'+this.bucket,'DELETE',JSON.stringify({prefixes:[this.path(path).slice(this.bucket.length+1)]}));
  }
}
