import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authRuntime } from "@/server/auth/runtime";
import { cookieName } from "@/server/auth/http";
import { AuthError } from "@/server/auth/types";
import { ScheduleService } from "@/server/schedules/service";
import { MySchedule } from "@/components/my-schedule";
export const dynamic = "force-dynamic";
export default async function MySchedulePage() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) redirect("/login");
  let timezone = "Asia/Jakarta";
  try {
    timezone = await new ScheduleService(authRuntime().service).timezone(token);
  } catch (error) {
    if (error instanceof AuthError)
      redirect("/login");
    return (
      <main className="auth-page">
        <section className="panel">
          <h1>Jadwal belum dapat dimuat</h1>
          <p>Konfigurasi database perlu diperiksa.</p>
        </section>
      </main>
    );
  }
  return (
    <MySchedule
      initialDate={new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())}
    />
  );
}
