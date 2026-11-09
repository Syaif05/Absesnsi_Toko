# Fase 5 — Shift dan jadwal fleksibel

## Alur pengguna

Owner: masuk ke `/owner`, pilih **Jadwal** untuk membuka `/owner/schedules`. Tab template digunakan untuk membuat/edit/nonaktif/aktif template jam mulai, jam selesai, pilihan melewati tengah malam dan toleransi terlambat. Kalender mingguan menyediakan filter toko/karyawan/status, pagination dan editor penugasan per tanggal.

Jadwal baru selalu draft. Pilih **Terbitkan** dan konfirmasi agar terlihat oleh karyawan. **Batalkan** mempertahankan catatan serta audit; jadwal dibatalkan tidak dapat diedit atau diterbitkan ulang, buat jadwal baru jika diperlukan. Template nonaktif tidak bisa dipakai pada penugasan baru atau draft yang akan diterbitkan. Template tidak dihapus permanen.

Karyawan: dari `/account`, pilih **Lihat jadwal saya** untuk membuka `/my-schedule`. Hanya jadwal published miliknya yang dapat diambil dari server. Jadwal owner sendiri juga bisa dibuat melalui pemilih orang; akses manager lintas toko belum diaktifkan.

## Aturan yang diterapkan

- Jadwal menyimpan UUID employee dan store, waktu mulai/selesai lengkap UTC. Penugasan toko jadwal boleh berbeda dari toko asal; tidak mengubah primary_store_id maupun histori assignment asal.
- Input tanggal/jam mengikuti zona usaha (Jakarta, Makassar, Jayapura). Centang melewati tengah malam untuk 20.00–05.00; rentang valid lebih dari 0 sampai 24 jam. Jam 20.00–05.00 Jakarta tersimpan sebagai 13.00–22.00 UTC pada tanggal mulai.
- Jadwal yang sudah dibuat mempertahankan interpretasi zona waktunya walaupun pengaturan zona usaha berubah. Kalender ditempatkan menurut zona usaha saat ini; label zona ditampilkan bila berbeda. Editor memakai zona snapshot jadwal.
- Draft boleh bentrok untuk persiapan, tetapi publish dan edit published tunduk exclusion constraint PostgreSQL per employee, termasuk shift lintas toko. Dua shift berdampingan tepat pada jam akhir/awal diperbolehkan. Konflik dikembalikan sebagai 409 tanpa audit/status parsial.
- Snapshot menyimpan zona, grace, radius/koordinat toko, akurasi GPS, versi aturan dan template. Publish mengambil aturan terbaru sambil mempertahankan interpretasi waktu draft. Perubahan template/aturan tidak memperbarui jadwal published yang sudah ada.
- Edit jadwal published tanpa absensi boleh mengubah penugasan; jika store/template diganti, snapshot terkait diperbarui dan nilai lama tetap di audit. Edit jam saja mempertahankan snapshot published.
- Sesudah ada attendance_session, perubahan waktu dan pembatalan memerlukan konfirmasi khusus. Employee/store/template tidak bisa diganti; bukti dan waktu absensi asli tidak diubah. Karyawan/toko nonaktif masih bisa dibaca dalam histori; perubahan waktu historis tidak memerlukan reaktivasi.
- Semua edit/status memakai version untuk menolak data usang. Otorisasi, lock, mutasi dan audit berada dalam satu transaksi. Waktu audit/publish menggunakan database. Tidak ada otorisasi yang hanya mengandalkan menu.

## File dan API

`src/server/schedules/{validation,time,models,service,http,handler}.ts`, helper tanggal di `src/lib/schedule-dates.ts`, UI `schedule-panel.tsx` dan `my-schedule.tsx`. Detail endpoint ada di `docs/api-contract.md`.

Migrasi `drizzle/0005_flexible_schedules.sql` menambah version/updated_at, aktivasi template, constraint jam template serta indeks store/date dan business template. File gabungan `supabase/sql/001_schema_all.sql` sudah diperbarui. Pada 9 November 2026 migrasi diterapkan melalui plugin ke project absensi kita; jurnal Drizzle berisi 6 migrasi, constraint/kolom terverifikasi, dan tidak ada baris jadwal/template demo di cloud. Advisor hanya INFO RLS tanpa policy pada schema privat/server-only; tidak ada WARN/ERROR.

## Bukti pengujian

51 tes keseluruhan: 36 sebelumnya, 12 tes baru perhitungan waktu/API/PostgreSQL dan 3 tes UI DOM yang meneruskan fetch ke API serta PostgreSQL tes. Meliputi shift malam di tiga zona Indonesia, draft/publish, overlap dan rollback, adjacency, batas minggu, snapshot, histori, versi usang, pembatalan final, izin employee/CSRF, resource salah/nonaktif, edit historis setelah employee nonaktif dan perubahan zona usaha.

UI DOM membuktikan pembuatan template/draft, konfirmasi publish, error overlap tanpa sukses palsu, serta kewajiban konfirmasi edit setelah ada absensi dan bukti asli tetap ada. Browser 375px membuktikan tambah draft, publish, reload, cancel serta edit toleransi template. Screenshot `docs/screenshots/phase5-*`: karyawan → owner → template pada 320/375/390/768/1440, editor pada tiga ukuran HP, dan navigasi admin 320. Tidak ada overflow; lebar dialog lebih kecil daripada viewport. Foto/absensi nyata belum dibuat (Fase 6).

Fixture memakai database sementara loopback, bukan data cloud; sesi fixture disiapkan oleh helper QA. Ini tidak menjadi bukti login operasional pada cloud. Belum diuji: perangkat fisik, jaringan lemah, concurrency multi-koneksi PostgreSQL native, kamera/GPS atau jadwal dengan data karyawan nyata.

## Menjalankan

Runtime nyata: konfigurasi `.env.local`, `pnpm db:migrate`, bootstrap owner sesuai `docs/authentication.md`, lalu `pnpm dev`. Jangan menempel ulang file schema gabungan ke database cloud yang sudah terpasang.

Preview tes tanpa cloud:

```sh
RUN_ISOLATED_PREVIEW=true PREVIEW_OWNER_PASSWORD='password-khusus-tes-lokal' pnpm qa:owner
```

Owner fixture: `http://127.0.0.1:3002/owner-preview?view=schedules`. Karyawan fixture: `http://127.0.0.1:3002/owner-preview?view=mine`. Gateway fixture mengganti cookie sesuai peran; kembali ke URL owner untuk memulihkan sesi owner. Semua data TES hilang setelah Ctrl+C. Helper menolak production dan tidak menambahkan endpoint pada aplikasi produksi.

Koneksi runtime lokal saat checkpoint: DATABASE_URL sudah PostgreSQL dan project cocok, tetapi `pnpm db:check` gagal `ENOTFOUND` untuk hostname Direct Connection. Probe DNS IPv4/IPv6 juga timeout dari lingkungan ini. Plugin Supabase tetap terhubung. Gunakan URI Session pooler resmi bila direct endpoint tidak terjangkau; kredensial tidak ditampilkan atau diubah. Bootstrap ID/password owner masih kosong, sehingga akun owner operasional belum dibuat.
