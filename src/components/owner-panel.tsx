"use client";
import {
  useCallback,
  useEffect,
  useState,
  type InputHTMLAttributes,
  type CSSProperties,
} from "react";
import Link from "next/link";
import Image from "next/image";
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
function EmployeePhoto({employee}:{employee:Employee}) {
 const [failed,setFailed]=useState(false);
 return <span className="employee-id-avatar">{failed?employee.full_name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase():<Image unoptimized src={'/api/v1/employees/'+employee.id+'/photo'} alt={'Foto '+employee.full_name} width={76} height={76} onError={()=>setFailed(true)}/>}</span>;
}
export function OwnerPanel({
  initialTab = "stores",
}: {
  fullName: string;
  initialTab?: "stores" | "employees" | "settings";
}) {
  const tab = initialTab;
  const [items, setItems] = useState<(Store | Employee)[]>([]),
    [stores, setStores] = useState<Store[]>([]),
    [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);
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
        const params = new URLSearchParams({q: query,offset: String(offset)});
        if (status) params.set("status", status);
        if (storeFilter && tab === "employees") params.set("storeId", storeFilter);
        const [choices, preferences, data] = await Promise.all([
          tab === "employees" ? allStores() : Promise.resolve([]),
          request<BusinessSettings>("settings"),
          tab !== "settings" ? request<Page<Store | Employee>>(tab + "?" + params) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setSettings(preferences);
          setStores(choices);
          if (data) { setItems(data.items); setHasMore(data.hasMore); }
        }
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
      if (!item && form.get("autoSchedule") === "on") body.initialSchedule = {startDate:form.get("scheduleStart"),days:form.getAll("workDay").map(Number)};
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
                : tab === "employees" ? "Kelola profil, akses login, dan penugasan karyawan." : "Atur lokasi dan radius absensi setiap toko."}
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
        {tab === "employees" ? <Link className="owner-inline-link" href="/owner/schedules"><Icon name="calendar"/> Kelola jadwal karyawan <Icon name="arrow"/></Link> : null}
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
          <section className={tab === "employees" ? "employee-id-grid" : "panel"}>
            {items.map((item) => "employee_code" in item ? <button className="employee-id-card" key={item.id} onClick={()=>setDetail(item)}>
              <span className="employee-id-top"><span>EMPLOYEE ID</span><span className={"employee-id-status "+item.status}>{item.status==='active'?'Aktif':'Nonaktif'}</span></span>
              <EmployeePhoto employee={item}/>
              <strong>{item.full_name}</strong><span className="employee-id-code">{item.employee_code}</span>
              <span className="employee-id-store"><Icon name="store"/>{stores.find(store=>store.id===item.primary_store_id)?.name??'Belum ditugaskan'}</span>
              <span className="employee-id-footer">Lihat detail <Icon name="arrow"/></span>
            </button> : (
              <article key={item.id} className="owner-record"><div><h3>{item.name}</h3><p>{item.code}</p><p>{item.address}</p><small>Radius {item.radius_m} m · {item.operating_hours || 'Jam operasional belum diisi'}</small></div><Badge>{item.is_active?'Aktif':'Nonaktif'}</Badge><div className="row-actions"><button disabled={busy} onClick={()=>{setFormError(null);setEditor({kind:'stores',item})}}>Edit</button><button disabled={busy} onClick={()=>void toggle(item)}>{item.is_active?'Nonaktifkan':'Aktifkan'}</button></div></article>
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
      {detail ? <Modal title="Detail karyawan" onClose={()=>setDetail(null)}><section className="employee-detail"><EmployeePhoto key={detail.id+refresh} employee={detail}/><h3>{detail.full_name}</h3><label>Foto profil (JPEG, maksimal 512 KB)<input type="file" accept="image/jpeg" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const response=await fetch('/api/v1/employees/'+detail.id+'/photo',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:file});if(!response.ok)throw new Error((await response.json()).error.message);reload();setNotice('Foto profil tersimpan.')}catch(err){setError(err instanceof Error?err.message:'Foto belum tersimpan.');setDetail(null)}finally{setBusy(false)}}}/></label><dl>{[['ID karyawan',detail.employee_code],['Toko',stores.find(store=>store.id===detail.primary_store_id)?.name??'Belum ditugaskan'],['Status',detail.status==='active'?'Aktif':'Nonaktif'],['Telepon',detail.phone??'Belum diisi'],['Bergabung',detail.joined_at?new Date(detail.joined_at).toLocaleDateString('id-ID'):'Belum diisi']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>PIN lama tidak dapat dibaca. Reset PIN untuk mendapatkan PIN baru yang ditampilkan sekali.</p><div className="row-actions"><button onClick={()=>{setEditor({kind:'employees',item:detail});setDetail(null);setFormError(null)}}>Edit data</button><button disabled={busy} onClick={()=>{setDetail(null);void reset(detail)}}>Reset PIN</button><button disabled={busy} onClick={()=>{setDetail(null);void toggle(detail)}}>{detail.status==='active'?'Nonaktifkan':'Aktifkan'}</button></div><Link className="owner-inline-link" href="/owner/schedules">Kelola jadwal <Icon name="arrow"/></Link></section></Modal> : null}
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
                  title="Jam operasional (HH:mm–HH:mm)"
                  placeholder="08:00–16:00"
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
                  title={employeeItem ? "ID login" : "ID login (opsional)"}
                  placeholder="Dibuat otomatis saat disimpan"
                  maxLength={64}
                  pattern="[A-Za-z0-9_-]+"
                  required={!!employeeItem}
                  defaultValue={employeeItem?.employee_code}
                  issue={formError?.fields.code}
                />
                {!employeeItem ? <p className="owner-form-note">ID unik dan PIN 6 digit dibuat otomatis. PIN ditampilkan sekali setelah karyawan disimpan.</p> : null}
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
                {!employeeItem ? <fieldset className="employee-initial-schedule"><legend>Jadwal awal mengikuti toko</legend><label className="owner-check"><input type="checkbox" name="autoSchedule"/>Buat jadwal terbit untuk tujuh hari pertama</label><p>Jam toko harus berformat 08:00–16:00. Pilih tanggal mulai dan hari kerja di bawah.</p><Field title="Mulai jadwal" type="date" name="scheduleStart" defaultValue={new Intl.DateTimeFormat('en-CA',{timeZone:settings?.timezone??'Asia/Jakarta'}).format(new Date())}/><div className="employee-work-days">{['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((day,i)=><label key={day}><input type="checkbox" name="workDay" value={i}/>{day}</label>)}</div></fieldset> : null}
                <Field
                  name="phone"
                  title="Nomor telepon (opsional)"
                  type="tel"
                  inputMode="tel"
                  onInput={e=>{e.currentTarget.value=e.currentTarget.value.replace(/[^+0-9 ()-]/g,'')}}
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
          Perubahan berlaku untuk penugasan berikutnya. Catatan absensi sebelumnya tetap menggunakan aturan saat itu.
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
