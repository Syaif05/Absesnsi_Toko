# Backup dan restore — runbook Fase 9

Backup operasional berisi schema/data attendance + jurnal drizzle, serta objek selfie yang direferensikan event. Tidak memuat file ENV/kunci Supabase/session secret. Hash credential dan token sesi yang berada di database tetap data sensitif; seluruh paket harus dienkripsi. Pemilik harus menyepakati RPO/RTO, jadwal, lokasi salinan kedua, retensi backup dan penanggung jawab sebelum pilot.

## Membuat dan memverifikasi backup

Prasyarat: PostgreSQL client `pg_dump` sesuai versi server (project terakhir PostgreSQL 17), koneksi PostgreSQL yang dapat dijangkau dengan verified TLS, key Storage server, bucket privat, dan ruang disk untuk dump sementara. Script memakai pg_export_snapshot pada transaksi repeatable-read agar dump dan daftar foto memakai snapshot DB yang sama. Dua koneksi database dibutuhkan; direct atau Session pooler lebih mudah diaudit untuk operasi ini. Hentikan pekerjaan penghapusan/retensi storage selama backup agar objek referensi tidak dihapus ketika diunduh.

Simpan `BACKUP_ENCRYPTION_KEY` sebagai 32 byte acak dalam format 64 hex, terpisah dari SESSION_SECRET, di ENV privat dan password manager pemilik. Key bukan password pendek dan bukan nilai contoh. Dapat dibuat di terminal pemilik dengan `openssl rand -hex 32`; jangan kirim key ke chat/log atau commit Git. Kehilangan key berarti backup tidak dapat dipulihkan. Gunakan DATABASE_SSL_CA (PEM) atau PGSSLROOTCERT yang sesuai provider bila CA sistem tidak mencukupi; script tidak menonaktifkan verifikasi TLS remote.

```sh
pnpm backup:create .local/backups/nama-backup
pnpm backup:verify .local/backups/nama-backup
```

Folder tujuan create harus belum ada. Hasilnya `manifest.enc`, `database.enc` dan `photo-########.enc`, seluruhnya AES-256-GCM dengan nonce acak, authentication tag dan checksum SHA-256 dalam manifest terenkripsi. Nama/path manifest divalidasi untuk mencegah traversal dan entri duplikat. Paket hanya dinyatakan selesai setelah dump, semua foto dan manifest berhasil; kegagalan membersihkan staging normal. Verify mengautentikasi/dekripsi ke folder sementara privat, memeriksa checksum setiap berkas, kemudian menghapus plaintext sementara. Jangan menganggap create sukses sebagai bukti bahwa restore native sudah berhasil.

Key tidak berada dalam argumen pg_dump; koneksi menggunakan environment child process, stderr tidak disalin ke log aplikasi. Folder backup/scratch dibuat privat (0700), file 0600. Ada plaintext dump/foto sementara dalam direktori privat OS selama proses; finally membersihkannya pada selesai/error normal. Power loss/kill paksa dapat meninggalkan scratch `.princes-backup-*`/`princes-backup-*`; operator perlu membersihkan sisa tersebut dengan prosedur aman dan menggunakan disk terenkripsi. `.local`, `.enc`, `.dump` dan staging diabaikan Git. Backup harus disalin ke lokasi kedua milik pemilik, bukan hanya laptop yang sama; penjadwalan/transport salinan belum dibuat.

## Restore native ke target kosong

Fase 9 tidak menjalankan restore ke Supabase nyata dan tidak menyediakan tombol web untuk menimpa database. Lakukan drill pada **project/database terisolasi kosong**, jangan pada database operasional. Restore disaster recovery mengembalikan bisnis yang sama; penyerahan ke pemilik baru tetap memakai migrasi kosong/bootstrap baru, bukan backup developer/data demo.

