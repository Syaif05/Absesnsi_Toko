# Progres fase

## Fase 0 — Audit kebutuhan, setup, dan desain teknis

- [x] Baca PRD lengkap dan audit isi repository.
- [x] Kerangka Next.js, TypeScript strict, lint, token desain mobile, halaman status setup.
- [x] `.env.example`, pemeriksaan format ENV, dan script cek koneksi PostgreSQL.
- [x] Keputusan arsitektur, desain, dan README setup lokal.
- [ ] Database development dapat dihubungi. Ditunda atas arahan pemilik (9 November 2026).
- [ ] Review gambar referensi asli. File belum tersedia.

Pemeriksaan 9 November 2026: `pnpm lint`, `pnpm typecheck`, `pnpm env:check`, dan `pnpm build` lulus; `pnpm dev` merespons HTTP 200 pada `/`. `pnpm db:check` gagal terkontrol karena `DATABASE_URL` kosong, bukan karena error aplikasi. Tampilan setup dicek pada 320×568, 375×812, 390×844, 768×1024, dan 1440×900; `scrollWidth` sama dengan lebar viewport. Perbandingan gambar referensi belum dilakukan.

Keputusan: pakai root `AbsenToko` yang sudah berisi PRD; Git lokal dipakai untuk checkpoint, GitHub ditunda. Supabase project baru dan data disiapkan kemudian. Tidak memakai project TimSAPA yang terhubung.

Risiko: tanpa koneksi DB, acceptance Fase 0 belum lengkap. Karena gambar referensi belum ada, kemiripan visual tidak dapat dinilai. Fase 1 belum dimulai.

Pekerjaan berikutnya pada Fase 0 jika prasyarat tersedia: tempatkan gambar di `docs/reference/dashboard-reference.png`, buat project Supabase development khusus Princes, isi `.env.local`, jalankan `pnpm db:check`, lalu review hasil. Lanjut Fase 1 hanya setelah instruksi pemilik.

## Fase 1 — Design system & prototipe UI

Status: prototipe tersedia untuk review. Pemilik menginstruksikan lanjut pada 9 November 2026 dan melampirkan referensi. Koneksi database dan GitHub tetap ditunda sesuai instruksi sebelumnya.

- [x] Referensi gambar disimpan dan observasi visual diperbarui.
- [x] Login demo; beranda, jadwal, riwayat/koreksi dan profil/PIN karyawan dalam simulasi browser.
- [x] Dashboard owner, daftar absensi, persetujuan dengan konfirmasi, karyawan, toko, jadwal/template, pengaturan, laporan dan audit visual.
- [x] Editor demo, nonaktif/aktif, ubah ID, konfirmasi reset PIN; kontrol tanpa tabel horizontal.
- [x] Kondisi normal, loading, kosong, error dan denied bisa dipilih pada panel owner; pesan sukses demo.
- [x] Screenshot karyawan dan owner pada 320/375/390/768/1440 tersimpan di `docs/screenshots/`. Lebar halaman sama dengan viewport pada sepuluh pemeriksaan.
- [x] Browser mobile: tambah toko ketiga, edit ID, buka konfirmasi reset PIN, tampilkan error.
- [x] Lint, typecheck dan build lulus.

File utama: `src/components/attendance-demo.tsx`, `demo-data.ts`, `ui.tsx`, `src/app/page.tsx`, `globals.css`, gambar referensi dan screenshot, README serta catatan desain/progres.

Batasan: semua data fiktif; form adalah simulasi, bukan validasi/penyimpanan bisnis. Kamera/GPS, autentikasi, PIN nyata, upload foto, audit permanen dan database belum aktif. Tanggal dan data grafik tetap untuk demo; tombol hari pada jadwal memberi pratinjau pilihan, belum memfilter kalender riil. Belum diuji pada perangkat fisik Android/iPhone, jaringan lemah, atau pembaca layar. Screenshot adalah pemeriksaan browser, bukan klaim pixel-perfect.

Cara review: `pnpm dev`, buka localhost:3000, gunakan pemilih tampilan demo di atas dan Menu pada HP. Pada owner, buka Karyawan/Toko/Jadwal untuk mencoba editor; gunakan pemilih kondisi UI untuk loading/empty/error/denied. Refresh mereset perubahan. Fase berikutnya menunggu instruksi pemilik; tidak ada migrasi yang dijalankan.

## Fase 2 — Skema, migrasi, repository

