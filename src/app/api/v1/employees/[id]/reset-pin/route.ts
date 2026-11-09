import { NextRequest } from 'next/server';
import { handleAuth } from '@/server/auth/handler';
export const runtime='nodejs';
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){
 return handleAuth(request,'reset-pin',(await context.params).id);
}
