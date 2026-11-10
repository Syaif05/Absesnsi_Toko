import { reportFailure } from '../security/observability';
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthError } from "../auth/types";
import { cookieName, assertSameOrigin, readBody } from "../auth/http";
import type { ScheduleService } from "./service";
export function createScheduleHandler(
  getRuntime: () => { schedules: ScheduleService; origin: string },
) {
  return async (
    request: NextRequest,
    resource: "schedules" | "templates" | "people" | "mine",
    id?: string,
  ) => {
    try {
      let runtime: ReturnType<typeof getRuntime>;
      try {
        runtime = getRuntime();
      } catch {
        throw new AuthError(
          "UNAVAILABLE",
          503,
          "Konfigurasi database belum siap.",
        );
      }
      const { schedules, origin } = runtime,
        token = request.cookies.get(cookieName)?.value ?? "";
      let data: unknown,
        status = 200;
      if (request.method === "GET") {
        const p = Object.fromEntries(request.nextUrl.searchParams);
        data =
          resource === "mine"
            ? await schedules.own(token, p)
            : resource === "schedules"
              ? id
                ? await schedules.get(token, id)
                : await schedules.list(token, p)
              : resource === "templates"
                ? id
                  ? await schedules.getTemplate(token, id)
                  : await schedules.templates(token, p.offset)
                : await schedules.people(token, p.offset);
      } else {
        assertSameOrigin(request, origin);
        const body = await readBody(request);
        if (resource === "templates" && request.method === "POST" && !id) {
          data = await schedules.saveTemplate(token, body);
          status = 201;
        } else if (resource === "templates" && request.method === "PATCH" && id)
          data = await schedules.saveTemplate(token, body, id);
        else if (resource === "schedules" && request.method === "POST" && !id) {
          data = await schedules.create(token, body);
          status = 201;
        } else if (resource === "schedules" && request.method === "PATCH" && id)
          data =
            typeof body === "object" && body !== null && "status" in body
              ? await schedules.decide(token, id, body)
              : await schedules.update(token, id, body);
        else
          throw new AuthError(
            "METHOD_NOT_ALLOWED",
            405,
            "Metode tidak diizinkan.",
          );
      }
      return NextResponse.json(
        { data },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const requestId=randomUUID();if(!(error instanceof AuthError)&&!(error instanceof z.ZodError))reportFailure(error,requestId,"schedules");
      const known = error instanceof AuthError,
        invalid = error instanceof z.ZodError,
        overlap =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23P01";
      return NextResponse.json(
        {
          error: {
            code: known
              ? error.code
              : invalid
                ? "INVALID_INPUT"
                : overlap
                  ? "SCHEDULE_OVERLAP"
                  : "UNAVAILABLE",
            message: known
              ? error.message
              : invalid
                ? "Periksa kembali isian jadwal."
                : overlap
                  ? "Jadwal karyawan bertabrakan dengan shift yang sudah terbit."
                  : "Layanan belum tersedia. Coba lagi nanti.",
            fields: invalid
              ? Object.fromEntries(
                  error.issues.map((i) => [
                    i.path.join("."),
                    "Periksa nilai atau format kolom ini.",
                  ]),
                )
              : undefined,
            requestId,
          },
        },
        {
          status: known ? error.status : invalid ? 400 : overlap ? 409 : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  };
}