- [x] 14 tabel PostgreSQL privat, UUID/FK, timestamps UTC, constraints dan indeks inti.
- [x] Migrasi Drizzle versioned dari database kosong; exclusion constraint jadwal published dan snapshot aturan.
- [x] Repository dengan filter business; edit ID mempertahankan UUID dan histori.
- [x] Seed development guarded dan idempotent: 2 toko, 8 karyawan, 1 profil Owner Reza DEMO nonaktif tanpa kredensial, 2 template, 8 jadwal, 3 sesi dan 6 event contoh tanpa foto nyata.
- [x] Delapan tes integrasi PostgreSQL in-memory lulus; lint/typecheck/build lulus.
- [x] ERD dan petunjuk migrasi/seed di `docs/database.md`.
- [ ] Supabase cloud: pemilik memilih melewati pembuatan project. Tidak mengubah TimSAPA.

UI tetap prototipe Fase 1. PGlite dipakai untuk tes, bukan mengganti database aplikasi. Akun owner yang bisa login/bootstrap belum dibuat karena termasuk Fase 3. Pengujian role Supabase, koneksi aplikasi cloud, dan concurrency multikoneksi belum dilakukan. Tidak ada migrasi destruktif atau kredensial yang ditambahkan ke Git.

GitHub: origin disetel ke https://github.com/ownerreza/absensi_kita.git. Push ditolak HTTP 403 pada 9 November 2026. Git CLI dan konektor menggunakan Syaif05; metadata repository menyatakan `push=false`. Pemilik perlu memberikan akses Write atau masuk menggunakan akun dengan izin menulis sebelum push dapat diulang. Remote belum menerima source code.

## Fase 3 — Auth, bootstrap dan RBAC

Implementasi lokal selesai; integrasi database cloud ditunda sesuai instruksi pemilik.

- [x] Owner bootstrap CLI sekali per bisnis; Owner Reza default, password kuat dengan Argon2id.
- [x] Login employee ID+PIN, wajib ganti PIN sementara, change/reset PIN, logout/revoke, guard owner dan ownership/business.
- [x] Cookie HttpOnly/SameSite, Secure saat production, hash token di server, validasi akun aktif pada setiap akses, CSRF Origin dan validasi Zod.
- [x] Rate limit persisten, pembatasan PIN reset/change, audit tanpa credential.
- [x] Migrasi 0002 dan file SQL gabungan `supabase/sql/001_schema_all.sql` untuk database kosong; seluruh source migrasi di `drizzle/`.
- [x] Halaman login dan akun; kondisi tanpa database menampilkan 503, bukan sukses demo.
- [x] 20 tes integrasi/unit HTTP lulus; lint, typecheck dan build diperiksa. Screenshot login karyawan/owner lima viewport tanpa overflow di `docs/screenshots/auth-*`.

Batasan: login cloud dan browser sampai akun aktif belum diuji karena database ditunda. MFA belum tersedia. UI utama `/` tetap prototipe; CRUD terhubung dilakukan Fase 4. Tidak ada push GitHub atau perubahan Supabase. Detail operasi dan risiko di `docs/authentication.md`. Fase berikutnya menunggu instruksi pengguna.

## Fase 4 — CRUD toko, karyawan dan pengaturan owner

Implementasi lokal selesai; Supabase cloud/GitHub tetap ditunda.

- [x] API dan UI owner untuk tambah/edit/nonaktif/aktif toko dan karyawan; filter dan pagination.
- [x] ID login unik, UUID/histori tetap, PIN awal sekali tampil, reset PIN memakai service Fase 3.
- [x] Perubahan ID/status mencabut sesi; employee dan resource lintas bisnis ditolak server.
- [x] Assignment toko bersejarah; pengaturan bisnis whitelist, versi dan audit sebelum/sesudah atomik.
- [x] Migrasi 0003 dan file SQL gabungan Supabase diperbarui; data historis tidak dihapus.
- [x] 36 tes PostgreSQL/API/UI DOM lulus; lint/typecheck/build dijalankan pada checkpoint.
- [x] Screenshot tiga halaman owner pada 320/375/390/768/1440, seluruhnya tanpa overflow. Form daftar/aksi tidak memerlukan tabel horizontal.

Browser awal membuktikan login, tambah toko ketiga dengan reload, tambah karyawan dan ubah ID. Dialog native browser macet dan diganti dialog aplikasi; regresi konfirmasi diselesaikan dengan tes UI DOM yang memakai API/database asli. Snapshot final memakai sesi fixture tes. Pengujian interaktif penuh pada browser dengan dialog terbaru belum diulang; perangkat fisik dan Supabase cloud belum diuji. Detail bukti, sumber file dan prosedur preview ada di `docs/owner-management.md`.

