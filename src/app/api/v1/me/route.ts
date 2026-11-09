import { NextRequest } from 'next/server';
import { handleAuth } from '@/server/auth/handler';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>handleAuth(request,'me');
