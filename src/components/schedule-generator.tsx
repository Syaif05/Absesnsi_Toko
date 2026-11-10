'use client';
import { useRef, useState } from 'react';
import { Modal } from './ui';
import { dayAfter } from '@/lib/schedule-dates';
import type { SchedulePerson, ShiftTemplate } from '@/server/schedules/models';
import type { Store } from '@/server/owner/models';
const weekdays=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
export function ScheduleGenerator({people,stores,templates,date,timezone,onClose,onSaved}:{people:SchedulePerson[];stores:Store[];templates:ShiftTemplate[];date:string;timezone:string;onClose:()=>void;onSaved:(count:number,published:boolean)=>void}) {
 const [selected,setSelected]=useState<string[]>([]),[store,setStore]=useState(''),[template,setTemplate]=useState(''),[from,setFrom]=useState(date),[to,setTo]=useState(dayAfter(date,6)),[days,setDays]=useState([1,2,3,4,5]),[start,setStart]=useState('08:00'),[end,setEnd]=useState('16:00'),[cross,setCross]=useState(false),[preview,setPreview]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
 const [publish,setPublish]=useState(false);
 const sending=useRef(false);
 const span=(Date.parse(to)-Date.parse(from))/86400000+1;
 const dates=Number.isInteger(span)&&span>0&&span<=31?Array.from({length:span},(_,i)=>dayAfter(from,i)).filter(day=>days.includes(new Date(day+'T12:00Z').getUTCDay())):[];
 const count=dates.length*selected.length;
 function validate(){
  if(!store||!selected.length) return 'Pilih toko dan setidaknya satu karyawan.';
  if(!dates.length) return 'Pilih rentang maksimal 31 hari dan hari kerja yang sesuai.';
  if(count>100) return 'Maksimal 100 jadwal sekali pembuatan. Kurangi karyawan atau rentang tanggal.';
  if(!start||!end||(!cross&&end<=start)||(cross&&end>start)) return 'Periksa jam shift dan pilihan pulang hari berikutnya (maksimal 24 jam).';
  return '';
 }
 async function save(){
  if(sending.current)return;const invalid=validate();if(invalid){setError(invalid);return;}
  sending.current=true;setBusy(true);setError('');
  try {
   const items=selected.flatMap(employeeId=>dates.map(date=>({employeeId,storeId:store,templateId:template||null,date,startTime:start,endTime:end,crossesMidnight:cross})));
   const response=await fetch('/api/v1/schedules/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,publish,confirmed:true})});
   const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Jadwal belum dapat disimpan.');
   onSaved(result.data.count,publish);
  }catch(err){setError(err instanceof TypeError ? 'Koneksi terputus. Periksa daftar jadwal sebelum mencoba kembali; hasil penyimpanan belum dapat dipastikan.' : err instanceof Error ? err.message : 'Jadwal belum dapat disimpan.');}finally{sending.current=false;setBusy(false);}
 }
 return <Modal title="Buat jadwal otomatis" onClose={()=>{if(!busy)onClose()}}><form className="owner-generator" onSubmit={e=>{e.preventDefault();const invalid=validate();setError(invalid);if(!invalid)setPreview(true)}}>
 {error?<p role="alert" className="auth-error">{error}</p>:null}
 {preview?<section className="owner-generator-preview"><h3>Periksa {count} jadwal</h3><p>{stores.find(s=>s.id===store)?.name} · {start}–{end}{cross?' (+1 hari)':''} · {timezone}</p><p>{selected.length} karyawan × {dates.length} hari kerja</p><ul>{selected.map(id=><li key={id}>{people.find(p=>p.id===id)?.full_name}</li>)}</ul><p>Tanggal: {dates.map(d=>d.slice(8)+'/'+d.slice(5,7)).join(', ')}</p><p>{publish ? "Langsung diterbitkan dan terlihat oleh karyawan." : "Disimpan sebagai draft untuk diperiksa terlebih dahulu."} Jadwal yang bertabrakan dengan draft atau jadwal terbit akan membatalkan seluruh pembuatan.</p><button className="primary" type="button" disabled={busy} onClick={()=>void save()}>{busy?'Menyimpan…':`${publish ? "Buat & terbitkan" : "Buat draft"} ${count} jadwal`}</button><button type="button" disabled={busy} onClick={()=>setPreview(false)}>Ubah pilihan</button></section>:<>
 <label>Toko penugasan<select required value={store} onChange={e=>setStore(e.target.value)}><option value="">Pilih toko</option>{stores.filter(s=>s.is_active).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
 <fieldset><legend>Karyawan ({selected.length} dipilih)</legend><label>Cari karyawan<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama karyawan"/></label><div className="owner-generator-people">{people.filter(p=>p.full_name.toLowerCase().includes(search.toLowerCase())).map(p=><label className="owner-check" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.full_name}</label>)}{!people.length?<p>Tambahkan karyawan aktif terlebih dahulu.</p>:null}</div></fieldset>
 <div className="coordinate-fields"><label>Dari tanggal<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Sampai tanggal<input type="date" required min={from} value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 <fieldset><legend>Ulangi pada hari</legend><div className="owner-generator-days">{[1,2,3,4,5,6,0].map(day=><label className="owner-check" key={day}><input type="checkbox" checked={days.includes(day)} onChange={e=>setDays(old=>e.target.checked?[...old,day]:old.filter(d=>d!==day))}/>{weekdays[day]}</label>)}</div></fieldset>
 <label>Template shift<select value={template} onChange={e=>{setTemplate(e.target.value);const t=templates.find(t=>t.id===e.target.value);if(t){setStart(t.start_local_time);setEnd(t.end_local_time);setCross(t.crosses_midnight)}}}><option value="">Jam khusus</option>{templates.filter(t=>t.is_active).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
 <div className="coordinate-fields"><label>Jam masuk<input type="time" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>Jam pulang<input type="time" required value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
 <label className="owner-check"><input type="checkbox" checked={cross} onChange={e=>setCross(e.target.checked)}/>Pulang pada hari berikutnya</label>
 <label className="owner-check"><input type="checkbox" checked={publish} onChange={e=>setPublish(e.target.checked)}/>Langsung terbitkan setelah konfirmasi</label>
 <p className="hint">{count} jadwal · Zona waktu {timezone}. Tanggal yang tidak dipilih menjadi hari tanpa penugasan dari generator ini.</p><button className="primary" type="submit">Pratinjau jadwal</button>
 </>}
 </form></Modal>;
}
