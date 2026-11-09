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
