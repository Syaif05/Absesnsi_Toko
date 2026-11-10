'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Icon, Modal } from './ui';
const links = [
 {href:'/owner/dashboard',label:'Dashboard',icon:'grid',description:'Ringkasan kehadiran'},
 {href:'/owner?tab=employees',label:'Karyawan',icon:'people',description:'Profil, ID dan PIN'},
 {href:'/owner/schedules',label:'Jadwal',icon:'calendar',description:'Penugasan dan template shift'},
 {href:'/owner/reports',label:'Laporan',icon:'clock',description:'Riwayat dan detail absensi'},
 {href:'/owner/approvals',label:'Pengajuan',icon:'check',description:'Persetujuan dan koreksi'},
 {href:'/owner?tab=stores',label:'Toko',icon:'store',description:'Lokasi dan radius absensi'},
 {href:'/owner?tab=settings',label:'Pengaturan',icon:'settings',description:'Usaha dan aturan absensi'},
 {href:'/account',label:'Akun saya',icon:'people',description:'Password dan keluar'},
];
export function OwnerShell({children}:{children:ReactNode}) {
 const path=usePathname(),params=useSearchParams(),[menu,setMenu]=useState(false);
 const current=path==='/owner'?'/owner?tab='+(params.get('tab')??'stores'):path;
 const active=links.find(link=>link.href===current);
 const navLink=(link:typeof links[number])=><Link key={link.href} href={link.href} aria-current={current===link.href?'page':undefined} onClick={()=>setMenu(false)}><Icon name={link.icon}/><span>{link.label}</span></Link>;
 return <div className="owner-workspace">
  <aside className="owner-sidebar"><Link className="owner-brand" href="/owner/dashboard"><span className="owner-brand-icon"><Icon name="store"/></span><span>Ruang Owner<small>Absensi & operasional</small></span></Link><nav aria-label="Menu owner">{links.slice(0,5).map(navLink)}<span className="owner-nav-caption">PENGELOLAAN USAHA</span>{links.slice(5).map(navLink)}</nav></aside>
  <div className="owner-workspace-body"><header className="owner-topbar"><div><span className="owner-overline">RUANG OWNER</span><h1>{active?.label??'Kelola usaha'}</h1></div><button className="owner-menu-button" onClick={()=>setMenu(true)} aria-label="Buka semua menu"><Icon name="menu"/></button><Link className="owner-desktop-account" href="/account"><Icon name="people"/> Akun saya</Link></header><div className="owner-workspace-content">{children}</div></div>
  <nav className="owner-mobile-nav" aria-label="Navigasi utama owner">{links.slice(0,4).map(navLink)}<button onClick={()=>setMenu(true)} aria-expanded={menu}><Icon name="menu"/><span>Lainnya</span></button></nav>
  {menu?<Modal title="Menu owner" onClose={()=>setMenu(false)}><nav className="owner-menu-list" aria-label="Semua menu owner">{links.map(link=><Link key={link.href} href={link.href} onClick={()=>setMenu(false)} aria-current={current===link.href?'page':undefined}><Icon name={link.icon}/><span><strong>{link.label}</strong><small>{link.description}</small></span><Icon name="arrow"/></Link>)}</nav></Modal>:null}
 </div>;
}
