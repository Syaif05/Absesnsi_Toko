import { NextRequest } from "next/server";
import { handleReporting } from "@/server/reporting/handler";
export const runtime="nodejs";
export const GET=async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>handleReporting(request,"employee",(await params).id);
