'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {Icon} from './ui';
const destinations=[{href:'/attendance',label:'Absensi',icon:'camera'},{href:'/my-schedule',label:'Jadwal',icon:'calendar'},{href:'/my-history',label:'Riwayat',icon:'clock'},{href:'/account',label:'Pengaturan',icon:'settings'}];
export function EmployeeShell({title,subtitle,children,enabled=true}:{title:string;subtitle?:string;children:ReactNode;enabled?:boolean}){
 const path=usePathname();
 if(!enabled)return <>{children}</>;
 return <div className="employee-app"><div className="employee-content"><header className="employee-header"><div><span className="employee-brand">PRINCES ATTENDANCE</span><h1>{title}</h1>{subtitle?<p>{subtitle}</p>:null}</div><Link href={path==='/account'?'/attendance':'/account'} className="employee-header-action" aria-label={path==='/account'?'Kembali ke absensi':'Buka pengaturan akun'}><Icon name={path==='/account'?'arrow':'settings'}/></Link></header>{children}</div><nav className="employee-bottom-nav" aria-label="Menu karyawan">{destinations.map(item=>{const selected=path===item.href||(item.href==='/my-history'&&path==='/my-approvals');return <Link key={item.href} href={item.href} aria-current={selected?'page':undefined}><Icon name={item.icon}/><span>{item.label}</span></Link>})}</nav></div>;
}
