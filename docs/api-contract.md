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

Detail recovery, transaction dan signed URL di `docs/attendance.md`. Endpoint keputusan approval/koreksi ditambahkan Fase 7 di bagian berikutnya.

## API Fase 7 — Persetujuan dan koreksi

| Method | Endpoint | Isi |
|---|---|---|
| GET/POST | `/api/v1/approvals` | Daftar scoped / pengajuan koreksi atau recovery exception |
| GET | `/api/v1/approvals/:id` | Detail bukti asli, nilai sebelum/diminta/diterapkan, catatan resmi dan reviewer |
| POST | `/api/v1/approvals/:id/decision` | Owner: status approved/rejected, note, confirmed:true |
| GET | `/api/v1/me/correction-targets` | Jadwal sendiri yang dapat diajukan, effective times dan timezone |

Daftar: view=mine/inbox (inbox owner saja), status=all/pending/approved/rejected, type opsional, storeId opsional, offset. Maksimal 20 baris. POST JSON, Origin sama, body ≤4096 byte. Koreksi memakai requestKey UUID dan changes satu/dua field check_in_at/check_out_at dengan ISO8601 bertanda zona. Keputusan wajib catatan dan konfirmasi; final. Konflik baseline, pending duplikat atau keputusan ulang: 409. Rate limit persisten 20 pengajuan baru dan 60 keputusan per 15 menit per actor. Bukti asli tidak ditimpa. Kontrak lengkap dan contoh ada di [approvals.md](approvals.md).

## API Fase 8 — Monitoring dan laporan

GET owner: `/api/v1/dashboard/summary`, `/dashboard/stores`, `/dashboard/activity`, `/attendance`, `/employees/:id/attendance`. Detail `/api/v1/attendance/:sessionId` untuk owner satu bisnis atau employee pemilik sesi.

Query utama: from/to tanggal ISO (akhir eksklusif, 1–31 hari), storeId?/employeeId?. Daftar menambah offset dan maksimum 20 baris. Riwayat attendance menerima category=all/valid/pending/rejected/not_recorded/upcoming; KPI tidak memakai category. Endpoint employee menolak employeeId query karena identitas sudah pada path. Detail memakai requestOffset untuk 20 histori permintaan per halaman. Seluruhnya GET/no-store, role/business/ownership server-side; data di luar scope 404 dan endpoint global untuk employee/manager 403.

Summary: total jadwal = valid+pending+rejected+notRecorded+upcoming; recorded = valid+pending+rejected. Urutan kategori rejection > pending > sah > belum dimulai/belum tercatat. Pending request dihitung terpisah dari kategori absensi. Histori/KPI memakai awal shift snapshot; activity memakai waktu kejadian. Detail dan contoh perilaku di [reporting.md](reporting.md).

## Hardening Fase 9

POST `/api/v1/auth/change-password` (owner sendiri) menerima `{currentPassword,newPassword}`; password baru 12–128 karakter, berbeda, validasi password lama dan rate limit 5/15 menit. Sukses mencabut seluruh sesi owner, menghapus cookie dan menulis audit tanpa plaintext; login ulang diperlukan. Employee tidak dapat memakainya.

JSON harus MIME application/json, UTF-8 valid, ≤4096 byte. Deadline pembacaan JSON/multipart 30s menghasilkan 408/cancel tanpa klaim tersimpan. Multipart tetap dibatasi ukuran Fase 6. Error unexpected mempunyai requestId yang sama dengan log allowlist (tanpa payload/SQL/token/URL/stack). Abort transaksi 40P01/40001 diretry terbatas; COMMIT ambigu tidak direplay. Konflik lock persisten menghasilkan 409 TRANSACTION_BUSY. Detail dan keterbatasan ada di [hardening.md](hardening.md).
