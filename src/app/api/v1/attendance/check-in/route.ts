import { NextRequest } from "next/server";
import { handleAttendance } from "@/server/attendance/handler";
export const runtime="nodejs";
export const POST=(request:NextRequest)=>handleAttendance(request,"check_in");
