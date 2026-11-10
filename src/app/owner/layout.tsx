import { Suspense, type ReactNode } from 'react';
import { OwnerShell } from '@/components/owner-shell';
import '@/styles/owner.css';
export default function OwnerLayout({children}:{children:ReactNode}) {
 return <Suspense fallback={<p role="status">Memuat ruang owner…</p>}><OwnerShell>{children}</OwnerShell></Suspense>;
}
