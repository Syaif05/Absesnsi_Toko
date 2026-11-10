# Revisi menu karyawan — 10 November 2026

Permintaan pengguna: menu karyawan yang sederhana, konsisten dengan login baru dan gambar referensi. Observasi: latar terang, judul singkat, kartu putih membulat, satu aksi utama terpusat, aksen biru dan navigasi bawah ringkas. Lingkaran pada referensi diterapkan sebagai tombol selfie, bukan gauge/skor tanpa data bisnis.

Peta menu:

| Menu | URL | Isi |
|---|---|---|
| Absensi | /attendance | Sapaan nama sendiri, sesi masuk/pulang sebenarnya, selfie/GPS, aktivitas terbaru dan tautan jadwal |
| Jadwal | /my-schedule | Navigasi minggu, kartu tanggal/jam/toko, shift melewati hari dan pagination |
| Riwayat | /my-history | Bukti pengiriman asli, status review, foto privat, pagination, tautan koreksi/persetujuan |
| Pengaturan | /account | Profil akun, ganti PIN opsional dan logout |

EmployeeShell menyediakan judul dan bottom navigation bersama. Status Masuk/Pulang adalah indikator sesi server, bukan kontrol untuk melewati alur check-in/out. Tombol Absen masuk berubah menjadi Absen pulang bila ada sesi terbuka. Tanpa jadwal sah, tampilkan kondisi kosong dan tautan Jadwal; tidak membuat jadwal/data dummy. Pending tetap dinyatakan menunggu persetujuan. Halaman koreksi employee mengikuti shell yang sama; inbox owner tidak memakai style employee. Akun owner tetap memakai layout sebelumnya.

Pengambilan kamera/GPS, preview/retake, pengecualian, retry/idempotency, signed URL dan otorisasi memakai implementasi yang sama. Kamera dihentikan ketika pindah halaman; GPS hanya diambil pada aksi mulai. Riwayat baru dijaga autentikasi server dan API yang sama, tidak membawa endpoint publik/foto baru. Tidak ada migrasi, penggantian credential atau perubahan aturan bisnis.

Implementasi layout: satu kolom, lebar maksimal 600px, input 16px, target sentuh minimal 44px, safe-area dan ruang bawah untuk nav fixed. Kartu ringkas dan tombol kamera biru dikombinasikan dengan tombol hitam seperti login. Error/loading/kosong tetap ditampilkan dari state data. Tidak memakai gradient/glass/angka dekoratif.

Verifikasi: 136 tes backend/11 file, lint, typecheck dan build; scanner secret artefak browser. UI/UX, DOM, screenshot, viewport, kamera/GPS dan perangkat nyata **tidak diuji** sesuai penundaan pengguna; layout belum dinyatakan lulus visual. Tidak menambah fitur Fase 11 atau redesign owner.
