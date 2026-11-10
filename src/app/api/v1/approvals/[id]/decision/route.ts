import { NextRequest } from "next/server";
import { handleApprovals } from "@/server/approvals/handler";
export const runtime="nodejs";
export const POST=async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>handleApprovals(request,"decision",(await params).id);
