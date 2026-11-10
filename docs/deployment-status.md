# Status publikasi — 10 November 2026

Repository: [Syaif05/Absesnsi_Toko](https://github.com/Syaif05/Absesnsi_Toko). Website: [absesnsi-toko.vercel.app](https://absesnsi-toko.vercel.app). Project Vercel `absesnsi-toko`, tim `syaif05's projects`, Next.js pada Node 24. Target deployment Vercel `production` berarti alias utama; ini **bukan penerimaan operasional bisnis**. Hak penggunaan komersial plan, pilot dan persyaratan Fase 10 tetap perlu diselesaikan.

Source kandidat `efc5b9e`, tag `v0.1.0-rc.1`, beserta histori telah dipush tanpa force. Origin lokal kini repository yang diminta pemilik. Integrasi GitHub–Vercel aktif; push main membangun deployment berikutnya. Histori 394 blob diperiksa terhadap nilai secret lokal aktif dan private key sebelum publikasi; file ENV aktual dan backup tidak dilacak.

## Koneksi dan konfigurasi

Project Supabase `absensi kita` dikonfirmasi ACTIVE_HEALTHY. Direct hostname sebelumnya ENOTFOUND di laptop dan runtime Vercel. Host Session pooler diberikan pemilik melalui chat, digunakan pada port 5432 dengan username pooler sesuai project. Sertifikat CA resmi disertakan melalui DATABASE_SSL_CA; TLS tetap rejectUnauthorized=true, tanpa mematikan verifikasi hostname/chain.

CA publik diperoleh dari URL yang dirujuk [konfigurasi resmi Supabase Studio](https://github.com/supabase/supabase/blob/79763687f7e5227ed961c1c86c3444b2b59c8a68/apps/studio/hooks/custom-content/custom-content.json). Pengaturan mengikuti [SSL enforcement Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement) dan [connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres). Sertifikat ditambahkan hanya pada koneksi aplikasi, bukan trust store sistem.

DATABASE_URL dan SUPABASE_SERVICE_ROLE_KEY disimpan sebagai Secret server Vercel setelah izin khusus pemilik. SESSION_SECRET baru terpisah dari development disimpan setelah izin khusus berikutnya. Secret hanya pada environment Vercel production, tidak diberikan pada preview/development dan tidak disalin ke source/frontend. Bootstrap password/backup key tidak diunggah. APP_BASE_URL memakai alias HTTPS utama; APP_ENV production, ALLOW_DEMO_SEED false, pool maksimum satu koneksi per instance. `.env.local` privat mode 0600 juga diperbaiki ke pooler + CA agar development kembali dapat terhubung; tidak masuk Git.

## Migrasi dan bukti verifikasi

Sebelum migrasi: enam jurnal canonical diperiksa hash/urutannya; owner aktif, toko dan event absensi masing-masing nol. Migrator Drizzle menerapkan tambahan 0006–0009 tanpa reset, seed, penghapusan histori atau foto. Setelah migrasi: sepuluh jurnal canonical cocok dengan source.

- `pnpm db:check`: terhubung melalui TLS terverifikasi.
- Preflight readonly: **17 dari 18 pemeriksaan lulus**. Tabel 18/18, RLS seluruh tabel, jurnal 10/10, trigger 13/13, indeks integritas, schema privat, fungsi, bisnis aktif, tanpa bisnis demo, scope sesi/path foto serta bucket privat JPEG maksimal 512 KiB lulus. Pemeriksaan `owner` gagal karena akun/credential owner pertama belum dibuat; technicalReady tetap false.
- Deployment aplikasi `dpl_44oEYj6ZKk9adzfyEN7BigxkcxuT`, source `efc5b9e`, berstatus READY. Commit dokumentasi setelahnya tidak mengubah kode aplikasi.
- `node scripts/release-smoke.mjs https://absesnsi-toko.vercel.app`: liveness 200, GET me 401 dan attendance context 401, no-store/nosniff/DENY serta request ID error lulus. Hanya JSON API, tanpa browser/tes UI atau login mutasi.
- Advisor security hanya mengembalikan INFO RLS tanpa policy pada 18 tabel schema attendance privat. Ini disengaja: akses anon/authenticated/PUBLIC ditolak, akses aplikasi lewat backend dengan RBAC. Tidak membuat policy publik untuk menghilangkan INFO. [Penjelasan linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Advisor performance mencatat INFO sembilan FK tanpa indeks khusus, business_settings tanpa PK (memiliki unique business/key), dan indeks belum digunakan pada DB kosong. Catat sebagai evaluasi sebelum skala/pilot, jangan hapus indeks integritas karena belum digunakan. [FK index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [primary key](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key).

## Pekerjaan penerimaan yang tersisa

Akun owner awal memerlukan bootstrap dengan identitas/password kuat melalui CLI satu kali sesuai [runbook](deployment-handover.md). Tidak ada ID/password default yang bisa dipakai untuk login. Belum membuat data nyata toko/karyawan/jadwal. Native backup/restore, salinan kedua, scheduler/monitoring, kebijakan privasi/retensi, validasi plan komersial dan pilot satu toko lalu kedua toko tetap terbuka. Semua tes UI/UX/perangkat/kamera/GPS tetap ditunda sesuai permintaan pemilik.

Deployment tidak berarti Fase 10 diterima. Gunakan [checklist pilot](pilot-checklist.md) untuk penerimaan setelah bootstrap dan semua prasyarat terpenuhi. Tidak memulai Fase 11.

Pembaruan setelah publikasi awal: owner dan satu akun karyawan awal sudah dibuat atas permintaan pengguna; login API keduanya serta preflight 18/18 telah lulus. Credential hanya dibagikan melalui file privat lokal, tidak dimasukkan ke repository. Revisi berikutnya pada [login dan PIN opsional](login-revision.md) mengganti kebijakan wajib PIN pertama; akun lama tetap dapat dipakai. Status UI/pilot tetap belum diterima.
