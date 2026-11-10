"use client";
import {
  useCallback,
  useEffect,
  useState,
  type InputHTMLAttributes,
  type CSSProperties,
} from "react";
import Link from "next/link";
import type {
  Store,
  Employee,
  BusinessSettings,
  Page,
} from "@/server/owner/models";
import { Icon, Modal, Badge } from "./ui";
class RequestError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/v1/" + path, {
    method,
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(
      result.error?.message ?? "Permintaan gagal.",
      result.error?.fields,
    );
  return result.data;
}
async function allStores() {
  let offset = 0;
  const result: Store[] = [];
  while (true) {
    const page = await request<Page<Store>>("stores?offset=" + offset);
    result.push(...page.items);
    if (!page.hasMore) return result;
    offset = page.nextOffset;
  }
}
function Field({
  title,
  issue,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { title: string; issue?: string }) {
  return (
    <label>
      {title}
      <input {...props} aria-invalid={!!issue} />
      {issue ? <span className="field-error">{issue}</span> : null}
    </label>
  );
}
export function OwnerPanel({
  fullName,
  initialTab = "stores",
}: {
  fullName: string;
  initialTab?: "stores" | "employees" | "settings";
}) {
  const [tab, setTab] = useState<"stores" | "employees" | "settings">(
    initialTab,
  );
  const [items, setItems] = useState<(Store | Employee)[]>([]),
    [stores, setStores] = useState<Store[]>([]),
    [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{
      kind: "stores" | "employees";
      item?: Store | Employee;
    } | null>(null),
    [formError, setFormError] = useState<RequestError | null>(null),
    [pin, setPin] = useState<{ code: string; value: string } | null>(null);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [storeFilter, setStoreFilter] = useState(""),
    [offset, setOffset] = useState(0),
    [hasMore, setHasMore] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    resolve: (value: boolean) => void;
  } | null>(null);
  const ask = (message: string) =>
    new Promise<boolean>((resolve) => setConfirmation({ message, resolve }));
  const answer = (value: boolean) => {
    confirmation?.resolve(value);
    setConfirmation(null);
  };
  const reload = useCallback(() => setRefresh((x) => x + 1), []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [choices, preferences] = await Promise.all([
          allStores(),
          request<BusinessSettings>("settings"),
        ]);
        if (!cancelled) setSettings(preferences);
        if (tab === "settings") {
          if (!cancelled) setSettings(preferences);
        } else {
          const params = new URLSearchParams({
            q: query,
            offset: String(offset),
          });
          if (status) params.set("status", status);
          if (storeFilter && tab === "employees")
            params.set("storeId", storeFilter);
          const data = await request<Page<Store | Employee>>(
            tab + "?" + params,
          );
          if (!cancelled) {
            setItems(data.items);
            setHasMore(data.hasMore);
          }
        }
        if (!cancelled) setStores(choices);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Data belum dapat dimuat.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, query, status, storeFilter, offset, refresh]);
  const changeTab = (next: typeof tab) => {
    window.history.replaceState(null, "", "?tab=" + next);
    setTab(next);
    setOffset(0);
    setQuery("");
    setStatus("");
    setStoreFilter("");
    setPin(null);
    setNotice("");
    setFormError(null);
  };
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor || busy) return;
    const form = new FormData(e.currentTarget),
      kind = editor.kind,
      item = editor.item;
    let body: Record<string, unknown>;
    if (kind === "stores")
      body = {
        name: form.get("name"),
        code: form.get("code"),
        address: form.get("address"),
        lat: Number(form.get("lat")),
        lng: Number(form.get("lng")),
        radiusM: Number(form.get("radiusM")),
        operatingHours: form.get("operatingHours"),
        isActive: form.get("isActive") === "true",
      };
    else {
      body = {
        fullName: form.get("fullName"),
        storeId: form.get("storeId") || null,
        status: form.get("status"),
        phone: form.get("phone") || null,
        joinedAt: form.get("joinedAt") || null,
      };
      if (form.get("code")) body.code = form.get("code");
    }
    if (item) {
      const sensitive =
        kind === "stores"
          ? body.isActive !== (item as Store).is_active
          : body.code !== (item as Employee).employee_code ||
            body.status !== (item as Employee).status ||
            body.storeId !== (item as Employee).primary_store_id;
      if (
        sensitive &&
        !(await ask(
          "Simpan perubahan ID, status, atau penugasan? Perubahan ID/status mencabut sesi karyawan.",
        ))
      )
        return;
      body.confirmSensitive = true;
    }
    setBusy(true);
    setFormError(null);
    setPin(null);
    try {
      if (kind === "employees" && !item) {
        const result = await request<{
          employee: Employee;
          temporaryPin: string;
        }>("employees", "POST", body);
        setPin({
          code: result.employee.employee_code,
          value: result.temporaryPin,
        });
      } else
        await request(
          kind + (item ? "/" + item.id : ""),
          item ? "PATCH" : "POST",
          body,
        );
      setEditor(null);
      setNotice("Perubahan berhasil disimpan.");
      reload();
    } catch (err) {
      setFormError(
        err instanceof RequestError
          ? err
          : new RequestError("Perubahan belum tersimpan."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(item: Store | Employee) {
    const active =
      "is_active" in item ? item.is_active : item.status === "active";
    if (
      !(await ask(
        `${active ? "Nonaktifkan" : "Aktifkan kembali"} ${"name" in item ? item.name : item.full_name}? Histori tetap disimpan.`,
      ))
    )
      return;
    setBusy(true);
    setNotice("");
    setError("");
    setPin(null);
    try {
      await request(
        tab + "/" + item.id,
        "PATCH",
        "is_active" in item
          ? { isActive: !active, confirmSensitive: true }
          : { status: active ? "inactive" : "active", confirmSensitive: true },
      );
      setNotice("Status berhasil diperbarui.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status belum diubah.");
    } finally {
      setBusy(false);
    }
  }
  async function reset(item: Employee) {
    if (
      !(await ask(
        "Reset PIN " + item.full_name + " dan cabut seluruh sesinya?",
      ))
    )
      return;
    setBusy(true);
    setError("");
    setPin(null);
    try {
      const result = await request<{ temporaryPin: string }>(
        "employees/" + item.id + "/reset-pin",
        "POST",
        {},
      );
      setPin({ code: item.employee_code, value: result.temporaryPin });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset gagal.");
    } finally {
      setBusy(false);
    }
  }
  const storeItem =
      editor?.kind === "stores"
        ? (editor.item as Store | undefined)
        : undefined,
    employeeItem =
      editor?.kind === "employees"
        ? (editor.item as Employee | undefined)
        : undefined;
  const accent = settings?.accent ?? "#8095f5";
  const rgb = [1, 3, 5]
    .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (
    <div
      className="owner-live"
      style={
        {
          "--accent": accent,
          "--accent-text": luminance > 0.179 ? "#17212e" : "#ffffff",
        } as CSSProperties
      }
    >
      <header className="owner-live-header">
        <div>
          <span className="eyebrow">RUANG KERJA OWNER</span>
          <h1>{settings?.businessName ?? "Kelola usaha"}</h1>
          <p>{fullName}</p>
        </div>
        <Link href="/account" className="owner-account">
          Akun & keluar <Icon name="arrow" />
        </Link>
      </header>
      <nav className="owner-tabs" aria-label="Administrasi owner">
        {(
          [
            ["stores", "Toko", "store"],
            ["employees", "Karyawan", "people"],
            ["settings", "Pengaturan", "settings"],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            aria-current={tab === value ? "page" : undefined}
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => changeTab(value)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
        <Link href="/owner/dashboard" className="text-button">Dashboard</Link><Link href="/owner/reports" className="text-button">Laporan</Link><Link href="/owner/approvals" className="text-button">Persetujuan</Link><Link href="/owner/schedules"><Icon name="calendar"/>Jadwal</Link>
      </nav>
      <main className="owner-content">
        <div className="page-heading">
          <div>
            <h2>
              {tab === "stores"
                ? "Daftar toko"
                : tab === "employees"
                  ? "Daftar karyawan"
                  : "Pengaturan usaha"}
            </h2>
            <p>
              {tab === "settings"
                ? "Aturan baru berlaku untuk transaksi berikutnya."
                : "Data tersimpan di server. Histori tetap dipertahankan."}
            </p>
          </div>
          {tab !== "settings" ? (
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setFormError(null);
                setEditor({ kind: tab });
              }}
            >
              <Icon name="plus" />
              Tambah {tab === "stores" ? "toko" : "karyawan"}
            </button>
          ) : null}
        </div>
        {notice ? (
          <p role="status" className="auth-notice">
            {notice}
          </p>
        ) : null}
        {pin ? (
          <section className="auth-notice" role="status">
            <h2>PIN sementara untuk {pin.code}</h2>
            <strong className="one-time-pin">{pin.value}</strong>
            <p>
              Catat sekarang dan sampaikan secara aman. Karyawan dapat
              menggantinya kapan saja melalui menu Akun. Setelah ditutup, PIN ini tidak dapat
              dibaca kembali.
            </p>
            <button onClick={() => setPin(null)}>
              Sudah dicatat, sembunyikan
            </button>
          </section>
        ) : null}
        {tab !== "settings" ? (
          <form
            className="owner-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(String(new FormData(e.currentTarget).get("q") ?? ""));
              setOffset(0);
            }}
          >
            <label>
              Cari nama atau kode
              <input
                name="q"
                key={tab}
                placeholder="Ketik nama atau kode"
                defaultValue=""
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
            {tab === "employees" ? (
              <label>
                Toko
                <select
                  value={storeFilter}
                  onChange={(e) => {
                    setStoreFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">Semua toko</option>
                  {stores.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="submit">Cari</button>
          </form>
        ) : null}
        {error ? (
          <section className="panel auth-error" role="alert">
            <h2>Data belum dapat dimuat</h2>
            <p>{error}</p>
            <button onClick={reload}>Coba lagi</button>
            <Link href="/login">Kembali ke login</Link>
          </section>
        ) : loading ? (
          <section className="panel state-panel" role="status" aria-busy="true">
            <Icon name="clock" />
            <h2>Memuat data…</h2>
            <p>Menyiapkan informasi usaha Anda.</p>
          </section>
        ) : tab === "settings" && settings ? (
          <SettingsForm
            key={settings.version}
            value={settings}
            onReload={reload}
            onSaved={(value) => {
              setSettings(value);
              setNotice("Pengaturan berhasil disimpan.");
            }}
          />
        ) : items.length ? (
          <section className="panel">
            {items.map((item) => (
              <article key={item.id} className="owner-record">
                <div>
                  <h3>{"name" in item ? item.name : item.full_name}</h3>
                  <p>{"code" in item ? item.code : item.employee_code}</p>
                  <p>
                    {"address" in item
                      ? item.address
                      : (stores.find((s) => s.id === item.primary_store_id)
                          ?.name ?? "Belum ditugaskan ke toko")}
                  </p>
                  {"radius_m" in item ? (
                    <small>
                      Radius {item.radius_m} m ·{" "}
                      {item.operating_hours || "Jam operasional belum diisi"}
                    </small>
                  ) : null}
                </div>
                <Badge>
                  {(
                    "is_active" in item
                      ? item.is_active
                      : item.status === "active"
                  )
                    ? "Aktif"
                    : "Nonaktif"}
                </Badge>
                <div className="row-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setFormError(null);
                      setEditor({ kind: tab as "stores" | "employees", item });
                    }}
                  >
                    Edit
                  </button>
                  {"employee_code" in item ? (
                    <button disabled={busy} onClick={() => reset(item)}>
                      Reset PIN
                    </button>
                  ) : null}
                  <button disabled={busy} onClick={() => toggle(item)}>
                    {(
                      "is_active" in item
                        ? item.is_active
                        : item.status === "active"
                    )
                      ? "Nonaktifkan"
                      : "Aktifkan"}
                  </button>
                </div>
              </article>
            ))}
            <div className="pagination">
              <button
                disabled={offset === 0 || busy}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                Sebelumnya
              </button>
              <span>Halaman {Math.floor(offset / 50) + 1}</span>
              <button
                disabled={!hasMore || busy}
                onClick={() => setOffset(offset + 50)}
              >
                Berikutnya
              </button>
            </div>
          </section>
        ) : (
          <section className="panel state-panel">
            <Icon name={tab === "stores" ? "store" : "people"} />
            <h2>
              {query || status || storeFilter
                ? "Tidak ada hasil yang cocok"
                : "Belum ada " + (tab === "stores" ? "toko" : "karyawan")}
            </h2>
            <p>
              {query || status || storeFilter
                ? "Coba ubah pencarian atau filter."
                : "Gunakan tombol tambah untuk memulai."}
            </p>
          </section>
        )}
      </main>
      {editor ? (
        <Modal
          title={
            (editor.item ? "Edit " : "Tambah ") +
            (editor.kind === "stores" ? "toko" : "karyawan")
          }
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form onSubmit={save}>
            {editor.kind === "stores" ? (
              <>
                <Field
                  name="name"
                  title="Nama toko"
                  required
                  maxLength={120}
                  defaultValue={storeItem?.name}
                  issue={formError?.fields.name}
                />
                <Field
                  name="code"
                  title="Kode unik toko"
                  required
                  maxLength={64}
                  pattern="[A-Za-z0-9_-]+"
                  defaultValue={storeItem?.code}
                  issue={formError?.fields.code}
                />
                <Field
                  name="address"
                  title="Alamat"
                  required
                  maxLength={500}
                  defaultValue={storeItem?.address}
                  issue={formError?.fields.address}
                />
                <div className="coordinate-fields">
                  <Field
                    name="lat"
                    title="Latitude"
                    required
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    defaultValue={storeItem?.lat}
                    issue={formError?.fields.lat}
                  />
                  <Field
                    name="lng"
                    title="Longitude"
                    required
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    defaultValue={storeItem?.lng}
                    issue={formError?.fields.lng}
                  />
                </div>
                <Field
                  name="radiusM"
                  title="Radius (meter)"
                  required
                  type="number"
                  min={10}
                  max={2000}
                  defaultValue={storeItem?.radius_m ?? settings?.radiusM ?? 100}
                  issue={formError?.fields.radiusM}
                />
                <Field
                  name="operatingHours"
                  title="Jam operasional (informasi)"
                  maxLength={120}
                  defaultValue={storeItem?.operating_hours ?? ""}
                />
                <label>
                  Status
                  <select
                    name="isActive"
                    defaultValue={String(storeItem?.is_active ?? true)}
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <Field
                  name="fullName"
                  title="Nama lengkap"
                  required
                  maxLength={120}
                  defaultValue={employeeItem?.full_name}
                  issue={formError?.fields.fullName}
                />
                <Field
                  name="code"
                  title="ID login (kosongkan untuk otomatis)"
                  maxLength={64}
                  pattern="[A-Za-z0-9_-]+"
                  required={!!employeeItem}
                  defaultValue={employeeItem?.employee_code}
                  issue={formError?.fields.code}
                />
                <label>
                  Toko asal
                  <select
                    name="storeId"
                    defaultValue={employeeItem?.primary_store_id ?? ""}
                  >
                    <option value="">Belum ditugaskan</option>
                    {stores
                      .filter(
                        (s) =>
                          s.is_active ||
                          s.id === employeeItem?.primary_store_id,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {!s.is_active ? " (nonaktif)" : ""}
                        </option>
                      ))}
                  </select>
                  {formError?.fields.storeId ? (
                    <span className="field-error">
                      {formError.fields.storeId}
                    </span>
                  ) : null}
                </label>
                <Field
                  name="phone"
                  title="Nomor telepon (opsional)"
                  type="tel"
                  maxLength={30}
                  defaultValue={employeeItem?.phone ?? ""}
                  issue={formError?.fields.phone}
                />
                <Field
                  name="joinedAt"
                  title="Tanggal bergabung (opsional)"
                  type="date"
                  defaultValue={
                    employeeItem?.joined_at
                      ? new Intl.DateTimeFormat("en-CA", {
                          timeZone: "Asia/Jakarta",
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        }).format(new Date(employeeItem.joined_at))
                      : ""
                  }
                  issue={formError?.fields.joinedAt}
                />
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={employeeItem?.status ?? "active"}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </label>
                <p className="hint">
                  Akun dibuat sebagai karyawan. PIN sementara dibuat sistem dan
                  ditampilkan satu kali.
                </p>
              </>
            )}
            {formError ? (
              <p className="auth-error" role="alert">
                {formError.message}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Batal
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {confirmation ? (
        <Modal title="Konfirmasi tindakan" onClose={() => answer(false)}>
          <p>{confirmation.message}</p>
          <div className="form-actions">
            <button onClick={() => answer(false)}>Batal</button>
            <button className="primary" onClick={() => answer(true)}>
              Ya, lanjutkan
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
function SettingsForm({
  value,
  onSaved,
  onReload,
}: {
  value: BusinessSettings;
  onReload: () => void;
  onSaved: (value: BusinessSettings) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<RequestError | null>(null);
  return (
    <section className="panel settings-panel">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          try {
            onSaved(
              await request<BusinessSettings>("settings", "PATCH", {
                businessName: f.get("businessName"),
                timezone: f.get("timezone"),
                accent: f.get("accent"),
                radiusM: Number(f.get("radiusM")),
                accuracyM: Number(f.get("accuracyM")),
                graceMinutes: Number(f.get("graceMinutes")),
                version: value.version,
              }),
            );
          } catch (err) {
            setError(
              err instanceof RequestError
                ? err
                : new RequestError("Pengaturan belum tersimpan."),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          title="Nama usaha"
          name="businessName"
          required
          maxLength={120}
          defaultValue={value.businessName}
          issue={error?.fields.businessName}
        />
        <label>
          Zona waktu
          <select name="timezone" defaultValue={value.timezone}>
            {["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <Field
          title="Warna aksen (HEX)"
          name="accent"
          required
          pattern="#[0-9a-fA-F]{6}"
          defaultValue={value.accent}
          issue={error?.fields.accent}
        />
        <Field
          title="Radius default (meter)"
          name="radiusM"
          required
          type="number"
          min={10}
          max={2000}
          defaultValue={value.radiusM}
          issue={error?.fields.radiusM}
        />
        <Field
          title="Batas akurasi GPS (meter)"
          name="accuracyM"
          required
          type="number"
          min={10}
          max={1000}
          defaultValue={value.accuracyM}
          issue={error?.fields.accuracyM}
        />
        <Field
          title="Toleransi terlambat (menit)"
          name="graceMinutes"
          required
          type="number"
          min={0}
          max={120}
          defaultValue={value.graceMinutes}
          issue={error?.fields.graceMinutes}
        />
        <p className="hint">
          Versi aturan {value.version}. Perubahan tidak mengubah snapshot
          absensi historis.
        </p>
        {error ? (
          <div role="alert" className="auth-error">
            <p>{error.message}</p>
            <button type="button" onClick={onReload}>
              Muat ulang pengaturan
            </button>
          </div>
        ) : null}
        <button className="primary" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
    </section>
  );
}
