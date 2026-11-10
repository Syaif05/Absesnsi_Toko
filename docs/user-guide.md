# Panduan ringkas pemilik dan karyawan

Alamat website HTTPS diberikan setelah deployment. Panduan ini menjelaskan fitur yang sudah dibuat; bukan bukti pilot atau pengujian UI/perangkat. Tidak ada akun/password default. Owner pertama dibuat operator lewat bootstrap sekali pakai; tidak ada registrasi umum.

## Pemilik

1. Masuk di `/login` sebagai owner menggunakan ID dan password kuat yang diberikan lewat kanal aman. Buka `/account` untuk mengganti password; semua sesi akan dicabut sehingga perlu login ulang. Owner tidak menggunakan PIN karyawan.
2. Dari akun buka pengelolaan usaha (`/owner`). Lengkapi profil usaha dan aturan: timezone, radius, akurasi GPS dan toleransi. Periksa nilai bersama penanggung jawab toko. Pengaturan tidak menerima credential database/API.
3. Pada Toko, tambah nama/kode unik, alamat, latitude/longitude dan radius. Verifikasi koordinat di lokasi nyata. Gunakan nonaktif untuk toko yang berhenti beroperasi agar riwayat tetap tersimpan.
4. Pada Karyawan, tambah nama, ID unik, toko asal dan penugasan. Catat PIN sementara yang hanya tampil sekali, berikan secara pribadi kepada orang yang benar. PIN lama tidak dapat dilihat. Reset PIN setelah verifikasi identitas; sesi lama dicabut. Ubah ID dengan konfirmasi; UUID/riwayat tetap. Nonaktifkan akun bila akses harus dihentikan.
5. Buka Jadwal (`/owner/schedules`), buat template lalu jadwal untuk employee/toko/tanggal yang benar. Publish agar dapat dipakai absen. Shift malam memakai tanggal selesai berikutnya. Jadwal overlap ditolak; perubahan setelah absensi membutuhkan konfirmasi dan audit.
6. Pantau `/owner/dashboard` dengan filter toko/tanggal. Bedakan sah, pending, ditolak dan belum tercatat. Ringkasan menggunakan jadwal sehingga shift lintas malam mengikuti tanggal mulai shift. Buka laporan `/owner/reports` untuk riwayat dan detail employee; pagination tidak mengubah total KPI.
7. Buka `/owner/approvals`. Periksa selfie, lokasi, akurasi, jadwal, waktu resmi dan alasan; putuskan setuju/tolak dengan catatan dan konfirmasi. Pengajuan pending bukan kehadiran yang sudah disetujui. Bukti asli dan histori koreksi dipertahankan.
8. Tinjau audit untuk perubahan sensitif. Backup, domain, server dan secret ditangani operator sesuai runbook, tidak diubah lewat form usaha. Jika ada masalah, catat waktu dan request ID error, jangan mengirim PIN/selfie/kunci ke log atau chat umum.

Sebelum pilot: uji tambah toko/karyawan, ubah ID, reset PIN, publish shift dan approval dari HP secara mandiri. Minta pendampingan bila formulir atau istilah belum jelas; tandai masalah dalam checklist pilot.

## Karyawan

1. Buka alamat HTTPS, login menggunakan ID karyawan + PIN sementara dari owner. Ganti PIN ketika diminta; gunakan PIN pribadi minimal 6 digit. Bila lupa, hubungi owner untuk reset. Jangan berbagi akun atau menyimpan PIN di HP bersama.
2. Periksa Jadwal (`/my-schedule`), toko dan jam shift. Jadwal wajib sudah publish; bila kosong/salah, hubungi owner. Jangan memakai akun orang lain atau menganggap jadwal contoh sebagai jadwal kerja.
3. Buka Absensi (`/attendance`), pilih masuk atau pulang. Izinkan kamera dan lokasi ketika browser meminta. Ambil selfie langsung, periksa preview, ambil ulang bila perlu lalu kirim. Foto galeri tidak menjadi jalur normal.
4. Tunggu konfirmasi server. Jika koneksi gagal, ikuti pesan retry; jangan menganggap tombol ditekan berarti berhasil. Aplikasi tidak mengklaim absen sukses saat offline. Waktu resmi berasal dari server.
5. Bila luar radius, GPS ditolak/tidak tersedia atau akurasi buruk: coba lokasi lagi, lalu isi alasan yang benar untuk pengajuan pengecualian. Status menunggu persetujuan berarti tercatat untuk review, belum disetujui. Check-out tetap dapat diajukan ketika check-in pending.
6. Untuk koreksi, buka `/my-approvals`, pilih catatan/sesi yang tersedia dan ajukan jenis/waktu yang benar beserta alasan. Owner meninjau sebelum perubahan resmi. Jangan membuat check-in/out ganda untuk memperbaiki waktu.
7. Logout setelah selesai pada HP bersama. Jika kamera/GPS tidak muncul, periksa izin situs pada pengaturan browser dan pastikan memakai HTTPS; hubungi owner jika tetap gagal. Browser kamera/GPS perlu diuji pada perangkat nyata sebelum pilot.

Lokasi diambil saat absensi, bukan pelacakan terus-menerus. Selfie/GPS bukan pengenal biometrik atau jaminan anti-manipulasi. Minta penjelasan pemberitahuan privasi dan masa simpan foto dari pemilik sebelum ikut pilot.
