import { NextRequest } from 'next/server';
import { handleOwner } from '@/server/owner/handler';
export const runtime='nodejs';
async function run(request:NextRequest,context:{params:Promise<{id:string}>}){return handleOwner(request,'stores',(await context.params).id)}
export const GET=run;
export const PATCH=run;
