'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';
import type { Identity } from '@/server/auth/types';

async function send(path:string,data:unknown){
 let response:Response;
 try{response=await fetch('/api/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)})}
 catch{throw new Error('Koneksi belum berhasil. Periksa internet dan coba lagi.')}
 let result;
 try{result=await response.json()}catch{throw new Error('Server belum dapat merespons. Coba lagi sebentar.')}
 if(!response.ok)throw new Error(result.error?.message??'Permintaan gagal. Coba lagi.');
 return result.data;
}

function CredentialField({label,name,pin=false,newCredential=false,disabled=false}:{label:string;name:string;pin?:boolean;newCredential?:boolean;disabled?:boolean}){
 const id=useId(),[visible,setVisible]=useState(false),kind=pin?'PIN':'password';
 return <div className="credential-field"><label htmlFor={id}>{label}</label><span className="credential-input"><input id={id} required name={name} type={visible?'text':'password'} inputMode={pin?'numeric':'text'} maxLength={pin?12:128} minLength={newCredential?(pin?6:12):undefined} pattern={pin?'[0-9]{6,12}':undefined} title={pin?'Gunakan 6–12 digit angka':undefined} autoComplete={newCredential?'new-password':'current-password'} disabled={disabled} spellCheck={false} autoCapitalize="none"/><button type="button" className="credential-toggle" aria-label={(visible?'Sembunyikan ':'Tampilkan ')+kind} aria-pressed={visible} aria-controls={id} onClick={()=>setVisible(v=>!v)} disabled={disabled}><Icon name={visible?'eye-off':'eye'}/></button></span></div>;
}

function LoginFeedback({success,message,onContinue}:{success:boolean;message:string;onContinue:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId(),descriptionId=useId();
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close()},[]);
 return <dialog ref={ref} className={'login-feedback '+(success?'is-success':'is-error')} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e=>{e.preventDefault();onContinue()}} onClick={e=>{if(e.target===e.currentTarget)onContinue()}}>
  <span className="login-feedback-symbol" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d={success?'M13 24l8 8 15-17':'M16 16l16 16 M32 16L16 32'} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
  <h2 id={titleId}>{success?'Berhasil masuk!':'Belum berhasil masuk'}</h2><p id={descriptionId}>{message}</p>
  <button className="login-submit" onClick={onContinue}>{success?'Lanjutkan':'Coba lagi'}{success?<Icon name="arrow"/>:null}</button>
 </dialog>;
}

export function LoginPanel({showDemo=false}:{showDemo?:boolean}={}){
 const router=useRouter(),inFlight=useRef(false);
 const [role,setRole]=useState<'employee'|'owner'>('employee'),[phase,setPhase]=useState<'idle'|'loading'|'success'|'error'>('idle'),[error,setError]=useState('');
 const busy=phase==='loading'||phase==='success';
 function continueLogin(){router.replace(role==='owner'?'/owner/dashboard':'/attendance');router.refresh()}
 return <section className="login-screen" aria-labelledby="login-title">
  <header className="login-heading"><span className="login-brand">PRINCES <span>ATTENDANCE</span></span><h1 id="login-title">Selamat datang.</h1><p>Masuk untuk memulai hari Anda.</p></header>
  <div className="login-role" role="group" aria-label="Jenis akun">{(['employee','owner'] as const).map(value=><button key={value} type="button" aria-pressed={role===value} disabled={busy} onClick={()=>{setRole(value);setPhase('idle');setError('')}}>{value==='employee'?'Karyawan':'Owner'}</button>)}</div>
  <form className="login-form" aria-busy={busy} onSubmit={async e=>{
   e.preventDefault();if(inFlight.current)return;inFlight.current=true;setError('');setPhase('loading');
   const form=e.currentTarget,data=new FormData(form);
   try{await send('auth/'+role+'/login',{code:data.get('code'),credential:data.get('credential')});form.reset();setPhase('success')}
   catch(err){setError(err instanceof Error?err.message:'Login gagal. Coba lagi.');setPhase('error')}
   finally{inFlight.current=false}
  }}>
   <label htmlFor="login-code">ID {role==='owner'?'owner':'karyawan'}<input id="login-code" key={role+'-code'} required name="code" placeholder={role==='owner'?'Masukkan ID owner':'Masukkan ID karyawan'} maxLength={64} autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy}/></label>
   <CredentialField key={role} label={role==='owner'?'Password':'PIN'} name="credential" pin={role==='employee'} disabled={busy}/>
   <p className="login-help">{role==='employee'?'Lupa PIN? Hubungi pemilik toko.':'Gunakan akun owner yang sudah terdaftar.'}</p>
   <button className="login-submit" disabled={busy}>{phase==='loading'?<><span className="login-spinner" aria-hidden="true"/>Sedang masuk…</>:<>Masuk<Icon name="arrow"/></>}</button>
   <span className="login-live" role="status">{phase==='loading'?'Sedang memeriksa akun Anda.':''}</span>
  </form>
  <footer className="login-footer">Absensi mudah, hari lebih teratur.{showDemo?<Link href="/demo">Buka prototipe demo</Link>:null}</footer>
  {phase==='success'||phase==='error'?<LoginFeedback success={phase==='success'} message={phase==='success'?'Akun Anda siap. Mari lanjut ke halaman utama.':error} onContinue={phase==='success'?continueLogin:()=>setPhase('idle')}/>:null}
 </section>;
}

