import { NextRequest } from "next/server";
import { handleApprovals } from "@/server/approvals/handler";
export const runtime="nodejs";
export const GET=async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>handleApprovals(request,"requests",(await params).id);
