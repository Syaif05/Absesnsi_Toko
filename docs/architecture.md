# Keputusan teknis Fase 0

Sumber kebutuhan: [PRD](./PRD_PRINCES_Attendance.md), terutama §2, §7–10, dan §20. Fase ini hanya menyiapkan fondasi. Tidak ada autentikasi, skema data, maupun absensi aktif.

## Stack dan batas fase

- Next.js App Router, React, TypeScript strict, ESLint, Tailwind CSS; paket dipin melalui `pnpm-lock.yaml`.
- PostgreSQL Supabase Free untuk development nanti, terpisah dari project lain dan data produksi. Koneksi ditunda atas arahan pemilik pada 9 November 2026. Tidak ada project atau tabel yang dibuat dalam Fase 0.
- Drizzle ORM dan migrasi SQL dimulai pada Fase 2. Tidak memasang ORM sebelum ada skema.
- Supabase Storage bucket privat dan adapter storage dimulai saat implementasi foto. Tidak ada akses Storage dari browser dengan service role key.
- Vercel Hobby hanya untuk preview/demo nonkomersial. Hosting bisnis diputuskan sebelum go-live.

## Alur target

```text
UI mobile employee / owner
  → Route Handler (auth, validasi, rate limit)
  → Service aturan bisnis
  → Repository → PostgreSQL
  → StorageProvider → bucket privat
```

Data dan secret berada di server. Endpoint memeriksa role, cakupan toko, dan kepemilikan resource. Waktu absensi berasal dari server; foto privat; koreksi mempertahankan nilai asli; approval dan koreksi diproses atomik. Detail implementasi mengikuti fase masing-masing.

## Konfigurasi

`.env.example` memuat nama variabel tanpa credential. `APP_BASE_URL` dan `APP_TIMEZONE` diverifikasi lewat `pnpm env:check`; `DATABASE_URL` opsional selama koneksi ditunda. Saat database siap, isi `.env.local` dan jalankan `pnpm db:check`. Script hanya membaca dan menguji koneksi, tidak membuat atau mengubah tabel. Secret bootstrap dan session belum dipakai oleh aplikasi.

## Keputusan yang belum final

- Project Supabase Princes development, credential dan koneksi database: ditunda atas arahan pemilik.
- Gambar referensi dashboard belum ada di workspace. Observasi visual Fase 0 berdasar uraian PRD, bukan review gambar aktual.
- Detail aturan bisnis §23 PRD tidak memblokir Fase 0–5.
