import { NextRequest } from "next/server";
import { handleAttendance } from "@/server/attendance/handler";
export const runtime="nodejs";
export const GET=(request:NextRequest)=>handleAttendance(request,"mine");
