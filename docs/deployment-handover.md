# Deployment, serah terima dan pilot — Fase 10

Status 10 November 2026: paket deployment disiapkan lokal; belum ada deployment publik, owner produksi, migrasi cloud baru atau pilot yang dinyatakan lulus. Target hosting/domain dan project milik penerima belum dikonfirmasi. Konektor Supabase/Vercel terakhir gagal transport; hostname PostgreSQL development sebelumnya gagal DNS. Jangan menganggap project development sebagai database produksi baru milik penerima.

## Paket dan pilihan hosting

Source tetap Next.js + PostgreSQL/Supabase Storage. `pnpm release:build` membuat `.next/standalone`, menyalin aset static/public, membuang salinan `.env*` dari artefak turunan, dan menolak artefak jika nilai secret aktif terdeteksi pada berkas kode. Secret runtime tetap disuntikkan oleh operator. Tidak ada salinan database atau foto dalam paket. `/` mengarah ke login; prototipe fiktif pindah ke `/demo`, tersedia hanya pada development dan tidak tersedia ketika NODE_ENV production.

`Dockerfile` menyediakan target `web` Node 24 non-root dan `ops` terpisah dengan Node + PostgreSQL client 17 untuk migrasi/bootstrap/backup. Compose ops tidak menjadi layanan HTTP. Docker build harus dijalankan pada platform server tujuan sebelum penggunaan; keberhasilan build standalone lokal tidak membuktikan image Linux sudah diuji.

