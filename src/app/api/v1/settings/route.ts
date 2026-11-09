import { NextRequest } from 'next/server';
import { handleOwner } from '@/server/owner/handler';
export const runtime='nodejs';
export const GET=(request:NextRequest)=>handleOwner(request,'settings');
export const PATCH=(request:NextRequest)=>handleOwner(request,'settings');
