import { NextRequest } from 'next/server';
import { handleAuth } from '@/server/auth/handler';
export const runtime='nodejs';
export const POST=(request:NextRequest)=>handleAuth(request,'owner-login');
