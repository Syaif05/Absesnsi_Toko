import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authRuntime } from "@/server/auth/runtime";
import { cookieName } from "@/server/auth/http";
import { AuthError, requireOwner } from "@/server/auth/types";
import { OwnerService } from "@/server/owner/service";
import { SchedulePanel } from "@/components/schedule-panel";
export const dynamic = "force-dynamic";
export default async function SchedulesPage() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) redirect("/login");
  let context:{fullName:string;timezone:string;initialDate:string};
  try {
    const { service } = authRuntime();
    const actor = await service.me(token);
    requireOwner(actor);
    const settings = await new OwnerService(service).settings(token);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: settings.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    context={fullName:actor.fullName,timezone:settings.timezone,initialDate:today};
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    return (
      <main className="auth-page">
        <section className="panel login-card">
          <h1>
            {error instanceof AuthError && error.status === 403
              ? "Akses tidak diizinkan"
              : "Jadwal belum dapat dimuat"}
          </h1>
          <p>Periksa akses akun dan koneksi, lalu coba kembali.</p>
          <Link href="/account">Kembali ke akun</Link>
        </section>
      </main>
    );
  }
  return <SchedulePanel {...context}/>;
}