Pilihan yang disiapkan: VPS/container pada provider yang mengizinkan penggunaan komersial, dengan Caddy sebagai reverse proxy HTTPS. Verifikasi syarat paket provider, kapasitas, DNS, firewall dan akses operator sebelum memasang. Tidak ada pembelian hosting/domain atau asumsi bahwa VPS sudah tersedia. Alternatif Vercel memerlukan plan/team yang sesuai penggunaan usaha; Hobby hanya personal/nonkomersial menurut [dokumentasi Vercel](https://vercel.com/docs/plans/hobby). Jangan memakai Compose dan Vercel sekaligus sebagai dua produksi tanpa rancangan operasional.

Implementasi standalone mengikuti [Next.js output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) dan [self-hosting](https://nextjs.org/docs/app/guides/self-hosting). HTTPS Caddy mengikuti [Automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Instalasi bersih pada infrastruktur pemilik

1. Verifikasi akun/project Supabase tujuan memang milik penerima, masih kosong dan terpisah dari development. Siapkan bucket privat dan koneksi PostgreSQL direct/Session pooler yang dapat dijangkau server. Jangan memakai koneksi transaction pooler untuk migrasi/backup snapshot. Catat versi PostgreSQL; image ops memakai client 17, sesuaikan bila server berbeda.
2. Salin `deploy/production.env.example` ke `.env.production.local`, mode 0600. Isi URL HTTPS final, UUID bisnis baru, URL PostgreSQL, secret sesi acak minimal 32 karakter, Supabase URL dan service role key server. Pakai TLS verified, CA provider bila diperlukan. Jangan menyalin `.env.local` developer, credential, PIN, foto atau dump demo. Template tidak berisi secret yang siap dipakai.
3. Untuk jalur Compose, siapkan Docker Engine + Compose pada host, DNS A/AAAA ke host, port 80/443 terbuka dan port web/DB tidak dipublikasikan. Di direktori repo, jalankan sebagai operator yang mempunyai akses Docker:

   ```sh
   export APP_DOMAIN=absensi.domain-pemilik.example
   export OPS_UID=$(id -u)
   export OPS_GID=$(id -g)
   mkdir -p .local/backups
   chmod 700 .local .local/backups
   chmod 600 .env.production.local
   docker compose -f deploy/compose.yaml config --quiet
   docker compose -f deploy/compose.yaml build web ops
   ```

   Ganti domain contoh. `APP_BASE_URL` harus sama origin dengan domain ini. Jangan cetak `docker compose config` tanpa `--quiet` ke log karena env_file memuat secrets. Caddy memerlukan DNS dan port yang benar untuk menerbitkan sertifikat. Simpan volume sertifikat; cek akses jaringan Supabase dari host.
4. Jalankan migrasi versioned pada target **kosong yang terverifikasi**:

   ```sh
   docker compose -f deploy/compose.yaml run --rm ops scripts/db-migrate.mts
   docker compose -f deploy/compose.yaml run --rm ops scripts/storage-setup.mts
   ```

   Tidak menjalankan seed. Alternatif SQL bundle `supabase/sql/001_schema_all.sql` hanya untuk instalasi kosong; gunakan satu metode saja. Database existing memakai migrator incremental setelah backup dan review perubahan, jangan tempel ulang bundle atau reset schema.
5. Bootstrap satu kali. Masukkan ID/password kuat melalui environment privat di terminal operator (password dibaca tersembunyi; jangan literal pada history). Nama bisnis/owner ditentukan pemilik. Contoh Bash pada server:

   ```bash
   read -r -p 'ID owner: ' BOOTSTRAP_OWNER_ID
   read -r -s -p 'Password owner: ' BOOTSTRAP_OWNER_PASSWORD
   echo
   read -r -p 'Nama owner: ' BOOTSTRAP_OWNER_NAME
   read -r -p 'Nama usaha: ' BOOTSTRAP_BUSINESS_NAME
   export BOOTSTRAP_OWNER_ID BOOTSTRAP_OWNER_PASSWORD BOOTSTRAP_OWNER_NAME BOOTSTRAP_BUSINESS_NAME
   docker compose -f deploy/compose.yaml run --rm \
     -e BOOTSTRAP_OWNER_ID -e BOOTSTRAP_OWNER_PASSWORD \
     -e BOOTSTRAP_OWNER_NAME -e BOOTSTRAP_BUSINESS_NAME \
     ops scripts/bootstrap-owner.mts
   unset BOOTSTRAP_OWNER_ID BOOTSTRAP_OWNER_PASSWORD BOOTSTRAP_OWNER_NAME BOOTSTRAP_BUSINESS_NAME
   ```

   Bootstrap tidak dapat diulang setelah sukses. Kosongkan/hapus semua BOOTSTRAP_OWNER_* dari konfigurasi runtime web. Password tidak ditulis ke dokumen/chat/log. Berikan lewat kanal aman milik penerima; owner mengganti password pada `/account` setelah login. MFA owner belum diimplementasikan, catat sebagai batasan.
6. Jalankan pemeriksaan readonly dan simpan output aman bila dibutuhkan:

   ```sh
   docker compose -f deploy/compose.yaml run --rm ops scripts/release-check.mts
   docker compose -f deploy/compose.yaml up -d web proxy
   node scripts/release-smoke.mjs https://absensi.domain-pemilik.example
   ```

   Preflight memeriksa konfigurasi production/HTTPS, seed mati, bootstrap dibuang, 18 tabel RLS, jurnal hash migrasi, trigger/index integritas, pembatasan schema, bisnis/owner dan metadata bucket. Preflight tidak menulis database. Bila gagal, perbaiki penyebab; jangan melanjutkan pilot. Pada instalasi tanpa Docker: `RELEASE_ENV_FILE=.env.production.local pnpm release:check .local/preflight.json` (output baru mode 0600), `pnpm release:build`, lalu suntikkan ENV produksi dan jalankan `pnpm start:standalone` di belakang reverse proxy HTTPS. Script build sendiri bukan injeksi ENV runtime.
7. Smoke hanya GET JSON anonim: liveness 200, endpoint milik sendiri tanpa cookie 401, header no-store/nosniff/DENY dan request ID error. `/api/health/live` hanya proses hidup, bukan DB/storage siap. Tidak mencoba bypass deployment protection. Status 503 pada endpoint terlindungi berarti konfigurasi/DB belum siap meskipun liveness 200.
8. Owner mengisi profil usaha, toko, koordinat/radius, karyawan dan jadwal melalui dashboard. Data nyata tidak dimasukkan oleh seed/SQL developer. Selesaikan dokumen privasi, retensi foto, aturan HR dan kontak darurat sebelum melibatkan karyawan.

## Backup, monitoring dan pemulihan

Gunakan [runbook backup/restore](backup-restore.md). Key backup 32 byte acak/64 hex disimpan di password manager pemilik dan hanya diberikan pada proses ops, bukan web. Contoh setelah operator mengisi `BACKUP_ENCRYPTION_KEY` lewat secret manager/environment privat:

```sh
docker compose -f deploy/compose.yaml run --rm -e BACKUP_ENCRYPTION_KEY ops scripts/backup.mts create /backups/nama-backup-baru
docker compose -f deploy/compose.yaml run --rm -e BACKUP_ENCRYPTION_KEY ops scripts/backup.mts verify /backups/nama-backup-baru
```

Tujuan create harus baru. UID/GID ops harus cocok pemilik folder bind mount; jangan gunakan chmod 777. Salin paket terenkripsi ke lokasi kedua milik penerima, simpan key terpisah. Tentukan RPO/RTO, jadwal serta retensi bersama pemilik; pasang scheduler host hanya setelah kesepakatan. Scheduler/salinan kedua belum dipasang. Lakukan native pg_dump/pg_restore + pemulihan foto ke target drill kosong, ukur waktu, periksa FK/RLS/audit dan signed read. Tes PGlite bukan pengganti drill native ini. Eksekusi restore/rotasi sesi mengikuti runbook, tidak menimpa database existing.

Pantau HTTPS `GET /api/health/live` tiap interval yang disepakati melalui monitor milik penerima dan jadwalkan preflight readonly yang lebih jarang untuk DB/storage. Simpan exit code, waktu, dan request ID error; jangan simpan cookie, foto, lokasi, key atau dump plaintext pada log monitor. Compose membatasi log 3×10 MB per service. Healthcheck menandai unhealthy, tetapi restart policy tidak otomatis menyelesaikan DB gagal atau container unhealthy yang masih hidup; operator harus menerima alarm dan bertindak. Belum ada monitor/kanal alarm eksternal yang dipasang.

Rollback aplikasi: simpan commit/image kandidat sebelumnya, backup sebelum perubahan schema, hentikan rollout jika smoke gagal. Deploy ulang image sebelumnya hanya jika schema kompatibel; migrasi tidak dibalik secara destruktif. Jika data perlu dipulihkan, gunakan drill/prosedur restore pada target kosong kemudian cutover setelah validasi pemilik. Jangan arahkan runtime ke DB developer sebagai fallback.

## Pilot dan berita acara penerimaan

[Checklist pilot](pilot-checklist.md) harus diisi dengan tanggal/operator/bukti tanpa secrets. Mulai satu toko, review hasil dan kendala lalu toko kedua. User menunda semua pengujian UI/UX: agen tidak melakukan tes browser, kamera/GPS, screenshot atau perangkat pada fase ini. Karena itu acceptance pilot belum lulus dan aplikasi belum dinyatakan siap operasional. Pengujian manual nyata dilakukan ketika pemilik mencabut penundaan dan target tersedia.

Serah terima: source + kandidat commit/tag, migrasi, ENV template tanpa nilai, akun infrastruktur milik penerima, [panduan pengguna](user-guide.md), runbook backup, daftar blocker, serta berita acara pilot. GitHub push tetap ditunda. Catat siapa pemilik akses/penanggung jawab backup dan cabut akses developer setelah handover sesuai keputusan penerima.
