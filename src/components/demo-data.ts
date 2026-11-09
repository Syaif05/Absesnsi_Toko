export type RecordItem = { id: number; name: string; code: string; store: string; status: string; detail: string };
export const employees: RecordItem[] = [
  {id:1,name:'Nadia Putri',code:'PRS-001',store:'Princes Pusat',status:'Aktif',detail:'Pramuniaga'},
  {id:2,name:'Dimas Pratama',code:'PRS-002',store:'Princes Pusat',status:'Aktif',detail:'Kasir'},
  {id:3,name:'Rani Aulia',code:'PRS-003',store:'Princes Timur',status:'Aktif',detail:'Pramuniaga'},
  {id:4,name:'Fajar Ramadhan',code:'PRS-004',store:'Princes Timur',status:'Aktif',detail:'Kasir'},
];
export const stores: RecordItem[] = [
  {id:1,name:'Princes Pusat',code:'PST',store:'Princes Pusat',status:'Aktif',detail:'Jl. Melati No. 12 · radius 100 m'},
  {id:2,name:'Princes Timur',code:'TMR',store:'Princes Timur',status:'Aktif',detail:'Jl. Kenanga No. 8 · radius 100 m'},
];
export const schedules: RecordItem[] = [
  {id:1,name:'Nadia Putri',code:'09 Nov 2026',store:'Princes Pusat',status:'Terbit',detail:'Pagi · 08.00–16.00'},
  {id:2,name:'Dimas Pratama',code:'09 Nov 2026',store:'Princes Pusat',status:'Terbit',detail:'Siang · 12.00–20.00'},
  {id:3,name:'Rani Aulia',code:'10 Nov 2026',store:'Princes Timur',status:'Draft',detail:'Pagi · 08.00–16.00'},
];
