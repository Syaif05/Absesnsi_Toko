import { NextRequest } from "next/server";
import { handleSchedules } from "@/server/schedules/handler";
export const runtime = "nodejs";
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handleSchedules(request, "templates", (await context.params).id);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handleSchedules(request, "templates", (await context.params).id);
}