Perbaikan setup: CLI bootstrap/migrasi/seed dipindah ke .mts agar top-level await berjalan melalui tsx. Perintah pnpm tidak berubah. Tidak ada push GitHub atau mutasi Supabase. Fase 5 belum dimulai.

## Integrasi Supabase — 9 November 2026

Project `absensi kita` (ref `zeegtujueffpmrymnoxu`) terverifikasi ACTIVE_HEALTHY melalui plugin. Schema Fase 2–4 diterapkan pada database yang sebelumnya kosong; 17 tabel dengan RLS aktif, 5 entri jurnal Drizzle, satu bisnis Absensi Kita, tanpa employee/demo/PIN. Database diuji lewat SQL connector; akses schema untuk anon ditolak.

Migrasi tambahan `0004_supabase_security.sql` memindahkan btree_gist ke schema extensions dan mencabut izin Data API untuk fungsi event trigger bawaan rls_auto_enable. Advisor setelah perubahan tidak memiliki WARN/ERROR, hanya INFO RLS tanpa policy yang memang disengaja untuk schema privat/server-only.

Runtime website belum terhubung: DATABASE_URL yang dimasukkan masih URL API HTTPS, bukan PostgreSQL URI. SUPABASE_URL dan UUID bisnis telah disiapkan di .env.local (diabaikan Git). Dibutuhkan URI dari Connect → Session pooler sebelum uji node-postgres/bootstrap owner. Belum ada akun owner yang bisa login; password bootstrap tidak dibuat otomatis. GitHub tidak disentuh.

## Fase 5 — Shift dan jadwal fleksibel

- [x] Template shift (buat/edit/nonaktif/aktif) dan editor tanggal/jam, termasuk 20.00–05.00.
- [x] Kalender mingguan owner, filter toko/karyawan/status, pagination, penugasan lintas toko tanpa mengubah toko asal.
- [x] Draft/publish/cancel dengan konfirmasi, version check, audit dan constraint anti-overlap PostgreSQL.
- [x] Snapshot aturan/template/zona; konfirmasi perubahan setelah ada absensi, bukti asli dan histori tetap ada.
- [x] Jadwal terbit karyawan sendiri dengan otorisasi server dan navigasi dari akun.
- [x] Migrasi 0005, SQL gabungan, serta penerapan cloud ke absensi kita terverifikasi (6 jurnal migrasi, tanpa seed jadwal/template).
- [x] 51 tes PostgreSQL/API/UI, lint/typecheck/build diperiksa pada checkpoint.
- [x] Browser HP berhasil tambah draft, publish, reload, cancel dan edit template. Screenshot karyawan/owner/template lima viewport; editor tiga HP; tanpa overflow.

Risiko/batas: native PostgreSQL concurrency multi-koneksi dan perangkat fisik belum diuji. Runtime lokal menuju direct hostname Supabase gagal DNS walaupun URI kini PostgreSQL dan project cocok; plugin dapat mengakses cloud. Owner operasional belum dibootstrap karena credential bootstrap kosong. Tidak ada push GitHub, data demo cloud, atau fitur Fase 6. Panduan dan file utama di `docs/scheduling.md`.

## Fase 6 — Selfie & GPS (10 November 2026)

Implementasi selesai untuk pemeriksaan kode/backend. Checkpoint penerimaan browser/perangkat sengaja ditunda sesuai instruksi pengguna agar tidak melakukan pengujian UI/UX. Tidak melanjutkan Fase 7.

- [x] `/attendance`: kamera langsung, permission/error, preview/retake, kompresi JPEG, GPS/akurasi/retry, alasan pengecualian, hasil tercatat/pending dan riwayat sendiri.
- [x] API check-in/out, waktu PostgreSQL, Haversine/snapshot toko jadwal, toleransi terlambat, checkout saat check-in pending, missingCheckout tanpa waktu otomatis.
- [x] Validasi MIME/signature/dimensi/decode/ukuran dan re-encode EXIF, metadata strict, CSRF, sesi aktif/ownership/business dan rate limit.
- [x] Jurnal durable dua transaksi, idempotency/hash payload, lock anti-duplikasi, cleanup orphan setelah 24 jam, event/sesi/approval/audit atomik.
- [x] StorageProvider + adapter Supabase privat, foto hanya signed URL 60 detik lewat otorisasi server.
- [x] Migrasi 0006 dan SQL gabungan untuk database kosong: 18 tabel RLS, unique sesi per jadwal dan indeks riwayat/rate limit/cleanup. SQL bucket opsional terpisah.
- [x] Bucket attendance-photos cloud dibuat privat dengan JPEG saja dan batas 512 KiB. Verifikasi nyata memakai gambar sintetis: upload berhasil, signed URL berhasil dibaca, akses public ditolak, objek uji langsung dihapus. Tidak membuat akun, jadwal, data demo absensi atau foto orang di cloud.
- [x] `pnpm test:server`: **66 tes backend lulus** (5 file). `pnpm lint`, `pnpm typecheck`, `pnpm build` lulus. Tidak menjalankan `pnpm test` karena mencakup tests/ui.
- [ ] Migrasi 0006 cloud: belum diterapkan. Plugin Supabase gagal transport; direct PostgreSQL URI gagal DNS ENOTFOUND. Cloud terakhir terverifikasi sampai 0005. Bucket Storage dapat diakses terpisah melalui API.
- [ ] Browser/mobile/perangkat nyata, screenshot, UI DOM dan UI/UX: sengaja tidak diuji atas instruksi pengguna. Native PostgreSQL multikoneksi juga belum diuji.

