import { NextRequest } from "next/server";
import { handleAttendance } from "@/server/attendance/handler";
export const runtime="nodejs";
export const GET=async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>handleAttendance(request,"photo",(await params).id);
