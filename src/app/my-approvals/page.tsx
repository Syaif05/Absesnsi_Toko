import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authRuntime } from '@/server/auth/runtime';
import { cookieName } from '@/server/auth/http';
import { AuthError } from '@/server/auth/types';
import { ApprovalsPanel } from '@/components/approvals-panel';
export const dynamic='force-dynamic';
export default async function ApprovalsPage(){
 const token=(await cookies()).get(cookieName)?.value;if(!token)redirect('/login');
 try{const actor=await authRuntime().service.me(token);void actor;}catch(error){
  if(error instanceof AuthError&&error.status===401)redirect('/login');
  if(error instanceof AuthError&&error.code==='PIN_CHANGE_REQUIRED')redirect('/account');
  return <main className="auth-page"><section className="panel"><h1>{error instanceof AuthError&&error.status===403?'Akses tidak diizinkan':'Persetujuan belum tersedia'}</h1><p>Periksa akses akun atau koneksi database.</p><Link href="/account">Kembali ke akun</Link></section></main>;
 }
 return <ApprovalsPanel inbox={false}/>;
}