File utama: src/components/attendance-panel.tsx, src/app/attendance/page.tsx, src/app/api/v1/attendance dan me/attendance, src/server/attendance, src/server/storage, drizzle/0006_attendance_uploads.sql, supabase/sql, scripts storage setup/check/reconcile, tests/integration/attendance.test.ts, dan docs/attendance.md. Navigasi akun/jadwal dan CSS diperbarui; sharp dipasang langsung dan lockfile diperbarui.

Cara menjalankan setelah DATABASE_URL dapat dijangkau: `pnpm db:migrate`, `pnpm storage:setup`, `pnpm dev`, login akun yang sah lalu buka `/attendance`. Owner operasional masih perlu bootstrap dengan kredensial pemilik; lakukan konfigurasi toko/karyawan/publish jadwal melalui owner. `pnpm storage:reconcile` dijalankan operator harian untuk upload gagal; bukan penghapusan bukti sah. Panduan penuh di docs/attendance.md.

Batas: retensi/penghapusan otomatis bukti sah belum dioperasionalkan, harus disepakati sebelum pilot. Kamera/GPS bukan verifikasi biometrik/anti-spoof. Upload menahan lock transaksi dengan timeout Storage terbatas; pemisahan lewat lease dapat dievaluasi ketika beban meningkat. GitHub tidak dipush; keputusan approval/koreksi tetap fase berikutnya.

## Fase 7 — Persetujuan & koreksi (10 November 2026)

Implementasi kode/backend selesai; pengujian UI/UX tetap ditunda sesuai instruksi pengguna. Fase 8 tidak dimulai.

- [x] Inbox owner `/owner/approvals`, filter status/jenis dan pagination; employee `/my-approvals` dengan daftar/status milik sendiri, detail dan formulir koreksi jadwal.
- [x] Detail waktu resmi vs bukti asli, selfie privat terotorisasi, GPS/akurasi/jarak, aturan jadwal, nilai sebelum/diminta/diterapkan, reviewer/catatan/waktu keputusan.
- [x] Approve/reject dengan konfirmasi dan catatan wajib; server owner/business guard, CSRF, validasi, rate limit persisten, lock berurutan dan keputusan final sekali saja.
- [x] Koreksi jam masuk/pulang, missing check-in/out dan shift lintas tanggal; request key/hash, satu koreksi pending per jadwal, baseline/versi stale ditolak. Sebelum approval waktu resmi tidak berubah.
- [x] Catatan efektif sesi, is_corrected/snapshot, event/foto/GPS asli immutable, correction history dan audit before/after; tidak membuat bukti kamera fiktif. Checkout normal tetap dapat mengikuti approved missing check-in.
- [x] Status needs_review/corrected/completed/open konsisten: koreksi waktu tidak menghilangkan review lokasi. Kegagalan audit me-rollback keputusan dan perubahan absensi.
- [x] Migrasi 0007 dan SQL gabungan fresh database mencakup seluruh skema Fase 7; tetap 18 tabel RLS. Snapshot lama di-backfill, tanpa menghapus histori.
- [x] **92 tes backend lulus** (66 regresi + 26 baru), lint, TypeScript, dan build produksi diperiksa. Tes meliputi approve/reject, dua owner mencoba memutuskan, rollback, immutability, missing events, stale baseline/jadwal, timezone, CSRF/konfirmasi, rate limit dan ownership/business.
- [ ] Migrasi cloud 0006–0007: belum diterapkan. Direct DATABASE_URL masih gagal DNS ENOTFOUND; plugin Supabase gagal transport. Cloud terakhir terverifikasi sampai 0005; bucket privat Fase 6 tidak diubah.
- [ ] UI DOM, browser, screenshot, perangkat nyata dan UI/UX: sengaja tidak dijalankan. Native PostgreSQL multikoneksi belum diuji; tes paralel PGlite membuktikan hasil adapter tes, bukan stress test server multi-koneksi.

