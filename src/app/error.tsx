'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 return <main className="auth-page"><section className="panel" role="alert"><h1>Halaman belum dapat dimuat</h1><p>Coba muat ulang. Jika sebelumnya sedang mengirim data, periksa riwayat sebelum mengulangi pengiriman.</p><button className="primary" onClick={reset}>Coba lagi</button><Link href="/account">Kembali ke akun</Link></section></main>;
}
