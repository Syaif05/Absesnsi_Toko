import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountPanel } from '@/components/auth-panel';
import { authRuntime } from '@/server/auth/runtime';
import { cookieName } from '@/server/auth/http';
import { AuthError } from '@/server/auth/types';
export const dynamic='force-dynamic';
export default async function AccountPage(){
 const token=(await cookies()).get(cookieName)?.value;
 if(!token)redirect('/login');
 let identity;
 try{identity=await authRuntime().service.me(token,true)}catch(error){
  if(error instanceof AuthError&&error.status===401)redirect('/login');
  return <main className="auth-page"><section className="panel login-card"><h1>Akun belum dapat dimuat</h1><p>Layanan belum tersedia. Coba lagi nanti.</p><Link href="/login">Kembali ke login</Link></section></main>;
 }
 return <main className="auth-page"><AccountPanel identity={identity}/></main>;
}