File utama: src/server/approvals (service/validation/http/models), src/components/approvals-panel.tsx, halaman owner/approvals dan my-approvals, routes API approvals dan me/correction-targets, src/server/attendance/state.ts, perubahan auth locking dan integrasi absensi, drizzle/0007_approval_corrections.sql, supabase/sql/001_schema_all.sql, tests/integration/approvals.test.ts, docs/approvals.md. Navigasi owner/employee dan CSS diperbarui.

Menjalankan: setelah koneksi PostgreSQL dapat dijangkau, `pnpm db:migrate`, `pnpm dev`; login owner ke `/owner/approvals` atau employee ke `/my-approvals`. Akun owner operasional masih perlu bootstrap sesuai panduan auth. Dokumen approvals.md memuat kontrak, aturan status, concurrency dan batas verifikasi. GitHub tidak dipush; tidak ada seed atau data employee cloud yang dibuat.

## Fase 8 — Monitoring & laporan dasar (10 November 2026)

Implementasi kode/backend selesai. Penerimaan mobile/laptop tetap ditunda karena pengguna meminta tidak melakukan pengujian UI/UX. Tidak memulai Fase 9.

- [x] Owner `/owner/dashboard`: KPI sah/menunggu/ditolak/belum tercatat/belum dimulai, penanda terlambat/missing checkout, jumlah pending request, rekap harian, status toko dan aktivitas terbaru.
- [x] `/owner/reports`: filter tanggal/toko, filter kategori pada riwayat, ringkasan karyawan, detail sesi/waktu efektif vs bukti asli, selfie terotorisasi, GPS/aturan snapshot dan histori keputusan/koreksi.
- [x] Hitung satu row per jadwal sebelum agregasi, bukan join raw event/approval. Dua event satu sesi tidak menggandakan KPI; kategori disjoint. Pending koreksi terpisah dari status absensi resmi; jumlah employee adalah UUID unik.
- [x] Tanggal mulai shift snapshot menjaga histori saat jadwal diedit; shift malam dihitung sekali pada tanggal mulai. Aktivitas memakai tanggal kejadian sebenarnya. Scope toko berdasarkan penugasan shift, termasuk lintas toko, cancelled dengan histori serta employee/toko nonaktif.
- [x] Pagination 20 pada riwayat, cabang, aktivitas dan histori permintaan; pencarian/pagination opsi toko tanpa angka tetap dua toko. Refresh 60 detik saat tab terlihat/online/halaman pertama, tanpa request siklus tumpang tindih, abort ketika filter berubah; error/offline tidak berubah menjadi data contoh atau sukses palsu.
- [x] API read-only, guard owner/business/ownership, response no-store tanpa credential/photo_path; employee hanya boleh detail sesi sendiri. Parallel fetch, agregasi SQL, statement timeout, indeks baru 0008, SQL gabungan diperbarui; 18 tabel RLS tetap.
- [x] **113 tes backend lulus** (92 regresi + 21 reporting), lint, TypeScript dan build diperiksa. Kasus dua/tiga toko, >20 toko, pagination/tie timestamps, pending/ditolak vs sah, missing/corrected, timezone/shift malam, histori immutable dan permission tercakup.
- [ ] Migrasi cloud 0006–0008 belum diterapkan: pemeriksaan direct PostgreSQL Fase 8 masih ENOTFOUND. Konektor terakhir gagal transport pada Fase 7. Cloud terakhir terverifikasi sampai 0005; bucket foto tidak diubah.
- [ ] Tidak menjalankan tests/ui, browser, screenshot, viewport/perangkat, atau UI/UX sesuai arahan pengguna. Polling/responsivitas belum diuji runtime browser; benchmark volume besar dan native PostgreSQL multikoneksi juga belum dilakukan.

File utama: src/server/reporting (service/query/validation/http/models/page), src/components/reporting-panel.tsx, halaman owner/dashboard dan owner/reports, routes API dashboard/attendance/employee attendance, schema/index migration 0008 dan SQL gabungan, tests/integration/reporting.test.ts, docs/reporting.md. Navigasi akun/pengelolaan dan CSS diperbarui. Tidak ada data demo di halaman nyata, tidak ada seed atau foto/karyawan cloud baru, tidak ada push GitHub.

