# File SQL Supabase

`sql/001_schema_all.sql` adalah gabungan seluruh migrasi Fase 2–9 untuk **database kosong**. Berisi schema privat attendance, 18 tabel, constraints, indeks, trigger, RLS dan jurnal Drizzle. Tidak memuat data demo, foto, PIN, password atau akun yang otomatis aktif. Jangan jalankan ulang pada database yang sudah berisi schema attendance.

Pilih salah satu cara instalasi:

1. Direkomendasikan: isi DATABASE_URL di environment lokal, jalankan `pnpm db:migrate`.
2. Manual: jalankan seluruh isi `sql/001_schema_all.sql` sekaligus pada SQL Editor project Supabase baru. Seluruhnya transaksional; bila gagal, rollback. Jurnal Drizzle ikut diisi sehingga migrasi selanjutnya dapat dijalankan dengan `pnpm db:migrate`.

Untuk update database yang sudah memakai migrasi Fase 2, gunakan `pnpm db:migrate`; jangan tempel ulang file gabungan. Folder `drizzle/` adalah sumber migrasi resmi. Regenerasi file gabungan dengan `pnpm db:export:supabase` setelah perubahan migrasi.

Sesudah instalasi, jalankan bootstrap owner melalui CLI aplikasi (lihat `docs/authentication.md`). SQL tidak boleh memuat password asli. Profil Owner Reza dibuat oleh bootstrap dengan credential dari environment server. Seed demo hanya boleh dijalankan pada database development khusus.

Adapter foto privat dan jurnal upload ditambahkan Fase 6; keputusan approval/koreksi tersedia Fase 7. Database Supabase cloud dan GitHub tidak disentuh pada Fase 3–4, sesuai instruksi pemilik.

## Pengetatan akses cloud

Migrasi `0004_supabase_security.sql` memindahkan btree_gist ke schema extensions dan mencabut execute publik fungsi event trigger rls_auto_enable jika fungsi bawaan itu tersedia. Tidak menambahkan policy publik untuk schema aplikasi. File gabungan telah diperbarui.

## Jadwal Fase 5

Migrasi 0005_flexible_schedules sudah diterapkan ke project absensi kita. Jurnal berisi 6 migrasi. File gabungan juga diperbarui, tetapi tetap hanya untuk database baru kosong; project existing menggunakan migrator incremental. Tidak ada seed jadwal/template di cloud.

## Absensi Fase 6

Migrasi 0006 menambah jurnal upload dan constraint satu sesi per jadwal. Cloud masih sampai 0005 karena koneksi PostgreSQL gagal DNS dan konektor sedang tidak tersedia. File gabungan sudah memuat 0006 untuk database kosong; database existing gunakan migrator incremental setelah koneksi pulih.

Bucket attendance-photos privat dibuat dan diverifikasi melalui API Storage. Setup dapat diulang dengan `pnpm storage:setup`, atau gunakan `sql/002_storage_private.sql` di SQL Editor Supabase. SQL Storage terpisah dari migrasi aplikasi karena schema storage dikelola Supabase. Tidak ada policy akses publik; backend service role memeriksa sesi/ownership dan membuat signed URL 60 detik. Panduan ada di `docs/attendance.md`.

## Persetujuan Fase 7

Migrasi 0007 menambah provenance koreksi/snapshot sesi, idempotency/context permintaan, indeks workflow dan trigger histori immutable. Tabel tetap 18 dengan RLS. File gabungan sudah mencakup Fase 7 untuk database baru. Cloud masih menunggu penerapan incremental 0006 dan 0007 karena koneksi PostgreSQL/konektor belum tersedia. Lihat `docs/approvals.md`; tidak menghapus histori lama atau mengubah bucket Storage.

## Monitoring Fase 8

Migrasi 0008 menambah empat indeks read reporting; tabel tetap 18, tanpa perubahan data/izin. File gabungan memuat seluruh migrasi sampai Fase 8 untuk database kosong. Cloud masih pending 0006–0008 karena direct hostname PostgreSQL gagal DNS; tidak mengulang SQL gabungan pada project existing. Panduan monitoring dan otorisasi terdapat di `docs/reporting.md`.

## Hardening Fase 9

Migrasi 0009 menambah trigger scope bisnis/kepemilikan dan menjaga identitas jadwal dengan absensi. Tabel tetap 18, RLS tetap, tidak menghapus/mengganti data. Schema global extension/ACL tetap perlu diperiksa pada restore provider baru. Cloud pending 0006–0009; source SQL gabungan telah diperbarui. Lihat `docs/hardening.md` dan `docs/backup-restore.md`; kelulusan restore tes PGlite bukan bukti pg_restore Supabase native.
