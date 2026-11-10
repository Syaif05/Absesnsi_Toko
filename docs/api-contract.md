# API owner yang tersedia — Fase 4

Semua response menggunakan `{ data: ... }` atau `{ error: { code, message, fields?, requestId } }`; Cache-Control no-store. Sesi owner aktif dan business yang sesuai wajib. Semua write memerlukan Content-Type JSON dan Origin yang sama dengan APP_BASE_URL. Error: 400 validasi/konfirmasi, 401 login, 403 izin/CSRF, 404 resource tak terlihat, 409 kode duplikat/versi konflik, 503 infrastruktur belum tersedia.

| Method | Endpoint | Isi |
|---|---|---|
| GET/POST | `/api/v1/stores` | Daftar / tambah toko |
| GET/PATCH | `/api/v1/stores/:id` | Detail / edit atau nonaktif/aktif |
| GET/POST | `/api/v1/employees` | Daftar employee / tambah dengan PIN sekali tampil |
| GET/PATCH | `/api/v1/employees/:id` | Detail / edit ID, profil, penugasan atau status |
| POST | `/api/v1/employees/:id/reset-pin` | Reset PIN melalui service Fase 3 |
| GET/PATCH | `/api/v1/settings` | Baca / ubah pengaturan whitelist |

GET daftar mendukung `q`, `status=active|inactive`, `offset`; employee juga `storeId`. Response `{items, hasMore, nextOffset}` berisi maksimal 50 data per halaman. Daftar tidak menyertakan hash/token/PIN.

POST toko: `{name, code, address, lat, lng, radiusM?, isActive?, operatingHours?}`. PATCH menerima subset field tersebut, ditambah `confirmSensitive:true` bila mengubah status. Radius 10–2000 m; koordinat valid.

POST employee: `{fullName, code?, storeId?, status?, phone?, joinedAt?}`. Code kosong/tidak ada di API berarti otomatis hanya bila field dihilangkan; UI menghilangkan field kosong. joinedAt memakai YYYY-MM-DD. Response `{employee, temporaryPin}`; simpan PIN secara aman saat respons pertama. PATCH menerima subset field; perubahan code/status/storeId memerlukan `confirmSensitive:true`. storeId dan field opsional bisa null untuk mengosongkan. Role, businessId, hash dan credential tidak dapat dikirim melalui form ini.

PATCH settings mengirim snapshot lengkap `{businessName, timezone, accent, radiusM, accuracyM, graceMinutes, version}` dari GET terakhir. version diperiksa secara atomik; konflik mengembalikan 409. Nama/branding/aturan hanya menyimpan data bisnis, tidak ada key API atau secret. Semua mutation membuat audit dalam transaksi yang sama.

## API Fase 5 — Jadwal

| Method | Endpoint | Aktor / isi |
|---|---|---|
| GET/POST | `/api/v1/shift-templates` | Owner: daftar / buat template |
| GET/PATCH | `/api/v1/shift-templates/:id` | Owner: edit/nonaktif/aktif, version wajib |
| GET | `/api/v1/schedule-people` | Owner: employee/owner aktif dalam usaha, pagination |
| GET/POST | `/api/v1/schedules` | Owner: daftar mingguan / buat draft |
| GET/PATCH | `/api/v1/schedules/:id` | Owner: edit atau publish/cancel |
| GET | `/api/v1/me/schedules` | Login: published milik sesi sendiri |

Template: `{name,startTime,endTime,crossesMidnight,graceMinutes,isActive}`; jam HH:mm. PATCH mengirim field lengkap ditambah `version`. Edit tidak mengubah jadwal yang sudah tersimpan.

POST jadwal: `{employeeId,storeId,templateId:null|UUID,date,startTime,endTime,crossesMidnight}`. date YYYY-MM-DD; zona diambil server. POST tidak menerima status published. PATCH edit menerima field yang sama ditambah `version` dan `confirmWithAttendance` bila diperlukan.

PATCH status: `{status:"published"|"cancelled",version,confirmed:true,confirmWithAttendance?:true}`. Transisi `draft → published/cancelled` dan `published → cancelled`; cancelled final. Konflik jadwal/versi/status adalah 409. Tidak ada endpoint hapus permanen.

GET schedules memerlukan `from` dan `to` (tanggal akhir eksklusif, 1–31 hari); opsional employeeId/storeId/status/offset. Query menyertakan shift dari hari sebelumnya yang masih melintasi awal rentang. Pagination `{items,hasMore,nextOffset,timezone}` maksimal 50 baris; template/people juga pagination 50. GET me/schedules hanya menerima from/to/offset; identitas tidak boleh ditentukan client. Response waktu selalu ISO UTC dan menyertakan snapshot interpretasi jadwal.

## API Fase 6 — Absensi

| Method | Endpoint | Isi |
|---|---|---|
| GET | `/api/v1/me/attendance/context` | Jadwal aktif, sesi terbuka, snapshot aturan, missingCheckout, waktu server, timezone |
| GET | `/api/v1/me/attendance?offset=0` | Pengiriman sendiri, 20 event, hasMore/nextOffset |
| POST | `/api/v1/attendance/check-in` | Multipart selfie + metadata, sesi diambil dari cookie |
| POST | `/api/v1/attendance/check-out` | Multipart, jadwal sesi sendiri yang masih terbuka |
| GET | `/api/v1/attendance/:eventId/photo` | Signed URL 60 detik; employee sendiri / owner satu usaha |

POST memerlukan Origin sama dengan APP_BASE_URL; **multipart/form-data**, bukan JSON seperti CRUD owner. Tepat satu field photo JPEG ≤512 KB dan satu field metadata JSON ≤4096 karakter. Metadata `{idempotencyKey:UUID,scheduleId:UUID,location,reason:""}`. Location `{status:"available",lat,lng,accuracyM}` atau `{status:"denied"|"unavailable"}`. Exception perlu alasan minimal 5 karakter. Response `{id,sessionId,eventType,recordedAt,locationStatus,reviewStatus,late}` di dalam data. Waktu resmi ISO UTC dari PostgreSQL; pending belum disetujui.

Tidak ada employeeId/time/radius yang dapat ditentukan client. Retry memakai foto + metadata + key persis sama. Kunci yang sama dengan payload berbeda: 409 IDEMPOTENCY_CONFLICT; retry yang sudah commit mengembalikan event lama. Batas 20 kunci baru/jam/employee, error 429. Error format/foto/alasan 400, body >528 KiB 413, sesi/jadwal/expired/conflict 409, infrastruktur 503. Kegagalan jaringan/503 belum mengonfirmasi pengiriman; gunakan retry identik atau periksa riwayat. Semua response no-store, tanpa path foto/secret pada daftar.

Detail recovery, transaction dan signed URL di `docs/attendance.md`. Endpoint keputusan approval/koreksi belum tersedia.