Menjalankan setelah DATABASE_URL dapat dijangkau: `pnpm db:migrate`, `pnpm dev`; login owner lalu buka `/owner/dashboard` dan `/owner/reports`. Bootstrap owner operasional masih mengikuti panduan auth. Definisi angka, tanggal akhir API eksklusif vs UI inklusif, prioritas kategori, pagination dan batas verifikasi dijelaskan di docs/reporting.md. Pagination offset dapat bergeser bila aktivitas baru masuk antar-request; evaluasi cursor/performa pada hardening berikutnya.

## Fase 9 — Hardening dan checkpoint penerimaan (10 November 2026)

Implementasi backend/hardening selesai untuk checkpoint, **bukan persetujuan go-live**. Sesuai arahan pengguna, tidak menjalankan pengujian UI/UX/browser/perangkat. Fase 10 tidak dimulai.

- [x] Validasi konfigurasi runtime, produksi HTTPS, URI PostgreSQL, TLS remote terverifikasi/CA opsional; ENV checker tidak menampilkan nilai secret.
- [x] Batas pool/query/lock/idle, handler error idle, rollback/release aman, retry maksimal tiga untuk abort 40P01/40001; COMMIT ambigu tidak direplay. Pengujian native multikoneksi tetap belum dilakukan.
- [x] Migrasi 0009 untuk business/schedule/session/event scope dan identitas historis; 18 tabel RLS tetap, tidak menghapus/mengganti data. SQL gabungan diperbarui; source fixture lintas bisnis diperbaiki agar tidak membuat jadwal invalid.
- [x] JSON MIME/UTF-8/ukuran/deadline diperketat, multipart memakai batas streaming, JPEG maksimal 4 megapixel untuk membatasi decode. Pengiriman gagal tidak dinyatakan berhasil.
- [x] Password owner dapat diganti dengan current password, throttling, hash Argon2id, audit dan revoke seluruh sesi/cookie. Login sah mereset budget kegagalan akun, global limit tetap aktif.
- [x] Header keamanan, cookie tetap HttpOnly/Secure produksi/SameSite, no X-Powered-By, log unexpected allowlist dengan request ID yang sama pada error; tanpa SQL/payload/token/credential.
- [x] Error boundary/404, fokus keyboard dan reduced motion ditambahkan sebagai baseline kode; bukan bukti kelulusan UI/a11y.
- [x] Backup create/verify/extract terenkripsi AES-256-GCM, manifest/checksum/path validation/no overwrite, pg_dump dan daftar foto memakai snapshot DB yang sama. Restore drill **lokal PGlite** memulihkan foto/referensinya, FK, RLS dan audit immutable ke database baru. Format tes dibedakan dari native pg_dump.
- [x] **131 tes backend, 10 file lulus** (113 regresi + 18 hardening/auth/backup/journey). API journey meliputi owner setup tiga toko, employee/ganti PIN, jadwal, selfie/GPS/duplikasi, checkout pending, approve/koreksi, laporan, reset PIN/logout. Lint, TypeScript, build dan env:check lulus.
- [x] Audit dependency production: info/low/moderate/high/critical 0 saat pemeriksaan. Scanner artefak browser tidak menemukan nilai secret ENV yang dikonfigurasi. Smoke HTTP API pada server sementara memverifikasi 503 terstruktur/no-store dan header keamanan; tidak membuka browser/halaman UI dan tidak menganggap DB terhubung. Server dihentikan.
- [ ] Cloud: direct PostgreSQL masih ENOTFOUND, get_project plugin gagal transport pada Fase 9; migrasi 0006–0009 dan advisor terbaru belum dijalankan. Cloud terakhir terverifikasi sampai 0005, bucket privat tidak diubah. Akun owner operasional belum bootstrap.
- [ ] Native pg_dump/pg_restore + restore Supabase drill, upload ulang foto, native concurrency/performance, RPO/RTO, salinan kedua, jadwal/retensi backup: belum diverifikasi/disepakati. Binary pg_dump/pg_restore tidak tersedia di PATH. Tes PGlite bukan pengganti tes pemulihan operasional.
- [ ] UI DOM, Playwright, screenshot, viewport/perangkat, PWA/offline/install, Lighthouse/Web Vitals dan aksesibilitas runtime tetap belum diuji sesuai instruksi pengguna. MFA aplikasi dan kebijakan privasi/retensi sah juga belum siap/disepakati. Semua dicatat sebagai blocker sebelum pilot.

File utama: src/server/security (config/pool/body/headers/observability), auth/database/service/http/runtime, logging pada HTTP handlers, src/server/ops encryption/archive, scripts backup/check/env/database, migration 0009 + SQL gabungan, account password form/error/404/CSS, tests hardening/backup/api-journey/auth. Panduan docs/hardening.md, docs/backup-restore.md dan docs/privacy-draft.md memisahkan bukti uji dari bagian yang tertunda. CLI administratif memakai node --import tsx untuk menghindari kebutuhan IPC CLI di sandbox; nama perintah pnpm tetap.

