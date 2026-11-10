'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {EmployeeShell} from './employee-shell';
import {Icon} from './ui';
import type { AttendanceService } from '@/server/attendance/service';
import type { Submission } from '@/server/attendance/validation';
import { classifyLocation } from '@/server/attendance/validation';
type Context=Awaited<ReturnType<AttendanceService['context']>>;
type Result=Awaited<ReturnType<AttendanceService['submit']>>;
const formatTime=(value:string,timezone:string)=>new Date(value).toLocaleString('id-ID',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'})+' '+({"Asia/Jakarta":'WIB',"Asia/Makassar":'WITA',"Asia/Jayapura":'WIT'}[timezone]??timezone);
const statuses:Record<string,string>={inside:'Di dalam radius',outside:'Di luar radius',inaccurate:'Akurasi GPS kurang baik',denied:'Izin GPS ditolak',unavailable:'GPS tidak tersedia'};
class ApiError extends Error { constructor(message:string,public status:number){super(message)} }
async function api(path:string,init?:RequestInit){
 const response=await fetch('/api/v1/'+path,{...init,cache:'no-store'}),body=await response.json();
 if(!response.ok)throw new ApiError(body.error?.message??'Layanan belum tersedia.',response.status);
 return body.data;
}
export function AttendancePanel({view='attendance',fullName}:{view?:'attendance'|'history';fullName?:string}){
 const [context,setContext]=useState<Context|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[cameraError,setCameraError]=useState(''),[busy,setBusy]=useState(false),[capturing,setCapturing]=useState(false),[cameraReady,setCameraReady]=useState(false),[photo,setPhoto]=useState<Blob|null>(null),[preview,setPreview]=useState(''),[location,setLocation]=useState<Submission['location']|null>(null),[gpsBusy,setGpsBusy]=useState(false),[reason,setReason]=useState(''),[frozen,setFrozen]=useState(false),[result,setResult]=useState<Result|null>(null),[history,setHistory]=useState<Result[]>([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[photoUrl,setPhotoUrl]=useState('');
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0),sending=useRef(false),key=useRef(''),pending=useRef<{type:string;input:Submission;photo:Blob}|null>(null);
 const stopCamera=useCallback(()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCameraReady(false)},[]);
 const loadVersion=useRef(0);
 const load=useCallback(()=>{
  const version=++loadVersion.current;
  return Promise.all([api('me/attendance/context'),api('me/attendance?offset='+offset)])
   .then(([c,h])=>{if(version===loadVersion.current){setContext(c);setHistory(h.items);setHasMore(h.hasMore);setError('')}})
   .catch(err=>{if(version===loadVersion.current)setError(err instanceof Error?err.message:'Data absensi belum dapat dimuat.')})
   .finally(()=>{if(version===loadVersion.current)setLoading(false)});
 },[offset]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>()=>{generation.current++;stream.current?.getTracks().forEach(t=>t.stop())},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 useEffect(()=>{
  const hide=()=>{if(document.hidden){generation.current++;stopCamera();setCapturing(false)}};
  document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);
 },[stopCamera]);
 const time=(value:string)=>formatTime(value,context?.timezone??'Asia/Jakarta');
 const active=context?.open?{id:context.open.scheduleId as string,storeName:context.open.storeName as string,rules:context.open.rules}:context?.shifts[0];
 const type=context?.open?'check-out':'check-in';
 const classification=location&&active?classifyLocation(location,active.rules):null;
 const exception=classification&&classification.status!=='inside';
 function gps(){
  setGpsBusy(true);setLocation(null);const attempt=generation.current;
  if(!navigator.geolocation){setLocation({status:'unavailable'});setGpsBusy(false);return}
  navigator.geolocation.getCurrentPosition(position=>{if(generation.current!==attempt)return;setLocation({status:'available',lat:position.coords.latitude,lng:position.coords.longitude,accuracyM:position.coords.accuracy});setGpsBusy(false)},err=>{if(generation.current!==attempt)return;setLocation({status:err.code===1?'denied':'unavailable'});setGpsBusy(false)},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 async function start(){
  generation.current++;const attempt=generation.current;stopCamera();setError('');setCameraError('');setPhoto(null);setPreview('');setResult(null);setReason('');setFrozen(false);pending.current=null;key.current=crypto.randomUUID();setCapturing(true);gps();
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera memerlukan HTTPS atau localhost. Buka di Safari/Chrome dan izinkan kamera.');
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:1280}},audio:false});
   if(generation.current!==attempt){media.getTracks().forEach(t=>t.stop());return}
   stream.current=media;
   if(video.current){video.current.srcObject=media;await video.current.play();setCameraReady(true)}
  }catch(err){if(generation.current===attempt){stopCamera();setCameraError(err instanceof DOMException&&err.name==='NotAllowedError'?'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.':err instanceof Error?err.message:'Kamera tidak tersedia. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.')}}
 }
 async function capture(){
  const element=video.current;if(!element?.videoWidth||!cameraReady)return;
  setBusy(true);setError('');
  try{
   const canvas=document.createElement('canvas'),scale=Math.min(1,960/Math.max(element.videoWidth,element.videoHeight));canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);
   const drawing=canvas.getContext('2d');if(!drawing)throw new Error('Kamera belum siap.');drawing.drawImage(element,0,0,canvas.width,canvas.height);
   let blob:Blob|null=null;
   for(const quality of [0.85,0.75,0.65,0.55]){blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=250*1024)break}
   if(!blob||blob.size>512*1024)throw new Error('Foto terlalu besar. Coba ambil ulang.');
   setPhoto(blob);setPreview(URL.createObjectURL(blob));stopCamera();setCapturing(false);
  }catch(err){setError(err instanceof Error?err.message:'Foto belum dapat diambil.')}
  finally{setBusy(false)}
 }
 async function submit(){
  if(sending.current||!photo||!location||!active)return;
  sending.current=true;setBusy(true);setError('');setFrozen(true);
  if(!pending.current)pending.current={type,input:{idempotencyKey:key.current,scheduleId:String(active.id),location,reason},photo};
  const submission=pending.current!;
  try{
   const form=new FormData();form.set('metadata',JSON.stringify(submission.input));form.set('photo',submission.photo,'selfie.jpg');
   const saved=await api('attendance/'+submission.type,{method:'POST',body:form,signal:AbortSignal.timeout(45000)});
   setResult(saved);setPhoto(null);setPreview('');setCapturing(false);pending.current=null;setFrozen(false);await load();
  }catch(err){if(err instanceof ApiError&&err.status<500){pending.current=null;key.current=crypto.randomUUID();setFrozen(false);setError(err.message)}else setError((err instanceof Error?err.message:'Koneksi terputus.')+' Jika belum ada hasil, kirim ulang foto yang sama. Jangan menutup halaman.')}
  finally{sending.current=false;setBusy(false)}
 }
 return <EmployeeShell title={view==='history'?'Riwayat absensi':'Halo, '+(fullName?.split(' ')[0]??'selamat datang')+'.'} subtitle={view==='history'?'Catatan masuk dan pulang Anda.':'Siap memulai hari ini?'}><main className="employee-schedules attendance-page employee-attendance">
  {loading?<p role="status">Memuat data absensi…</p>:null}
  {error?<div role="alert" className="auth-error"><p>{error}</p>{!photo?<button onClick={()=>void load()} disabled={loading}>Muat ulang</button>:null}</div>:null}
  {result?<section className="panel" role="status"><h2>{result.reviewStatus==='pending'?'Tercatat — menunggu persetujuan':'Absensi berhasil dicatat'}</h2><p>{result.eventType==='check_in'?'Absen masuk':'Absen pulang'} · {time(result.recordedAt)}</p><p>{result.reviewStatus==='pending'?'Bukti sudah terkirim. Pengecualian lokasi masih perlu review owner.':'Lokasi memenuhi aturan jadwal.'}</p>{result.late&&result.eventType==='check_in'?<p>Tercatat terlambat berdasarkan jadwal dan toleransi.</p>:null}</section>:null}
  {view==='attendance'&&context&&!loading?<section className="panel attendance-capture"><div className="employee-section-heading"><h2>Absensi saya</h2><span className={'employee-status '+(context.open?'is-open':'')}>{context.open?'Sedang bekerja':active?'Siap absen':'Belum ada jadwal'}</span></div><div className="employee-attendance-steps"><span className={!context.open?'current':''}><Icon name="arrow"/>Masuk</span><span className={context.open?'current':''}><Icon name="logout"/>Pulang</span></div>
   {context.open?.missingCheckout?<p className="auth-error">Sesi sebelumnya belum memiliki absen pulang. Waktu tidak diisi otomatis; jika lupa, hubungi owner untuk peninjauan.</p>:null}
   {active?<><p><strong>{active.storeName as string}</strong> · radius {active.rules.radius_m} m</p>{context.open?<p>Masuk: {time(context.open.checkInAt)} · {context.open.status==='needs_review'?'Memerlukan review':'Sesi terbuka'}. Absen pulang tetap dapat dikirim.</p>:<p>Jadwal: {time(context.shifts[0].startsAt)} – {time(context.shifts[0].endsAt)}</p>}
    {!photo&&!capturing?<div className="employee-capture-action"><button className="employee-camera-action" onClick={()=>void start()} disabled={busy} aria-label={context.open?'Mulai absen pulang dengan selfie dan GPS':'Mulai absen masuk dengan selfie dan GPS'}><Icon name="camera"/><span>{context.open?'Absen pulang':'Absen masuk'}</span></button><p>Ketuk untuk selfie & lokasi</p></div>:null}
    {capturing?<><video ref={video} autoPlay muted playsInline className="selfie-camera" aria-label="Kamera selfie langsung"/>{cameraError?<p role="alert" className="auth-error">{cameraError}</p>:null}<button className="primary" onClick={()=>void capture()} disabled={!cameraReady||busy}>Ambil selfie</button><button onClick={()=>void start()} disabled={busy}>Coba kamera lagi</button></>:null}
    {preview?<><figure><Image unoptimized width={960} height={1280} src={preview} className="selfie-preview" alt="Pratinjau selfie sebelum dikirim"/><figcaption>Periksa wajah dan pencahayaan.</figcaption></figure>{!frozen?<button onClick={()=>void start()} disabled={busy}>Ambil ulang</button>:null}</>:null}
    {(capturing||photo)?<div className="gps-status" aria-live="polite"><p>{gpsBusy?'Mengambil lokasi…':classification?statuses[classification.status]:'Lokasi belum tersedia.'}</p>{location?.status==='available'?<p>Akurasi ±{Math.round(location.accuracyM)} m{classification?.distance!==null&&classification?.distance!==undefined?' · Jarak '+Math.round(classification.distance)+' m':''}</p>:null}<button onClick={gps} disabled={gpsBusy||busy||frozen}>Coba GPS lagi</button>{exception?<label>Alasan pengecualian (wajib)<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={5} maxLength={1000} disabled={frozen}/><span className="hint">Pengiriman ini menunggu persetujuan owner.</span></label>:null}</div>:null}
    {photo?<button className="primary" disabled={busy||gpsBusy||!location||!!exception&&reason.trim().length<5} onClick={()=>void submit()}>{busy?'Mengirim…':frozen?'Kirim ulang foto yang sama':exception?'Ajukan absensi':'Kirim '+(context.open?'absen pulang':'absen masuk')}</button>:null}
   </>:<div className="employee-empty"><span className="employee-empty-icon"><Icon name="calendar"/></span><h3>Waktunya belum tersedia</h3><p>Belum ada jadwal terbit yang sedang berlangsung. Periksa jadwal Anda atau hubungi owner untuk penugasan.</p><Link className="employee-link" href="/my-schedule">Lihat jadwal saya <Icon name="arrow"/></Link></div>}
  </section>:null}
  {view==='attendance'?<Link className="employee-quick-link" href="/my-schedule"><span className="employee-quick-icon"><Icon name="calendar"/></span><span><strong>Jadwal saya</strong><small>Lihat waktu dan lokasi kerja</small></span><Icon name="arrow"/></Link>:<Link className="employee-quick-link" href="/my-approvals"><span className="employee-quick-icon"><Icon name="check"/></span><span><strong>Koreksi & persetujuan</strong><small>Ajukan perbaikan dan lihat keputusannya</small></span><Icon name="arrow"/></Link>}
  <section className="panel employee-history"><div className="employee-section-heading"><h2>{view==='history'?'Catatan pengiriman':'Aktivitas terakhir'}</h2>{view==='attendance'?<Link className="employee-link" href="/my-history">Lihat semua</Link>:null}</div>{view==='history'?<p className="hint">Bukti asli tetap tersimpan. Hasil koreksi tersedia di menu Koreksi & persetujuan.</p>:null}{!history.length&&!loading&&!error?<p>Belum ada pengiriman.</p>:null}<ul className="attendance-history">{(view==='history'?history:history.slice(0,3)).map(item=><li key={item.id}><strong>{item.eventType==='check_in'?'Absen masuk':'Absen pulang'}</strong><span>{time(item.recordedAt)}</span><span>{statuses[String(item.locationStatus)]} · {item.reviewStatus==='pending'?'Menunggu persetujuan':item.reviewStatus==='approved'?'Disetujui':item.reviewStatus==='rejected'?'Ditolak':'Tanpa review'}</span><button onClick={async()=>{setPhotoUrl('');try{const data=await api('attendance/'+item.id+'/photo');setPhotoUrl(data.url)}catch(err){setError(err instanceof Error?err.message:'Foto belum tersedia.')}}}>Lihat bukti selfie</button></li>)}</ul>{photoUrl?<a href={photoUrl} target="_blank" rel="noreferrer">Buka foto privat (tautan berlaku 60 detik)</a>:null}{view==='history'?<div className="schedule-week-controls"><button disabled={loading||offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Sebelumnya</button><button disabled={loading||!hasMore} onClick={()=>setOffset(offset+20)}>Berikutnya</button></div>:null}</section>
 <p className="employee-privacy"><Icon name="settings"/>Selfie disimpan privat. Lokasi hanya diambil saat Anda memulai absensi.</p></main></EmployeeShell>;
}
