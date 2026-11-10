import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authRuntime } from '../auth/runtime';
import { cookieName } from '../auth/http';
import { AuthError } from '../auth/types';
import { ReportingService } from './service';
import { ReportingPanel } from '@/components/reporting-panel';
export async function reportingPage(view:'dashboard'|'reports'){
 const token=(await cookies()).get(cookieName)?.value;if(!token)redirect('/login');
 try{const initial=await new ReportingService(authRuntime().service).context(token);return <ReportingPanel view={view} initial={initial}/>}
 catch(error){
  if(error instanceof AuthError&&error.status===401)redirect('/login');
  if(error instanceof AuthError&&error.code==='PIN_CHANGE_REQUIRED')redirect('/account');
  return <main className="auth-page"><section className="panel"><h1>{error instanceof AuthError&&error.status===403?'Akses tidak diizinkan':'Monitoring belum tersedia'}</h1><p>{error instanceof AuthError&&error.status===403?'Halaman ini hanya untuk owner dengan akun aktif.':'Koneksi database perlu diperiksa. Tidak ada data contoh yang ditampilkan sebagai data usaha.'}</p><Link href="/account">Kembali ke akun</Link></section></main>;
 }
}
