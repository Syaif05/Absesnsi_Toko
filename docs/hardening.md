# Fase 9 — Hardening dan checkpoint penerimaan

Status: implementasi hardening/backend selesai untuk checkpoint; **bukan persetujuan go-live**. Pengujian UI/UX/browser/perangkat tetap ditunda atas instruksi pengguna. Daftar blocker di bawah tidak diberi status lulus.

## Temuan dan perubahan

| Area | Perubahan | Bukti |
|---|---|---|
| Konfigurasi | DATABASE_URL hanya postgres/postgresql; APP_BASE_URL origin tanpa credential/path; produksi harus HTTPS; secret minimal/placeholder ditolak | hardening.test.ts, env:check |
| TLS | Koneksi remote PostgreSQL memverifikasi sertifikat/hostname, menolak disable/no-verify, dan meniadakan flag URI yang dapat menimpa TLS options. CA opsional lewat DATABASE_SSL_CA | postgresOptions tests; koneksi cloud belum berhasil |
| Transaksi | Lock timeout 5s, statement timeout runtime 15s, idle transaction 45s, idle pool error handler. Retry maksimal tiga percobaan hanya untuk 40P01/40001 (PostgreSQL sudah membatalkan transaksi); network/COMMIT ambigu tidak direplay | hardening.test.ts |
| Integritas relasi | Trigger scope workforce mencegah store/employee/template lintas bisnis, sesi/jadwal bukan milik employee, event di toko berbeda dari jadwal, dan penggantian identitas jadwal setelah ada sesi. Business identity store/template/employee tetap | migration 0009, API journey + regresi |
| Auth owner | Ganti password dengan current password + minimal 12 karakter, throttling, Argon2id, audit dan revoke seluruh sesi; cookie dihapus setelah sukses | auth.test.ts; form akun dikompilasi, UI tidak diuji |
| Throttling | Login berhasil mereset budget gagal per akun, sehingga login sah tidak mengunci diri; budget global tetap ada. Login gagal tetap dibatasi/lockout | auth.test.ts |
| Request | Content-Type JSON harus MIME tepat; batas streamed body tanpa mengandalkan content-length; UTF-8 tidak valid ditolak; deadline pembacaan 30s menghasilkan 408 dan cancel stream | hardening.test.ts; attendance regresi |
| Error/log | Request ID sama pada respons error dan log unexpected; log hanya level/scope/requestId/code dari allowlist, tanpa error.message, SQL, payload, token, URL atau stack sensitif | observability tests |
| Header | nosniff, DENY/frame-ancestors none, referrer no-referrer, object-src none, base/form self, COOP, izin kamera/geo hanya self, microphone off, HSTS produksi; X-Powered-By dimatikan | headers tests + build + smoke HTTP API; browser belum diuji |
| Resource foto | JPEG ≤512 KiB dibatasi 4 megapixel sebelum decode/resize; kamera normal mengirim sisi terpanjang ≤960 px. Foto kecil terkompresi dengan dimensi berlebihan ditolak | hardening.test.ts |
| Aksesibilitas/error | Fokus keyboard terlihat, reduced motion, error boundary umum dan 404 tanpa detail internal; semua aksi sensitif tetap konfirmasi server | lint/build; review runtime/a11y tertunda |
| Backup | AES-256-GCM per berkas/manifest, checksum, no overwrite, path validation, dump + foto pada snapshot DB sama, verify/extract terpisah dan folder privat | backup.test.ts; native pg_dump belum tersedia |
| Supply chain/secret | Audit production dependency; scanner artefak .next/static untuk nilai secret server dari ENV | pnpm audit --prod; security:client |

Validasi APP_BASE_URL bukan terminasi TLS: redirect HTTP ke HTTPS dan sertifikat hosting tetap wajib diverifikasi sebelum menerima credential karyawan nyata.

CSP yang ditambahkan adalah baseline framing/object/base/form; **bukan strict nonce-based script policy**. Tidak mengklaim menghilangkan seluruh risiko XSS. Tidak ada HTML arbitrary/galeri/SVG pengguna dalam alur selfie; React escaping, schema strict, JPEG decode/re-encode dan otorisasi tetap kontrol utama aplikasi saat ini.

Retry transaksi tidak mengklaim seluruh kombinasi lock native bebas deadlock. Write sensitif tetap memakai lock/constraint dan rollback atomik; 40P01 dipulihkan terbatas. Upload selfie dalam callback bersifat idempotent pada path yang sudah dijurnal. Kombinasi edit jadwal/reset PIN/approval/absensi pada PostgreSQL multi-koneksi masih perlu diuji, termasuk timeout saat upload lama. Jangan menjalankan side effect baru yang tidak idempotent (email/pembayaran) di callback transaksi yang dapat diulang.

## Pengujian yang dijalankan

