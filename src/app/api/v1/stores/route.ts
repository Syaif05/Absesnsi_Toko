import { NextRequest } from 'next/server';
import { handleOwner } from '@/server/owner/handler';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>handleOwner(request,'stores');
export const POST=(request:NextRequest)=>handleOwner(request,'stores');