Menjalankan: isi .env.local privat, `pnpm env:check`, `pnpm dev`; password owner melalui `/account`. Setelah PostgreSQL pulih, `pnpm db:migrate` incremental hingga 0009 dan verifikasi advisor/acceptance yang tertunda. Build lalu typecheck berurutan; `pnpm security:client` setelah build. Tidak membuat data karyawan/foto cloud, tidak restore ke produksi, tidak deploy/push GitHub.


## Fase 10 — Paket deployment, handover dan persiapan pilot (10 November 2026)

Status: **persiapan kode/dokumentasi selesai untuk checkpoint lokal; deployment dan acceptance pilot belum selesai**. Pemilik meminta lanjut Fase 10; penundaan UI/UX tetap berlaku. Tidak memulai Fase 11.

- [x] Root menuju login; prototipe dipisah ke `/demo` khusus development dan tidak dapat dirender pada NODE_ENV production. Login hanya menampilkan tautan demo bila server mengizinkan.
- [x] Build standalone portable dengan static/public, pembuangan salinan ENV turunan dan pemindaian nilai secret aktif; 2.243 entri artefak diperiksa tanpa `.env*`. Import sharp/Argon2 pada artefak macOS lulus, bukan bukti binary Linux.
- [x] Docker multi-stage Node 24/web non-root dan ops PostgreSQL client 17; Compose dengan web internal, Caddy HTTPS, volume sertifikat/backup dan log terbatas; ENV produksi template kosong, dockerignore/vercelignore secrets/backup.
- [x] Preflight readonly: konfigurasi HTTPS/production, demo seed mati, bootstrap secret dibuang; 18 tabel RLS, jurnal hash/urutan migrasi, trigger/index, schema privat, fungsi, business/owner dan scope sesi/foto; metadata bucket privat/JPEG/512 KiB. technicalReady dibedakan dari operationalAcceptance NOT_VERIFIED.
- [x] Liveness JSON publik tanpa credential/infrastruktur; smoke CLI HTTPS hanya endpoint JSON anonim dan header keamanan. Liveness tidak menjadi jaminan DB/Storage siap.
- [x] Runbook instalasi kosong/bootstrap/secret/HTTPS/backup/monitoring/rollback/handover, panduan owner/employee dan checklist pilot satu toko lalu toko kedua. Tidak mengisi data nyata lewat SQL/seed.
- [x] `pnpm test:server`: **136 tes backend, 11 file lulus** (131 sebelumnya + 5 release). Preflight diuji pada SQL bundle kosong, bootstrap owner fiktif, transaksi readonly; exposure PUBLIC/RLS nonaktif/data demo/hash migrasi salah ditolak. Bucket unsafe dan policy demo production ditolak.
- [x] `pnpm release:build`, `pnpm typecheck`, `pnpm lint`, `pnpm security:client`, `git diff --check` lulus. Review kode TSX mengikuti React Best Practices; tidak menjalankan tes UI.
- [x] Smoke standalone lokal hanya GET JSON: liveness 200/no-store/header sah, endpoint terlindungi 503 dengan DB fixture tidak tersedia (fail-safe, bukan kelulusan smoke produksi). Server dihentikan; tidak ada browser/perangkat/halaman UI dibuka.
- [x] Preflight terhadap ENV development secara sengaja gagal production_config/production_mode; metadata bucket existing tetap privat, limit 512 KiB/JPEG lulus. Tidak mengubah cloud. `pnpm db:check` tetap ENOTFOUND.
- [ ] Hosting/domain produksi dan project baru milik penerima belum terkonfirmasi; klarifikasi target sudah diminta. Tidak membeli resource, memilih plan berbayar, deploy publik atau push GitHub.
- [ ] Supabase get_project dan Vercel list_teams gagal transport; pemilik akun/plan/target belum dapat diverifikasi. Cloud terakhir sampai 0005, migrasi 0006–0009 belum diterapkan; bootstrap owner operasional belum dibuat.
- [ ] Docker, pg_dump, pg_restore dan vercel CLI tidak tersedia lokal. Dockerfile/Compose belum dieksekusi; native restore, scheduler backup/salinan kedua dan monitoring/alarm belum dipasang/diverifikasi.
- [ ] Data nyata owner, domain/HTTPS nyata, kamera/GPS perangkat, UI/UX, native concurrency, kapasitas, kebijakan privasi/retensi/RPO/RTO dan pilot kedua toko belum diterima. Checklist pilot seluruhnya terbuka; build/test backend bukan persetujuan operasional.

