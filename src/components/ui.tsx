import { useEffect, useRef, useId } from 'react';
export function Icon({name='grid'}:{name?:string}) {
 const paths:Record<string,string>={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',store:'M3 10v11h18V10 M2 10l3-7h14l3 7 M2 10q3 4 5 0q3 4 5 0q3 4 5 0q3 4 5 0 M9 21v-7h6v7',calendar:'M4 5h16v16H4z M8 2v6 M16 2v6 M4 11h16',check:'M5 12l4 4L20 5',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',arrow:'M4 12h16 M14 6l6 6-6 6',plus:'M12 4v16 M4 12h16',logout:'M9 3H3v18h6 M10 12h12 M17 7l5 5-5 5',camera:'M3 7h5l2-3h4l2 3h5v14H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',bell:'M5 17h14l-2-4V8a5 5 0 0 0-10 0v5z M10 21h4',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',menu:'M4 6h16 M4 12h16 M4 18h16'};
 return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.grid}/></svg>;
}
export function Badge({children}:{children:React.ReactNode}){return <span className={'badge '+(String(children).includes('Menunggu')?'warning':'')}>{children}</span>}
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const titleId=useId();
 useEffect(()=>{ref.current?.showModal()},[]);
 return <dialog ref={ref} aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="dialog-head"><h2 id={titleId}>{title}</h2><button aria-label="Tutup dialog" onClick={onClose}>×</button></div>{children}</dialog>;
}
