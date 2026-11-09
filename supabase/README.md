# File SQL Supabase

`sql/001_schema_all.sql` adalah gabungan seluruh migrasi Fase 2–4 untuk **database kosong**. Berisi schema privat attendance, 17 tabel, constraints, indeks, trigger, RLS dan jurnal Drizzle. Tidak memuat data demo, foto, PIN, password atau akun yang otomatis aktif. Jangan jalankan ulang pada database yang sudah berisi schema attendance.

Pilih salah satu cara instalasi:

1. Direkomendasikan: isi DATABASE_URL di environment lokal, jalankan `pnpm db:migrate`.
2. Manual: jalankan seluruh isi `sql/001_schema_all.sql` sekaligus pada SQL Editor project Supabase baru. Seluruhnya transaksional; bila gagal, rollback. Jurnal Drizzle ikut diisi sehingga migrasi selanjutnya dapat dijalankan dengan `pnpm db:migrate`.

Untuk update database yang sudah memakai migrasi Fase 2, gunakan `pnpm db:migrate`; jangan tempel ulang file gabungan. Folder `drizzle/` adalah sumber migrasi resmi. Regenerasi file gabungan dengan `pnpm db:export:supabase` setelah perubahan migrasi.

Sesudah instalasi, jalankan bootstrap owner melalui CLI aplikasi (lihat `docs/authentication.md`). SQL tidak boleh memuat password asli. Profil Owner Reza dibuat oleh bootstrap dengan credential dari environment server. Seed demo hanya boleh dijalankan pada database development khusus.

Storage/foto, policy akses foto, dan aturan workflow fase selanjutnya belum dibuat. Database Supabase cloud dan GitHub tidak disentuh pada Fase 3–4, sesuai instruksi pemilik.

## Pengetatan akses cloud

Migrasi `0004_supabase_security.sql` memindahkan btree_gist ke schema extensions dan mencabut execute publik fungsi event trigger rls_auto_enable jika fungsi bawaan itu tersedia. Tidak menambahkan policy publik untuk schema aplikasi. File gabungan telah diperbarui.
