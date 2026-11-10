# Draf operasional privasi — perlu keputusan pemilik sebelum pilot

Dokumen ini bahan review pemilik, bukan pernyataan kepatuhan hukum atau kebijakan yang otomatis aktif. PRD mengharuskan review privasi Indonesia sebelum operasional; keputusan dasar pemrosesan, transparansi, retensi dan penanganan hak karyawan harus ditetapkan pemilik dengan pihak yang kompeten.

Data yang dikumpulkan: identitas/ID kerja, penugasan dan jadwal, waktu server absensi, selfie bukti, koordinat dan akurasi GPS saat pengiriman, jarak/status lokasi, alasan pengecualian/koreksi, keputusan dan audit administrasi. Izin kamera/GPS browser menjelaskan akses perangkat, bukan pengganti penjelasan kebijakan penyimpanan bisnis.

Tujuan produk: pencatatan kehadiran dan review bukti/permintaan terkait. Tidak ada face recognition/liveness, payroll, pelacakan GPS terus-menerus atau janji anti-spoof. Karyawan melihat datanya sendiri; owner usaha melihat data dalam bisnisnya. Manager belum memiliki akses administrasi lintas employee. Operator berizin dan penyedia database/storage dapat menangani infrastruktur sesuai kontrak/akses yang disetujui pemilik.

Foto disimpan pada bucket privat, URL baca singkat diberikan setelah otorisasi. URL expiry tidak menarik kembali file yang sudah terunduh/tersimpan di perangkat. Jangan membagikan tautan/foto di kanal umum. Kredensial provider tetap di ENV server, bukan dashboard owner. Backup terenkripsi tetap sensitif dan membutuhkan key terpisah serta akses operator terkontrol.

Keputusan yang harus diisi pemilik sebelum pilot:

- Nama penanggung jawab dan kontak pengaduan/permintaan akses/perbaikan/penghapusan data: **belum ditetapkan**.
- Dasar, pemberitahuan penggunaan dan cakupan akses data karyawan: **belum disetujui pemilik**.
- Durasi retensi selfie, GPS, absensi, audit dan backup serta pengecualian penyimpanan: **belum ditetapkan**. Angka 90 hari dalam PRD adalah usulan, bukan kebijakan aktif.
- Prosedur verifikasi identitas pemohon, penanganan insiden, siapa yang boleh mengekspor/memulihkan/menghapus, batas waktu tindak lanjut dan pencatatan keputusannya: **belum ditetapkan**.

Sistem saat ini hanya menyediakan cleanup upload gagal yang lewat 24 jam; itu bukan retensi bukti sah. Penghapusan bukti asli/audit sengaja tidak tersedia melalui CRUD. Otomasi retensi sah dan prosedur penghapusan berizin masih harus dibuat/disepakati sebelum pemakaian nyata. Jangan memakai data karyawan nyata untuk menggantikan pengujian fiktif yang belum selesai.