- `pnpm test:server`: **131 tes, 10 file, lulus**. Baseline 113 ditambah 18 kasus hardening/auth/backup/journey.
- Journey API menggunakan Route Handler/NextRequest dengan PostgreSQL PGlite terisolasi: bootstrap owner, login, membuat 3 toko, employee/PIN sementara, wajib ganti PIN dan pencabutan sesi, jadwal lintas toko dengan tanggal penuh, selfie sintetis + GPS luar area, retry tanpa duplikasi, checkout pending, owner approve, koreksi waktu, KPI satu shift, reset PIN dan logout. Tidak ada browser, DOM atau kamera perangkat yang dipakai.
- Restore drill lokal: database baru dipulihkan dari snapshot terenkripsi, foto dan referensinya cocok, 18 tabel RLS, FK dan audit append-only tetap berlaku. Key salah, byte dirusak, path traversal dan overwrite ditolak. Format PGlite tes berbeda dari native pg_dump; lihat backup-restore.md.
- Smoke HTTP pada server produksi sementara, hanya GET `/api/v1/me` tanpa browser: API gagal aman dengan 503 (konfigurasi production/infra belum siap), error terstruktur/no-store dan seluruh header keamanan yang dicek berlaku. Tidak menganggap ini koneksi DB berhasil; server sementara dihentikan.
- Lint, TypeScript dan build produksi diperiksa. `env:check` lulus untuk format runtime tanpa menampilkan nilai secret; ini tidak berarti koneksi DB berhasil.
- `security:client` tidak menemukan nilai secret server yang saat ini dikonfigurasi pada artefak browser. Scanner hanya mencakup nilai/artefak yang tersedia, bukan bukti formal terhadap semua bentuk kebocoran.
- `pnpm audit --prod` pada checkpoint melaporkan info/low/moderate/high/critical semuanya **0**. Ini hasil saat pemeriksaan, bukan jaminan tanpa kerentanan yang belum diketahui. Tidak mengganti stack atau menambah dependency production pada Fase 9.

## Checklist §16–17 / sebelum operasional

| Area | Status checkpoint |
|---|---|
| Auth ID/PIN, bootstrap, hashing, reset/revoke, RBAC/IDOR/CSRF/throttle | Lulus tes backend; browser/login perangkat belum diuji |
| CRUD/UUID/histori, shift malam/overlap, selfie/GPS/exception/retry/failure | Lulus tes backend dengan fixture; kamera/GPS nyata belum diuji |
| Approval/koreksi atomic, keputusan ganda, original values, KPI tidak double-count | Lulus pada adapter PostgreSQL tes; native concurrency belum diuji |
| Private storage, signed read/public deny | Regresi backend lulus; live Storage pernah lulus Fase 6. Expiry/cache/revocation browser/perangkat belum diuji ulang |
| Header/TLS/error/log dan dependency/secret scan | Implementasi/check kode lulus; verifikasi deployment HTTPS/CA/hosting belum dilakukan |
| Backup crypto/restore isolated | Lulus lokal; pg_dump/pg_restore native + restore project Supabase drill belum dilakukan |
| Mobile employee → mobile owner → tablet → laptop, 320/375/390/768/1440, foto cukup jelas, keyboard/focus/kontras/screen reader | **Belum diuji**, sesuai larangan pengujian UI/UX. CSS/fallback bukan pengganti hasil pengujian |
| E2E Playwright, Android Chrome, iPhone Safari/PWA, weak network/back/reload/install, Lighthouse/Web Vitals, visual regression | **Belum dijalankan**. PWA/install/offline shell penuh belum dinyatakan siap |
| Native PostgreSQL multi-koneksi, benchmark realistis, pool/lock stress | **Belum diuji**; mock abort dan PGlite bukan pengganti |
| Owner operasional, MFA aplikasi, pemulihan akun, profil pemilik dan data asli | Bootstrap operasional belum dijalankan; MFA aplikasi belum diimplementasikan. Rotasi password sendiri tersedia; recovery operator perlu prosedur verifikasi pemilik |
| Retensi bukti/audit/backup, dasar dan pemberitahuan pemrosesan, kontak hak data, RPO/RTO/incident response | **Belum disepakati pemilik**; lihat privacy-draft.md. Cleanup 24 jam hanya orphan, bukan retensi bukti sah |
| Supabase live migration/advisor | **Terblokir**: DNS PostgreSQL ENOTFOUND dan get_project connector gagal transport. Cloud terakhir terverifikasi sampai 0005; 0006–0009 belum diterapkan; advisor terbaru belum diperiksa |
| Hosting/domain/HTTPS, akun/kunci milik pemilik, pilot dan handover | Fase 10, belum dikerjakan. Tidak deploy/push GitHub |

Tidak ada bug kritis yang diketahui dari pengujian backend saat checkpoint, tetapi daftar yang belum diuji di atas menghalangi klaim siap dipakai operasional. Pemilik perlu menyelesaikan acceptance setelah desain/izin pengujian UI berubah; jangan menganggap kelulusan build sebagai kelulusan mobile atau backup cloud.

## Menjalankan dan operasi

Isi .env.local privat (bukan nilai .env.example), lalu:

```sh
pnpm env:check
pnpm test:server
pnpm lint
pnpm build
pnpm typecheck
pnpm security:client
pnpm dev
```

Jalankan build dan typecheck **berurutan** karena Next membuat ulang .next/types. Script administratif memakai `node --import tsx` agar tidak bergantung IPC CLI tsx di sandbox; nama perintah pnpm tetap. Setelah PostgreSQL dapat dijangkau, jalankan migrasi incremental `pnpm db:migrate` (hingga 0009), periksa RLS/advisor, bootstrap owner melalui CLI, lalu lanjut acceptance yang belum dijalankan. SQL gabungan hanya untuk database baru kosong.

Backup/create/verify/extract dan langkah restore target kosong ada di [backup-restore.md](backup-restore.md). Recovery owner yang lupa password memerlukan operator berizin/verifikasi pemilik: hash baru lewat helper Argon2id, update credential dalam transaksi, revoke semua sesi, audit tanpa password; jangan membuka registrasi/ulang bootstrap publik. Rotasi ENV/session secret tidak otomatis mencabut token opaque dalam auth_sessions; revoke eksplisit diperlukan. Tidak ada endpoint yang menampilkan PIN/password lama.

Jika ada insiden, hentikan penerbitan akses terkait, revoke sesi/credential yang terdampak, pertahankan bukti/audit, korelasikan request ID ke log allowlist, dan ikuti proses penanggung jawab pemilik. Jangan menyalin selfie, cookie, service key atau dump mentah ke issue GitHub/chat/log umum.
