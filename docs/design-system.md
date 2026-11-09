# Fondasi desain Fase 0

Observasi dari deskripsi referensi pada PRD §7: latar biru keabu-abuan, permukaan putih, panel membulat, aksen periwinkle lembut, tipografi sans-serif, jarak lega, ikon garis tipis, tabel bersih. File gambar asli belum tersedia sehingga perbandingan visual belum dilakukan.

## Peta komponen untuk Fase 1

- Karyawan mobile: header ringkas, kartu status shift, satu tombol absen utama, navigasi bawah, daftar jadwal/riwayat.
- Owner mobile: ringkasan status, daftar persetujuan, menu administrasi ringkas, form satu kolom dengan tombol simpan terjangkau.
- Tablet/laptop: susunan KPI dan panel data berdasarkan ruang; sidebar hanya di layar lebar.

Token warna, radius, dan bayangan sudah berada di `src/app/globals.css`. CSS ditulis mulai dari layar kecil. Halaman saat ini hanya status setup Fase 0; bukan prototipe fitur Fase 1.

Target review berikutnya: 320×568, 375×812, 390×844, 768×1024, dan 1440×900. Semua kontrol interaktif minimal 44×44 CSS px, label dan status wajib teks, tidak ada overflow horizontal atau aksi penting tersembunyi dalam tabel mobile.

## Fase 1 — referensi aktual

Gambar pemilik sudah disimpan di `reference/dashboard-reference.png`. Observasi: bingkai luar biru abu-abu, shell terang dengan sudut besar, sidebar putih sekitar 230px, kartu KPI satu baris, satu aksen biru, grafik batang sederhana dan panel kanan untuk informasi prioritas. Princes menerapkan susunan tersebut pada dashboard laptop; HP memakai satu kolom, KPI 2×2, bottom navigation, dan daftar dengan aksi per item. Inisial menggantikan foto orang agar tidak menyiratkan bukti absensi.

Komponen implementasi: `Icon`, `Badge`, `Modal` (dialog native dengan focus trap/Escape), daftar responsif, form berlabel, CTA, menu mobile, grafik CSS dan halaman kondisi UI. Tidak ada paket tambahan. Data dan perubahan demo berada pada state browser dan hilang saat refresh.