1. Verifikasi paket dengan `backup:verify`. Pastikan format yang dilaporkan `pg_dump_custom`, versi client/server sesuai, key tersedia dan pemilik mengizinkan target drill.
2. Siapkan target kosong, bucket privat, CA dan koneksi milik target. Verifikasi tidak ada schema attendance/drizzle milik instalasi lain. Jangan memakai `--clean`, reset database atau mematikan trigger pada database existing untuk memaksa restore.
3. Pada target kosong siapkan dependency ekstensi sebelum pg_restore: schema `extensions` dan `btree_gist` pada schema tersebut (sumber aplikasi memakai schema extensions). Ini harus sesuai source dan kemampuan target. Paket hanya memuat schema attendance/drizzle, bukan schema/provider auth/storage Supabase atau extension global.
4. Extract ke folder **baru** yang hanya dapat dibaca operator:

   ```sh
   pnpm backup:extract .local/backups/nama-backup .local/restore-drill
   ```

   Plaintext baru dipublikasikan setelah authentication tag setiap file lolos. Extract bukan restore database. Jika satu berkas gagal, script membersihkan output baru dan tidak menyatakan restore selesai.
5. Konfigurasikan PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD/PGSSLMODE=verify-full/PGSSLROOTCERT melalui environment privat **target**, lalu jalankan:

   ```sh
   pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname=postgres .local/restore-drill/database.dump
   ```

   Jangan menaruh URI berpassword pada argumen shell. Tidak menjalankan db:migrate terlebih dahulu untuk membuat tabel yang sama; dump sudah membawa schema dan jurnal migrasi sumber. Setelah restore, migrator hanya boleh menambahkan versi yang benar-benar lebih baru.
6. Cabut sesi login lama sebelum mengaktifkan aplikasi: update auth_sessions.revoked_at pada sesi aktif melalui operator target. Rotasi kredensial hosting/Storage/session secret yang relevan. Rotasi SESSION_SECRET **sendiri** tidak mencabut token opaque yang hashnya masih valid di database.
7. Kembalikan akses schema privat secara eksplisit (pg_restore --no-privileges tidak membawa ACL sumber): revoke PUBLIC/anon/authenticated untuk schema, tabel, fungsi attendance; pastikan RLS seluruh 18 tabel tetap aktif dan role backend yang benar mempunyai akses. Jalankan security advisor pada target.
8. Upload semua file dalam `.local/restore-drill/photos/` ke bucket privat target dengan path UUID **yang sama** melalui adapter/Storage API berizin server; batasi JPEG 512 KiB. Jangan membuat bucket public/policy baca massal. Verifikasi jumlah/hash foto terhadap manifest dan referensi attendance_events; kegagalan upload berarti restore belum selesai, aplikasi belum boleh diaktifkan. Rekonsiliasi jumlah/byte serta satu signed read employee sendiri/owner dan penolakan akses lain.
9. Verifikasi UUID/FK, jumlah tabel/row penting/jurnal, versi bisnis, constraints/triggers, audit append-only, waktu resmi vs bukti asli, login owner baru dan status approval. Ukur waktu pemulihan dan usia backup untuk dibandingkan dengan RTO/RPO yang disepakati. Simpan bukti drill tanpa kredensial/foto pribadi pada log umum.
10. Hapus plaintext extract/scratch dengan prosedur operator setelah verifikasi. Ulangi drill berkala dan sebelum go-live, termasuk skenario kehilangan key/rusaknya backup dan kegagalan foto.

## Bukti uji yang tersedia

Tes `tests/integration/backup.test.ts` membuat PostgreSQL PGlite terisolasi, memasang semua migrasi, membuat bisnis/employee/jadwal/sesi/event/foto **fiktif**, mengekspor data directory, mengenkripsi snapshot dan foto, memverifikasi manifest/checksum, lalu memulihkan instance baru. Referensi foto, byte foto, data employee, FK, 18 tabel RLS dan larangan hapus audit diverifikasi. Tes key salah/tampering/path traversal/overwrite juga lulus.

Format tes tersebut ditandai `pglite_test_snapshot`; **bukan pg_dump dan tidak dapat dipakai dengan pg_restore native**. Ini membuktikan pipeline enkripsi/integritas dan pemulihan engine tes, bukan kesiapan pemulihan Supabase operasional. Pada checkpoint: pg_dump/pg_restore tidak tersedia di PATH dan PostgreSQL cloud masih gagal DNS, sehingga native backup/restore+upload ulang foto ke project drill tetap blocker sebelum go-live. Jangan menandainya lulus dari hasil tes PGlite.