export function AccountPanel({identity}:{identity:Identity}){
 const router=useRouter(),isEmployee=identity.role==='employee';
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function logout(){setBusy(true);try{await send('auth/logout',{});router.replace('/login');router.refresh()}catch(err){setError(err instanceof Error?err.message:'Gagal keluar.');setBusy(false)}}
 return <section className="panel login-card account-card"><span className="eyebrow">AKUN {isEmployee?'KARYAWAN':'OWNER'}</span><h1>{identity.fullName}</h1><p>Kelola akun Anda di sini.</p>
  <nav className="account-shortcuts" aria-label="Halaman utama">{isEmployee?<><Link href="/attendance" className="primary owner-entry">Buka absensi saya</Link><Link href="/my-schedule" className="text-button">Lihat jadwal saya</Link></>:<><Link href="/owner/dashboard" className="primary owner-entry">Buka dashboard owner</Link><Link href="/owner" className="text-button">Kelola usaha</Link></>}</nav>
  <details className="account-security"><summary>Ganti {isEmployee?'PIN':'password'}<span>Opsional</span></summary><p className="hint">Ubah kapan saja jika Anda menginginkannya.</p>
   <form onSubmit={async e=>{
    e.preventDefault();if(busy||message)return;setBusy(true);setError('');const form=e.currentTarget,data=new FormData(form),current=data.get('current'),next=data.get('next');
    if(next!==data.get('confirmation')){setError('Konfirmasi '+(isEmployee?'PIN':'password')+' tidak cocok.');setBusy(false);return}
    try{await send(isEmployee?'auth/change-pin':'auth/change-password',isEmployee?{currentPin:current,newPin:next}:{currentPassword:current,newPassword:next});setMessage((isEmployee?'PIN':'Password')+' berhasil diubah. Silakan masuk kembali.');form.reset()}
    catch(err){setError(err instanceof Error?err.message:'Perubahan belum disimpan.')}finally{setBusy(false)}
   }}>
    <CredentialField label={isEmployee?'PIN saat ini':'Password saat ini'} name="current" pin={isEmployee} disabled={busy||!!message}/>
    <CredentialField label={isEmployee?'PIN baru (6–12 digit)':'Password baru (minimal 12 karakter)'} name="next" pin={isEmployee} newCredential disabled={busy||!!message}/>
    <CredentialField label={isEmployee?'Ulangi PIN baru':'Ulangi password baru'} name="confirmation" pin={isEmployee} newCredential disabled={busy||!!message}/>
    <button className="primary" disabled={busy||!!message}>{busy?'Menyimpan…':'Simpan perubahan'}</button>
   </form>
  </details>
  {error?<p className="auth-error" role="alert">{error}</p>:null}{message?<p className="auth-notice" role="status">{message} <Link href="/login">Masuk kembali</Link></p>:null}<button onClick={logout} disabled={busy} className="logout-button">Keluar</button>
 </section>;
}
