import { NextRequest } from "next/server";
import { handleReporting } from "@/server/reporting/handler";
export const runtime="nodejs";
export const GET=(request:NextRequest)=>handleReporting(request,"activity");
