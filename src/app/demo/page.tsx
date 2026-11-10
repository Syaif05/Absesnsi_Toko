import { notFound } from 'next/navigation';
import { demoEnabled } from '@/server/release/demo';
export const dynamic='force-dynamic';
export default async function DemoPage(){
 if(!demoEnabled(process.env))notFound();
 const {default:AttendanceDemo}=await import('@/components/attendance-demo');return <AttendanceDemo/>;
}
