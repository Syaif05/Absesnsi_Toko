"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScheduledShift } from "@/server/schedules/models";
import type { Page } from "@/server/owner/models";
import { dayAfter, mondayOf, localParts } from "@/lib/schedule-dates";
export function MySchedule({ initialDate }: { initialDate: string }) {
  const [week, setWeek] = useState(mondayOf(initialDate)),
    [offset, setOffset] = useState(0),
    [rows, setRows] = useState<ScheduledShift[]>([]),
    [hasMore, setHasMore] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          "/api/v1/me/schedules?" +
            new URLSearchParams({
              from: week,
              to: dayAfter(week, 7),
              offset: String(offset),
            }),
          { cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.message ?? "Jadwal belum tersedia.");
        const data: Page<ScheduledShift> = result.data;
        if (!cancelled) {
          setRows(data.items);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Jadwal belum dapat dimuat.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [week, offset, retry]);
  return (
    <main className="employee-schedules">
      <header className="page-heading">
        <div>
          <span className="eyebrow">PRINCES ATTENDANCE</span>
          <h1>Jadwal saya</h1>
          <p>Hanya jadwal yang sudah diterbitkan owner.</p>
        </div>
        <Link href="/account">Kembali ke akun</Link>
      </header>
      <div className="schedule-week-controls">
        <button
          aria-label="Minggu sebelumnya"
          onClick={() => {
            setWeek(dayAfter(week, -7));
            setOffset(0);
          }}
        >
          ←
        </button>
        <label>
          Minggu mulai
          <input
            type="date"
            value={week}
            onChange={(e) => {
              if (e.target.value) {
                setWeek(mondayOf(e.target.value));
                setOffset(0);
              }
            }}
          />
        </label>
        <button
          aria-label="Minggu berikutnya"
          onClick={() => {
            setWeek(dayAfter(week, 7));
            setOffset(0);
          }}
        >
          →
        </button>
      </div>
      {error ? (
        <section className="panel auth-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((v) => v + 1)}>Coba lagi</button>
        </section>
      ) : loading ? (
        <section className="panel state-panel" role="status">
          Memuat jadwal…
        </section>
      ) : rows.length ? (
        <section className="panel">
          {rows.map((r) => {
            const timezone = String(r.rule_snapshot.timezone ?? "Asia/Jakarta"),
              start = localParts(r.starts_at, timezone),
              end = localParts(r.ends_at, timezone);
            return (
              <article className="owner-record" key={r.id}>
                <div>
                  <h2>{start.date}</h2>
                  <p>{r.store_name}</p>
                  <strong>
                    {start.time}–{end.time}
                    {start.date !== end.date ? " (+1 hari)" : ""}
                  </strong>
                  <p>{timezone}</p>
                </div>
                <span className="schedule-status published">Terbit</span>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel state-panel">
          <h2>Belum ada jadwal terbit</h2>
          <p>Hubungi owner untuk memastikan jadwal minggu ini.</p>
        </section>
      )}
      <div className="pagination">
        <button
          disabled={offset === 0 || loading}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Sebelumnya
        </button>
        <span>Halaman {Math.floor(offset / 50) + 1}</span>
        <button
          disabled={!hasMore || loading}
          onClick={() => setOffset(offset + 50)}
        >
          Berikutnya
        </button>
      </div>
    </main>
  );
}
