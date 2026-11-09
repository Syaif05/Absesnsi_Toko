# PRINCES Attendance

Fondasi Fase 0 untuk aplikasi kehadiran Princes. Halaman yang berjalan sekarang hanya menunjukkan status setup. Login, dashboard, dan absensi belum diimplementasikan.

## Menjalankan lokal

Prasyarat: Node.js 20.9+ dan pnpm 12.14.0. Dari root proyek:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm env:check
pnpm dev
```

Buka `http://localhost:3000`. Untuk pemeriksaan kode: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Database development nanti

Gunakan project Supabase Free khusus Princes, bukan project produk lain. Salin connection string PostgreSQL dari tombol **Connect** di dashboard Supabase ke `DATABASE_URL` dalam `.env.local`, lalu jalankan `pnpm db:check`. Untuk aplikasi serverless, Supabase merekomendasikan transaction pooler; untuk migrasi, direct connection bila jaringan mendukung IPv6 atau session pooler bila perlu IPv4. Jangan commit `.env.local` atau membagikan password lewat chat/log. Belum ada migrasi atau seed pada Fase 0.

## Dokumen

- [PRD lengkap](docs/PRD_PRINCES_Attendance.md)
- [Keputusan arsitektur](docs/architecture.md)
- [Fondasi desain](docs/design-system.md)
- [Checkpoint fase](docs/phase-progress.md)

Vercel Hobby hanya untuk preview dan demo nonkomersial. Hosting operasional bisnis diputuskan sebelum go-live.

## Review prototipe Fase 1

Buka halaman utama lalu pilih **Tampilan owner**, **Tampilan karyawan**, atau **Login demo** pada bar atas. Pada HP, halaman administrasi tersedia melalui **Menu** di navigasi bawah. Form dan keputusan hanya mengubah sesi browser; refresh mengembalikan data contoh. Jangan masukkan PIN atau data karyawan nyata.

Screenshot lima viewport untuk kedua peran tersedia di `docs/screenshots/`. Reference pemilik tersedia di `docs/reference/dashboard-reference.png`.

## Database Fase 2

Skema dan migrasi PostgreSQL sudah tersedia. Jalankan `pnpm test` untuk pengujian database terisolasi tanpa cloud. Petunjuk koneksi, migrasi, seed terkontrol dan ERD tersedia di [docs/database.md](docs/database.md). Supabase belum dibuat sesuai pilihan pemilik; UI masih menggunakan data prototipe Fase 1.

## Autentikasi Fase 3 dan SQL Supabase

Halaman akun tersedia di `/login` dan `/account`. Tanpa database yang dikonfigurasi, login menampilkan layanan belum tersedia. Petunjuk bootstrap owner, konfigurasi dan batas pengujian ada di [docs/authentication.md](docs/authentication.md).

Semua SQL database sampai Fase 4 tersedia di [supabase/sql/001_schema_all.sql](supabase/sql/001_schema_all.sql), dengan [petunjuk instalasi](supabase/README.md). File ini hanya untuk database kosong; database yang sudah terpasang diperbarui lewat `pnpm db:migrate`. Regenerasi dengan `pnpm db:export:supabase`.

## Administrasi owner Fase 4

Masuk melalui `/login`, buka `/account`, lalu **Buka pengelolaan usaha**. `/owner` mengelola toko, karyawan, ID login, PIN, penugasan dan pengaturan lewat API/database. Panduan lengkap serta batas verifikasi ada di [docs/owner-management.md](docs/owner-management.md).

Untuk review tanpa cloud, gunakan preview PostgreSQL tes sementara: `RUN_ISOLATED_PREVIEW=true PREVIEW_OWNER_PASSWORD='password-khusus-tes-lokal' pnpm qa:owner`. Buka `http://127.0.0.1:3001/login`, ID `preview-owner`; data hilang ketika server dihentikan. Ini fixture QA, bukan fallback database aplikasi.
