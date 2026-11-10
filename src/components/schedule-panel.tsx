"use client";
import { useEffect, useMemo, useState } from "react";
import { ScheduleGenerator } from "./schedule-generator";
import { Icon, Modal } from "./ui";
import type {
  ShiftTemplate,
  ScheduledShift,
  SchedulePerson,
} from "@/server/schedules/models";
import type { Store, Page } from "@/server/owner/models";
import { dayAfter, mondayOf, localParts } from "@/lib/schedule-dates";
class ScheduleRequestError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
async function api<T>(
  route: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/v1/" + route, {
    method,
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ScheduleRequestError(
      result.error?.message ?? "Permintaan gagal.",
      result.error?.fields,
    );
  return result.data;
}
async function choices<T>(route: string) {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const result = await api<Page<T>>(route + "?offset=" + offset);
    all.push(...result.items);
    if (!result.hasMore) return all;
    offset = result.nextOffset;
  }
}
const statusLabel = {
  draft: "Draft",
  published: "Terbit",
  cancelled: "Dibatalkan",
};
const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" });
const noon = (date: string) => new Date(date + "T12:00Z");

function changeMonth(date: string, delta: number) {
  const first = noon(date.slice(0, 7) + "-01");
  first.setUTCMonth(first.getUTCMonth() + delta);
  return first.toISOString().slice(0, 10);
}

async function monthSchedules(params: URLSearchParams, isCancelled: () => boolean) {
  const rows: ScheduledShift[] = [];
  while (!isCancelled()) {
    const page = await api<Page<ScheduledShift>>("schedules?" + params);
    rows.push(...page.items);
    if (!page.hasMore) break;
    params.set("offset", String(page.nextOffset));
  }
  return rows;
}