File berubah: next.config.ts/package.json; root/login/auth-panel dan route demo; API health; src/server/release; scripts build-standalone/release-check/release-smoke; Dockerfile/.dockerignore/.vercelignore/deploy; tests/integration/release.test.ts; README dan docs deployment-handover/user-guide/pilot-checklist/phase-progress. Tidak ada migrasi baru atau perubahan `.env.local`.

Cara menjalankan lokal: `pnpm dev` untuk pengembangan; `pnpm release:build` untuk paket, suntikkan ENV runtime lalu `pnpm start:standalone` di belakang HTTPS reverse proxy. Ikuti docs/deployment-handover.md setelah target diverifikasi. Tag kandidat `v0.1.0-rc.1` menandai paket lokal, bukan final release/go-live. Menutup Fase 10 memerlukan deployment aktual, native restore dan pilot/perangkat ketika penundaan UI dicabut.

### Pembaruan Fase 10 — publikasi yang diizinkan pemilik

Pada 10 November 2026, pemilik meminta push ke Syaif05/Absesnsi_Toko dan hosting Vercel, lalu mengizinkan DATABASE_URL/SUPABASE_SERVICE_ROLE_KEY dan SESSION_SECRET baru disimpan sebagai Secret server Vercel. Main dan tag kandidat dipush; project Vercel absesnsi-toko dibuat/ditautkan, Node 24, ENV production terpisah, alias HTTPS tersedia. Setelah pemilik memberikan host pooler, koneksi TLS verified berhasil memakai CA publik resmi Supabase. `.env.local` privat diperbaiki; migrasi canonical cloud naik dari enam menjadi sepuluh melalui migrator, tanpa seed/reset atau data nyata.

Smoke JSON API publik lulus (liveness 200, me/context 401). Preflight 17/18 pemeriksaan lulus, hanya owner awal belum bootstrap; technicalReady tetap false. Advisor security/performance hanya INFO, schema attendance tetap privat. Catatan lengkap/URL/status dan batasan: docs/deployment-status.md. Blocker DNS/push/hosting pada checkpoint awal Fase 10 kini teratasi; owner, native backup/restore, ketentuan hosting komersial, UI/perangkat dan pilot tetap terbuka. Tidak membuat akun/password default atau memulai Fase 11.

### Revisi bertahap setelah Fase 10 — login dan PIN opsional

Instruksi pengguna 10 November 2026: gunakan referensi login baru yang minimal untuk HP, ikon mata serta animasi sukses/gagal; ganti PIN/password menjadi pilihan di menu setelah masuk. Ketentuan ini menggantikan kewajiban PIN awal pada PRD. Implementasi terbatas pada login, menu akun dan aturan akses PIN terkait.

Login kini memakai form flat satu kolom, pemilih akun pill, tombol hitam, input besar, tombol lihat/sembunyikan dan feedback dialog native dengan reduced motion. Sukses menuju dashboard owner/absensi karyawan melalui Lanjutkan. Form perubahan credential tertutup/opsional di Akun. Server menggunakan pinChangeSuggested informasional, tanpa guard/redirect wajib PIN; initial/reset PIN dapat mengakses sumber daya sendiri. Tidak ada migrasi atau penggantian credential. Account/role/status/business/revocation/CSRF/rate limit tetap diuji.

136 tes backend/11 file lulus; build lulus. Typecheck/lint/scanner browser diperiksa sebelum checkpoint. UI/UX/DOM/screenshot/perangkat **tetap tidak diuji** sesuai penundaan. Perubahan/file inti dan batas verifikasi ada pada docs/login-revision.md. Tidak memulai fitur lain atau Fase 11.

### Revisi bertahap — menu karyawan

Menu karyawan disederhanakan mengikuti login baru dan referensi: EmployeeShell, navigasi bawah Absensi/Jadwal/Riwayat/Pengaturan, kartu putih, latar terang, CTA kamera biru serta tombol hitam. Aksi masuk/pulang ditentukan sesi server, bukan toggle bebas. Riwayat memiliki route /my-history yang tetap dijaga auth, foto privat dan pagination. Jadwal, koreksi employee dan akun memakai shell konsisten; layout owner tetap. Tidak mengubah DB, credential, aturan GPS/selfie/idempotency atau menambah data contoh.

136 tes backend/11 file, lint dan build lulus; typecheck/scanner browser diperiksa sebelum commit. Tidak menjalankan tes UI/UX/DOM/viewport/perangkat sesuai instruksi pengguna. Detail komponen, URL, state dan batas verifikasi di docs/employee-menu-revision.md.
