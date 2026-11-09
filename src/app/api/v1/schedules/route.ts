import { NextRequest } from 'next/server';
import { handleSchedules } from '@/server/schedules/handler';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>handleSchedules(request,'schedules');
export const POST=(request:NextRequest)=>handleSchedules(request,'schedules');
