# Fase 4 — Toko, karyawan, pengaturan owner

## Menggunakan fitur

Dengan database dan owner yang sudah dikonfigurasi, buka `/login`, masuk sebagai owner, lalu pilih **Buka pengelolaan usaha** dari `/account`. Halaman `/owner` memuat data server. Tiga tab dapat ditautkan langsung: `/owner?tab=stores`, `/owner?tab=employees`, `/owner?tab=settings`.

Toko: tambah/edit nama, kode unik, alamat, koordinat, radius, jam operasional dan status. Karyawan: tambah/edit nama, ID login (otomatis jika kosong), toko asal, nomor telepon opsional, tanggal bergabung dan status. Akun dibuat sebagai employee; penambahan owner tetap melalui prosedur khusus. Tidak ada registrasi publik atau penghapusan permanen. Manager bukan bagian fase ini.

Pembuatan karyawan menghasilkan PIN acak sekali tampil. Owner mencatatnya sebelum menutup panel; PIN tidak bisa diambil ulang. Reset PIN memanggil service Fase 3, selalu melalui konfirmasi, mencabut sesi dan wajib diganti pada login berikutnya. ID/status/penugasan berubah melalui dialog konfirmasi; perubahan ID dan status mencabut semua sesi karyawan. Menonaktifkan toko tidak menghapus histori atau mengeluarkan karyawan dari semua penugasan; toko nonaktif tidak dapat dipilih untuk penugasan baru.

Pengaturan: nama usaha, zona waktu Indonesia, warna aksen HEX, radius default, akurasi GPS dan toleransi terlambat. Warna diterapkan pada ruang kerja owner dengan warna teks yang mengikuti kontras. Form menolak credential infrastruktur atau key lain. Setiap simpan menaikkan versi aturan, dan versi lama/baru dicatat dalam audit; snapshot jadwal/event lama tidak diubah. Konflik versi mengharuskan muat ulang sebelum simpan.

## Struktur dan keamanan

- `src/server/owner/validation.ts`: schema whitelist Zod.
- `src/server/owner/service.ts`: CRUD, histori assignment, aturan dan audit dalam transaksi.
- `src/server/owner/http.ts`: kontrak JSON, CSRF Origin, cookie session, 400/401/403/404/409/503 dan no-store.
- `src/components/owner-panel.tsx`: daftar mobile, form, dialog, filter, pagination, loading/error/empty/success dan PIN sekali tampil.
- `src/server/auth/service.ts`: `withOwner` mengunci identitas dan memeriksa otorisasi dalam transaksi yang sama dengan mutasi; tidak hanya menyembunyikan menu.

Setiap resource terikat business UUID dari sesi, bukan businessId dari client. Target edit karyawan dibatasi role employee. Kode unik dijamin constraint PostgreSQL; kegagalan constraint mengembalikan 409 tanpa partial update/audit. Audit menyimpan sebelum/sesudah tanpa credential dan dengan nomor telepon disamarkan. Perpindahan toko menutup assignment sebelumnya dan membuat entri baru. API hanya mengubah primary assignment; editor jadwal lintas toko dan shift dibuat Fase 5.

## Migrasi dan file Supabase

`drizzle/0003_owner_management.sql` menambahkan `stores.operating_hours`, `employees.phone`, dan indeks satu assignment aktif per karyawan. Tidak ada reset/drop data. Seluruh SQL Fase 2–4 sudah diregenerasi ke `supabase/sql/001_schema_all.sql` dan diuji pada database kosong. Gunakan `pnpm db:migrate` untuk database existing; file gabungan hanya untuk database kosong. Supabase cloud dan GitHub tidak diubah.

Skrip CLI yang memakai top-level await kini memakai ekstensi `.mts` agar berjalan sebagai ESM melalui tsx; nama perintah pnpm tetap sama. `DATABASE_POOL_MAX` opsional (1–10, default 3) mengatur pool server. Preview tes memiliki build directory tersendiri yang diabaikan Git/ESLint.

## Pengujian dan batasannya

36 tes: 32 tes service/API/PostgreSQL dan 4 tes UI DOM yang benar-benar meneruskan fetch ke handler dan database tes. Meliputi toko ketiga, validasi/uniqueness, karyawan/PIN, perubahan ID dan pencabutan sesi, penolakan employee/akses lintas bisnis, soft deactivate/reactivate, histori assignment, whitelist dan versi aturan, CSRF, serta rollback bisnis saat audit gagal. Tes UI memastikan batal konfirmasi tidak mengubah data, konfirmasi menyimpan ID, reset PIN melalui service asli, dan duplikasi tetap di editor dengan pesan error.

Browser pada 375px: login owner tes, tambah toko ketiga dan reload (data tetap ada), tambah karyawan dan ubah ID berhasil. Dialog bawaan browser kemudian macet; diganti dialog aplikasi dan diuji melalui tes UI DOM. Pengujian interaktif penuh sesudah penggantian dialog belum diulang di browser. Snapshot baca-saja toko/karyawan/pengaturan diambil dari fixture terautentikasi pada 320/375/390/768/1440; 15 pemeriksaan menunjukkan scrollWidth sama dengan lebar viewport. Screenshot `docs/screenshots/owner-live-*` memakai data bertanda TES.

Fixture screenshot memasok sesi owner tes melalui gateway loopback terpisah pada port 3002, bukan endpoint Next.js. Ini tidak menjadi bukti login cloud. Service aplikasi tetap memakai node-postgres ke socket PostgreSQL tes; tidak ada fallback PGlite di runtime produksi.

Belum diuji: Supabase cloud/role runtime, concurrency multi-koneksi PostgreSQL native, Android/iPhone fisik, pembaca layar, dan alur browser penuh dengan dialog aplikasi terbaru. Halaman `/` tetap prototipe DEMO Fase 1; jadwal, absensi, dashboard monitoring dan laporan nyata menunggu fasenya.

## Preview lokal terisolasi (opsional)

Jalankan dengan password tes yang tidak digunakan pada akun asli:

```sh
RUN_ISOLATED_PREVIEW=true PREVIEW_OWNER_PASSWORD='password-khusus-tes-lokal' pnpm qa:owner
```

Buka `http://127.0.0.1:3001/login` dengan ID `preview-owner` dan password tes di atas. Untuk snapshot fixture tanpa menguji login, buka `http://127.0.0.1:3002/owner-preview?tab=stores`. Seluruh data dibuat di memori, hanya mendengarkan loopback, hilang saat Ctrl+C, dan skrip menolak NODE_ENV=production. Jangan gunakan fixture sebagai server operasional. Runtime biasa tetap `pnpm dev` dan memerlukan DATABASE_URL serta konfigurasi Fase 3.
