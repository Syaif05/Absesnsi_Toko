import { reportFailure } from '../security/observability';
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "../auth/types";
import { cookieName, assertSameOrigin, readBody } from "../auth/http";
import type { OwnerService } from "./service";
export function createOwnerHandler(
  getRuntime: () => { owner: OwnerService; origin: string },
) {
  return async (
    request: NextRequest,
    resource: "stores" | "employees" | "settings",
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
          "Layanan belum tersedia. Konfigurasi database perlu disiapkan.",
        );
      }
      const { owner, origin } = runtime;
      const token = request.cookies.get(cookieName)?.value ?? "";
      let data: unknown;
      let status = 200;
      if (request.method === "GET") {
        const p = Object.fromEntries(request.nextUrl.searchParams);
        data =
          resource === "settings"
            ? await owner.settings(token)
            : resource === "stores"
              ? id
                ? await owner.getStore(token, id)
                : await owner.listStores(token, p)
              : id
                ? await owner.getEmployee(token, id)
                : await owner.listEmployees(token, p);
      } else {
        if (!["POST", "PATCH"].includes(request.method))
          throw new AuthError(
            "METHOD_NOT_ALLOWED",
            405,
            "Metode tidak diizinkan.",
          );
        assertSameOrigin(request, origin);
        const body = await readBody(request);
        if (resource === "settings" && request.method === "PATCH")
          data = await owner.updateSettings(token, body);
        else if (resource === "stores" && request.method === "POST" && !id) {
          data = await owner.createStore(token, body);
          status = 201;
        } else if (resource === "stores" && request.method === "PATCH" && id)
          data = await owner.updateStore(token, id, body);
        else if (resource === "employees" && request.method === "POST" && !id) {
          data = await owner.createEmployee(token, body);
          status = 201;
        } else if (resource === "employees" && request.method === "PATCH" && id)
          data = await owner.updateEmployee(token, id, body);
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
      const requestId=randomUUID();if(!(error instanceof AuthError)&&!(error instanceof z.ZodError))reportFailure(error,requestId,"owner");
      const known = error instanceof AuthError,
        validation = error instanceof z.ZodError;
      const duplicate =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505";
      return NextResponse.json(
        {
          error: {
            code: known
              ? error.code
              : validation
                ? "INVALID_INPUT"
                : duplicate
                  ? "DUPLICATE_CODE"
                  : "UNAVAILABLE",
            message: known
              ? error.message
              : validation
                ? "Periksa kembali isian formulir."
                : duplicate
                  ? "ID atau kode sudah digunakan. Pilih yang lain."
                  : "Layanan belum tersedia. Coba lagi nanti.",
            fields: validation
              ? Object.fromEntries(
                  error.issues.map((i) => [
                    i.path.join("."),
                    "Periksa nilai atau format kolom ini.",
                  ]),
                )
              : duplicate
                ? { code: "ID atau kode ini sudah digunakan." }
                : undefined,
            requestId,
          },
        },
        {
          status: known
            ? error.status
            : validation
              ? 400
              : duplicate
                ? 409
                : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  };
}
