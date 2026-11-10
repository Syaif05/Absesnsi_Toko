import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authRuntime } from "@/server/auth/runtime";
import { cookieName } from "@/server/auth/http";
import { AuthError, requireOwner } from "@/server/auth/types";
import { OwnerPanel } from "@/components/owner-panel";
export const dynamic = "force-dynamic";
export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const query = await searchParams;
  const tab =
    query.tab === "employees"
      ? "employees"
      : query.tab === "settings"
        ? "settings"
        : "stores";
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) redirect("/login");
  let actor;
  try {
    actor = await authRuntime().service.me(token);
    requireOwner(actor);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    const denied = error instanceof AuthError && error.status === 403;
    return (
      <main className="auth-page">
        <section className="panel login-card">
          <h1>{denied ? "Akses tidak diizinkan" : "Layanan belum tersedia"}</h1>
          <p>
            {denied
              ? "Halaman ini hanya untuk owner dengan akun aktif."
              : "Konfigurasi database perlu disiapkan."}
          </p>
          <Link href="/account">Kembali ke akun</Link>
        </section>
      </main>
    );
  }
  return <OwnerPanel key={tab} fullName={actor.fullName} initialTab={tab} />;
}
