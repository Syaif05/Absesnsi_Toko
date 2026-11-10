import { NextRequest } from "next/server";
import { handleApprovals } from "@/server/approvals/handler";
export const runtime="nodejs";
export const GET=(request:NextRequest)=>handleApprovals(request,"targets");
