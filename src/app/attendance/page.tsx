import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authRuntime } from '@/server/auth/runtime';
import { cookieName } from '@/server/auth/http';
import { AuthError } from '@/server/auth/types';
import { AttendancePanel } from '@/components/attendance-panel';
export const dynamic='force-dynamic';
export default async function AttendancePage(){
 const token=(await cookies()).get(cookieName)?.value;
 if(!token)redirect('/login');
 try{await authRuntime().service.me(token)}catch(error){
  if(error instanceof AuthError)redirect(error.code==='PIN_CHANGE_REQUIRED'?'/account':'/login');
  return <main className="auth-page"><section className="panel"><h1>Absensi belum tersedia</h1><p>Koneksi database perlu diperiksa. Silakan coba lagi.</p></section></main>;
 }
 return <AttendancePanel/>;
}
