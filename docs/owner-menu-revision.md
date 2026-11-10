# Revisi ruang owner — 10 November 2026

## Tujuan dan referensi

Referensi pengguna: sidebar terang, konten abu-abu pucat, kartu statistik berwarna lembut, grafik sederhana, dan daftar aktivitas rapi. Bahasa visual login dipertahankan lewat form sederhana dan tombol utama gelap. Tidak menambahkan kartu pembayaran, promosi, pencarian global, chat, avatar stok, atau angka contoh.

Peta komponen: `OwnerShell` untuk sidebar desktop, navigasi bawah HP dan menu lengkap; `ReportingPanel` untuk dashboard/laporan; `OwnerPanel` untuk karyawan/toko/pengaturan; `SchedulePanel` dan `ScheduleGenerator` untuk penjadwalan; `ApprovalsPanel` untuk pengajuan. CSS owner dibatasi oleh `.owner-workspace` agar tidak mengubah login dan area karyawan.

## Perubahan

- Satu navigasi konsisten: Dashboard, Karyawan, Jadwal, Laporan, Pengajuan, Toko, Pengaturan, Akun saya.
- Dashboard default 7 hari terakhir, pilihan cepat hari ini/7/30 hari, filter toko/tanggal, KPI terpisah, grafik berdasarkan jumlah jadwal nyata, aktivitas dan status toko. Grafik memakai skala jumlah yang sama untuk seluruh hari dan memiliki rincian teks. Tidak ditampilkan ketika belum ada jadwal. Waktu pembaruan nyata tetap terlihat.
- Laporan riwayat dan pengajuan dipisahkan. Detail foto privat, keputusan, waktu resmi dan audit koreksi tetap tersedia. Form/filter/kartu/modal mendapat gaya konsisten; HP tidak memerlukan sidebar permanen.
- Karyawan: nama, ID opsional yang otomatis dibuat server bila kosong, PIN acak 6 digit sekali tampil, edit/nonaktif/reset dan tautan penjadwalan. Tidak mengubah hash/PIN lama atau membuat akun di database produksi.
- Generator jadwal: beberapa karyawan, toko aktif, tanggal inklusif maksimal 31 hari, pilihan hari kerja, template/jam khusus, shift malam, preview, maksimal 100 jadwal per operasi. Simpan draft atau pilih langsung terbitkan setelah konfirmasi.
- Endpoint `POST /api/v1/schedules/batch`: owner dan same-origin, validasi Zod, body maksimum 64 KiB; seluruh operasi satu transaksi. Memeriksa bentrok dengan draft/terbit serta sesama item; kegagalan menggulung seluruh jadwal dan audit. Pengiriman ulang jadwal yang sudah tersimpan ditolak sebagai bentrok. Membatalkan jadwal tetap mempertahankan histori. Tidak ada migrasi database.
- Permintaan daftar dan pilihan independen dimuat bersamaan; toko tidak diambil seluruhnya saat halaman pengaturan/toko. Polling dashboard tetap ringan 60 detik saat terlihat dan online. Tidak mengklaim hasil benchmark performa.

## Verifikasi dan batasan

- `pnpm test:server`: pengujian backend, termasuk transaksi batch, rollback audit, shift malam, retry/bentrok, batas body, RBAC, CSRF, target nonaktif dan publish terkonfirmasi.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm security:client`, `git diff --check`.
- Pengujian UI/browser/screenshot sengaja tidak dijalankan sesuai instruksi pengguna. Kerapian runtime di perangkat belum dinyatakan lulus.
- Generator mengikuti pola yang dipilih owner; tidak menebak kebutuhan jumlah petugas, cuti atau rotasi. Beberapa pola/toko dapat dibuat dalam operasi terpisah. Editor per jadwal tetap tersedia.
- Bentrok draft pada editor satuan tetap boleh seperti aturan sebelumnya; penerbitan selalu dilindungi constraint overlap. Generator lebih ketat untuk menghindari draft ganda saat retry.
- Tidak menjalankan perubahan data contoh, migrasi, atau reset kredensial di database produksi.

## Cara menggunakan

Buka `/owner/dashboard`. Tambah toko dan karyawan lewat menu, lalu buka Jadwal → Buat jadwal otomatis → pilih karyawan/hari/jam → Pratinjau jadwal → Buat draft atau Buat & terbitkan. Jadwal terbit muncul pada akun karyawan. Tinjau pengecualian/koreksi di Pengajuan dan absensi resmi di Laporan. Jalankan lokal dengan `pnpm dev` bila diperlukan.