export function SchedulePanel({
  timezone,
  initialDate,
}: {
  fullName: string;
  timezone: string;
  initialDate: string;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate),
    month = changeMonth(selectedDate, 0),
    nextMonth = changeMonth(month, 1),
    [tab, setTab] = useState<"month" | "templates">("month");
  const [storeId, setStoreId] = useState(""),
    [employeeId, setEmployeeId] = useState(""),
    [status, setStatus] = useState("");
  const [rows, setRows] = useState<ScheduledShift[]>([]),
    [templates, setTemplates] = useState<ShiftTemplate[]>([]),
    [people, setPeople] = useState<SchedulePerson[]>([]),
    [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{
    kind: "schedule" | "template";
    item?: ScheduledShift | ShiftTemplate;
    move?: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    item: ScheduledShift;
    status: "published" | "cancelled";
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          from: month,
          to: nextMonth,
        });
        if (storeId) params.set("storeId", storeId);
        if (employeeId) params.set("employeeId", employeeId);
        if (status) params.set("status", status);
        const [ts, ps, ss, data] = await Promise.all([
          choices<ShiftTemplate>("shift-templates"),
          choices<SchedulePerson>("schedule-people"),
          choices<Store>("stores"),
          monthSchedules(params, () => cancelled),
        ]);
        if (!cancelled) {
          setRows(data);
          setTemplates(ts);
          setPeople(ps);
          setStores(ss);
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
  }, [month, nextMonth, storeId, employeeId, status, revision]);
  const [generating, setGenerating] = useState(false);
  const byDate = useMemo(() => {
    const grouped = new Map<string, ScheduledShift[]>();
    for (const row of rows) {
      const start = localParts(row.starts_at, timezone).date;
      const end = localParts(row.ends_at, timezone);
      for (let day = start < month ? month : start; day < nextMonth && (day < end.date || (day === end.date && end.time !== "00:00")); day = dayAfter(day, 1)) {
        const group = grouped.get(day) ?? [];
        group.push(row);
        grouped.set(day, group);
      }
    }
    return grouped;
  }, [rows, month, nextMonth, timezone]);
  const dayRows = byDate.get(selectedDate) ?? [];
  const reload = () => setRevision((v) => v + 1);
  async function decide(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirmation) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await api("schedules/" + confirmation.item.id, "PATCH", {
        status: confirmation.status,
        version: confirmation.item.version,
        confirmed: true,
        confirmWithAttendance: data.get("confirmWithAttendance") === "on",
      });
      setConfirmation(null);
      setNotice("Status jadwal berhasil diperbarui.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jadwal belum diubah.");
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="owner-live">
      <nav className="owner-tabs" aria-label="Navigasi jadwal">
        <button
          className={tab === "month" ? "active" : ""}
          onClick={() => setTab("month")}
        >
          <Icon name="calendar" />
          Kalender bulanan
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          <Icon name="clock" />
          Template shift
        </button>
      </nav>
      <main className="owner-content">
        <div className="page-heading">
          <div>
            <h2>
              {tab === "month" ? "Jadwal kerja" : "Template shift"}
            </h2>
            <p>
              {tab === "month"
                ? "Pilih tanggal untuk melihat atau mengatur shift."
                : "Perubahan template berlaku pada penugasan berikutnya."}
            </p>
          </div>
          <button
            className="primary"
            disabled={loading || busy || !!error}
            onClick={() =>
              setEditor({ kind: tab === "month" ? "schedule" : "template" })
            }
          >
            <Icon name="plus" />
            Tambah {tab === "month" ? "jadwal" : "template"}
          </button>
        </div>
        {tab === "month" ? <button className="calendar-generate" disabled={loading || busy || !!error} onClick={()=>setGenerating(true)}><Icon name="calendar"/>Buat jadwal otomatis</button> : null}
        {notice ? (
          <p role="status" className="auth-notice">
            {notice}
          </p>
        ) : null}
        {tab === "month" ? (
          <>
            <div className="owner-filters">
              <label>
                Toko
                <select
                  value={storeId}
                  onChange={(e) => {
                    setStoreId(e.target.value);
                  }}
                >
                  <option value="">Semua toko</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Karyawan
                <select
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                  }}
                >
                  <option value="">Semua karyawan</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                  }}
                >
                  <option value="">Semua status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Terbit</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </label>
            </div>
          </>
        ) : null}
        {error ? (
          <section className="panel auth-error" role="alert">
            <h2>Jadwal belum dapat dimuat</h2>
            <p>{error}</p>
            <button onClick={reload}>Coba lagi</button>
          </section>
        ) : loading ? (
          <section className="panel state-panel" role="status" aria-busy="true">
            <h2>Memuat jadwal…</h2>
          </section>
        ) : tab === "templates" ? (
          <section className="panel">
            {templates.length ? (
              templates.map((t) => (
                <article className="owner-record" key={t.id}>
                  <div>
                    <h3>{t.name}</h3>
                    <p>
                      {t.start_local_time}–{t.end_local_time}
                      {t.crosses_midnight ? " (+1 hari)" : ""}
                    </p>
                    <small>
                      Toleransi {t.grace_minutes} menit ·{" "}
                      {t.is_active ? "Aktif" : "Nonaktif"}
                    </small>
                  </div>
                  <button
                    onClick={() => setEditor({ kind: "template", item: t })}
                  >
                    Edit template
                  </button>
                </article>
              ))
            ) : (
              <div className="state-panel">
                <h2>Belum ada template</h2>
                <p>
                  Tambahkan template pagi, siang atau malam sesuai kebutuhan
                  toko.
                </p>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="month-calendar" aria-label="Kalender jadwal">
              <div className="calendar-toolbar">
                <h2>{monthLabel.format(noon(month))}</h2>
                <div>
                  <button aria-label="Bulan sebelumnya" onClick={() => setSelectedDate(changeMonth(month, -1))}>←</button>
                  <button onClick={() => setSelectedDate(initialDate)}>Hari ini</button>
                  <button aria-label="Bulan berikutnya" onClick={() => setSelectedDate(nextMonth)}>→</button>
                </div>
              </div>
              <div className="calendar-grid">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
                {Array.from({ length: Math.round((+noon(nextMonth) - +noon(month)) / 86400000) }, (_, index) => {
                  const day = dayAfter(month, index);
                  const shifts = byDate.get(day) ?? [];
                  return (
                    <button key={day} className="calendar-day" aria-pressed={day === selectedDate}
                      aria-current={day === initialDate ? "date" : undefined}
                      aria-label={dayLabel.format(noon(day)) + ", " + shifts.length + " jadwal"}
                      style={index === 0 ? { gridColumnStart: Math.round((+noon(month) - +noon(mondayOf(month))) / 86400000) + 1 } : undefined}
                      onClick={() => setSelectedDate(day)}>
                      <span className="calendar-date-number">{index + 1}</span>
                      {shifts.length > 0 ? <span className="calendar-count">{shifts.length}<span> shift</span></span> : null}
                      {shifts.slice(0, 1).map(shift => <span key={shift.id} className={"calendar-preview " + shift.status}>{shift.employee_name}</span>)}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="calendar-detail panel">
              <div className="calendar-toolbar">
                <h2>{dayLabel.format(noon(selectedDate))}</h2>
                <button className="primary" disabled={busy} onClick={() => setEditor({ kind: "schedule" })}>Tambah shift</button>
              </div>
              {dayRows.length === 0 ? <p className="day-empty">Tidak ada shift yang sesuai filter.</p> : null}
              {dayRows.map(r => {
                const zone = String(r.rule_snapshot.timezone ?? timezone);
                const start = localParts(r.starts_at, zone);
                const end = localParts(r.ends_at, zone);
                return (
                  <article key={r.id} className="scheduled-card">
                    <div className="section-title">
                      <strong>{r.employee_name}</strong>
                      <span className={"schedule-status " + r.status}>
                        {statusLabel[r.status]}
                      </span>
                    </div>
                    <p>{r.store_name}</p>
                    {zone !== timezone ? <small>{zone}</small> : null}
                    <p className="scheduled-time">
                      {start.time}–{end.time}
                      {start.date !== end.date ? " (+1 hari)" : ""}
                    </p>
                    {start.date !== selectedDate ? (
                      <small>Lanjutan shift dari {start.date}</small>
                    ) : null}
                    {r.has_attendance ? (
                      <small>Sudah memiliki absensi</small>
                    ) : null}
                    <div className="row-actions">
                      <button
                        disabled={r.status === "cancelled" || busy}
                        onClick={() =>
                          setEditor({ kind: "schedule", item: r })
                        }
                      >
                        Edit
                      </button>
                      {r.status !== "cancelled" && !r.has_attendance ? (
                        <button disabled={busy} onClick={() => setEditor({ kind: "schedule", item: r, move: true })}>
                          Pindahkan
                        </button>
                      ) : null}
                      {r.status === "draft" ? (
                        <button
                          disabled={busy}
                          onClick={() =>
                            setConfirmation({
                              item: r,
                              status: "published",
                            })
                          }
                        >
                          Terbitkan
                        </button>
                      ) : null}
                      {r.status !== "cancelled" ? (
                        <button
                          disabled={busy}
                          onClick={() =>
                            setConfirmation({
                              item: r,
                              status: "cancelled",
                            })
                          }
                        >
                          Batalkan
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
      {generating ? <ScheduleGenerator people={people} stores={stores} templates={templates} date={selectedDate} timezone={timezone} onClose={()=>setGenerating(false)} onSaved={(count,published)=>{setGenerating(false);setNotice(published ? `${count} jadwal berhasil dibuat dan diterbitkan.` : `${count} draft jadwal berhasil dibuat. Periksa lalu terbitkan jadwal.`);reload()}}/> : null}
      {editor ? (
        <Modal
          title={
            (editor.move ? "Pindahkan " : editor.item ? "Edit " : "Tambah ") +
            (editor.kind === "template" ? "template shift" : "jadwal")
          }
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <ScheduleEditor
            editor={editor}
            templates={templates}
            people={people}
            stores={stores}
            timezone={timezone}
            date={selectedDate}
            defaultEmployeeId={employeeId}
            defaultStoreId={storeId}
            onBusy={setBusy}
            onSaved={(date) => {
              if (date) setSelectedDate(date);
              setEditor(null);
              setNotice("Perubahan jadwal berhasil disimpan.");
              reload();
            }}
          />
        </Modal>
      ) : null}
      {confirmation ? (
        <Modal
          title={
            confirmation.status === "published"
              ? "Terbitkan jadwal?"
              : "Batalkan jadwal?"
          }
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <form onSubmit={decide}>
            <p>
              <strong>{confirmation.item.employee_name}</strong> ·{" "}
              {confirmation.item.store_name}
            </p>
            <p>
              {new Intl.DateTimeFormat("id-ID", {
                timeZone: String(
                  confirmation.item.rule_snapshot.timezone ?? timezone,
                ),
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(confirmation.item.starts_at))}{" "}
              —{" "}
              {new Intl.DateTimeFormat("id-ID", {
                timeZone: String(
                  confirmation.item.rule_snapshot.timezone ?? timezone,
                ),
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(confirmation.item.ends_at))}
            </p>
            <p>
              {confirmation.status === "published"
                ? "Jadwal akan terlihat oleh karyawan. Shift yang bertabrakan akan ditolak."
                : "Jadwal dan histori tetap disimpan. Jadwal batal tidak dapat diterbitkan kembali."}
            </p>
            {confirmation.item.has_attendance ? (
              <label className="checkbox-field">
                <input type="checkbox" name="confirmWithAttendance" required />
                Saya memahami sudah ada absensi dan histori akan tetap
                dipertahankan.
              </label>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Kembali
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Memproses…" : "Ya, lanjutkan"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
function ScheduleEditor({
  editor,
  templates,
  people,
  stores,
  timezone,
  date,
  defaultEmployeeId,
  defaultStoreId,
  onSaved,
  onBusy,
}: {
  editor: {
    kind: "template" | "schedule";
    item?: ScheduledShift | ShiftTemplate;
    move?: boolean;
  };
  templates: ShiftTemplate[];
  people: SchedulePerson[];
  stores: Store[];
  timezone: string;
  date: string;
  defaultEmployeeId: string;
  defaultStoreId: string;
  onSaved: (date?: string) => void;
  onBusy: (value: boolean) => void;
}) {
  const template =
      editor.kind === "template"
        ? (editor.item as ShiftTemplate | undefined)
        : undefined,
    schedule =
      editor.kind === "schedule"
        ? (editor.item as ScheduledShift | undefined)
        : undefined;
  const zone = String(schedule?.rule_snapshot.timezone ?? timezone),
    start = schedule ? localParts(schedule.starts_at, zone) : null,
    end = schedule ? localParts(schedule.ends_at, zone) : null;
  const [startTime, setStart] = useState(
      template?.start_local_time ?? start?.time ?? "08:00",
    ),
    [endTime, setEnd] = useState(
      template?.end_local_time ?? end?.time ?? "16:00",
    ),
    [cross, setCross] = useState(
      template?.crosses_midnight ??
        (start && end ? start.date !== end.date : false),
    ),
    [templateId, setTemplate] = useState(schedule?.template_id ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<ScheduleRequestError | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        onBusy(true);
        setError(null);
        try {
          const body =
            editor.kind === "template"
              ? {
                  name: form.get("name"),
                  startTime,
                  endTime,
                  crossesMidnight: cross,
                  graceMinutes: Number(form.get("graceMinutes")),
                  isActive: form.get("isActive") === "true",
                  ...(template ? { version: template.version } : {}),
                }
              : {
                  employeeId: editor.move ? schedule?.employee_id : form.get("employeeId"),
                  storeId: editor.move ? schedule?.store_id : form.get("storeId"),
                  templateId: templateId || null,
                  date: form.get("date"),
                  startTime,
                  endTime,
                  crossesMidnight: cross,
                  ...(schedule
                    ? {
                        version: schedule.version,
                        confirmWithAttendance:
                          form.get("confirmWithAttendance") === "on",
                      }
                    : {}),
                };
          await api(
            (editor.kind === "template" ? "shift-templates" : "schedules") +
              (editor.item ? "/" + editor.item.id : ""),
            editor.item ? "PATCH" : "POST",
            body,
          );
          onSaved(editor.kind === "schedule" ? String(form.get("date")) : undefined);
        } catch (err) {
          setError(
            err instanceof ScheduleRequestError
              ? err
              : new ScheduleRequestError("Perubahan belum tersimpan."),
          );
        } finally {
          setBusy(false);
          onBusy(false);
        }
      }}
    >
      {editor.move && schedule ? (
        <>
          <p>{schedule.employee_name} · {schedule.store_name} · {startTime}–{endTime}{cross ? " (+1 hari)" : ""}</p>
          <label>Tanggal tujuan<input name="date" type="date" required /></label>
          <p className="hint">Shift ini akan dipindahkan dari {start?.date}. Jika tidak ada shift lain, tanggal asal menjadi hari tanpa jadwal.</p>
        </>
      ) : <>
      {editor.kind === "template" ? (
        <label>
          Nama template
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={template?.name}
          />
        </label>
      ) : (
        <>
          <label>
            Karyawan
            <select
              name="employeeId"
              required
              defaultValue={schedule?.employee_id ?? defaultEmployeeId}
              disabled={schedule?.has_attendance}
            >
              <option value="" disabled>
                Pilih karyawan
              </option>
              {schedule &&
              !people.some((p) => p.id === schedule.employee_id) ? (
                <option value={schedule.employee_id}>
                  {schedule.employee_name} (nonaktif)
                </option>
              ) : null}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            {schedule?.has_attendance ? (
              <input
                type="hidden"
                name="employeeId"
                value={schedule.employee_id}
              />
            ) : null}
          </label>
          <label>
            Toko penugasan
            <select
              name="storeId"
              required
              defaultValue={schedule?.store_id ?? defaultStoreId}
              disabled={schedule?.has_attendance}
            >
              <option value="" disabled>
                Pilih toko
              </option>
              {stores
                .filter((s) => s.is_active || s.id === schedule?.store_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.is_active ? " (nonaktif)" : ""}
                  </option>
                ))}
            </select>
            {schedule?.has_attendance ? (
              <input type="hidden" name="storeId" value={schedule.store_id} />
            ) : null}
          </label>
          <label>
            Tanggal mulai
            <input
              name="date"
              required
              type="date"
              defaultValue={start?.date ?? date}
            />
          </label>
          <label>
            Template (opsional)
            <select
              value={templateId}
              disabled={schedule?.has_attendance}
              onChange={(e) => {
                setTemplate(e.target.value);
                const t = templates.find((t) => t.id === e.target.value);
                if (t) {
                  setStart(t.start_local_time);
                  setEnd(t.end_local_time);
                  setCross(t.crosses_midnight);
                }
              }}
            >
              <option value="">Jam khusus</option>
              {templates
                .filter((t) => t.is_active || t.id === schedule?.template_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {!t.is_active ? " (nonaktif)" : ""}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      <div className="coordinate-fields">
        <label>
          Jam mulai
          <input
            required
            type="time"
            value={startTime}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Jam selesai
          <input
            required
            type="time"
            value={endTime}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={cross}
          onChange={(e) => setCross(e.target.checked)}
        />
        Selesai pada hari berikutnya
      </label>
      {editor.kind === "template" ? (
        <>
          <label>
            Toleransi terlambat (menit)
            <input
              name="graceMinutes"
              type="number"
              required
              min={0}
              max={120}
              defaultValue={template?.grace_minutes ?? 5}
            />
          </label>
          <label>
            Status template
            <select
              name="isActive"
              defaultValue={String(template?.is_active ?? true)}
            >
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </label>
        </>
      ) : (
        <p className="hint">
          Waktu mengikuti {zone}. Jadwal baru disimpan sebagai draft.
        </p>
      )}
      </>}
      {schedule?.has_attendance ? (
        <label className="checkbox-field">
          <input required type="checkbox" name="confirmWithAttendance" />
          Saya memahami perubahan waktu ini memengaruhi jadwal yang sudah
          memiliki absensi. Bukti asli tetap disimpan.
        </label>
      ) : null}
      {error ? (
        <div className="auth-error" role="alert">
          {error.message}
          {Object.keys(error.fields).length ? (
            <p>Periksa: {Object.keys(error.fields).join(", ")}</p>
          ) : null}
        </div>
      ) : null}
      <button className="primary" disabled={busy}>
        {busy ? "Menyimpan…" : "Simpan"}
      </button>
    </form>
  );
}
