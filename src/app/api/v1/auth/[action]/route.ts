import { NextRequest } from 'next/server';
import { handleAuth } from '@/server/auth/handler';
export const runtime='nodejs';
export async function POST(request:NextRequest,context:{params:Promise<{action:string}>}){
 const {action}=await context.params;
 return handleAuth(request,action);
}
