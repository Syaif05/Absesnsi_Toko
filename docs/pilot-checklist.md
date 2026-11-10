# Checklist penerimaan pilot

Status: **BELUM DIJALANKAN**. Seluruh kotak di bawah belum diterima. Pengujian UI/UX/perangkat ditunda sesuai instruksi pengguna. Jangan menandai lulus berdasarkan unit test/build atau liveness API.

Isi saat target dan jadwal pilot disepakati. Bukti berupa hasil/status/request ID; jangan lampirkan secret, PIN, foto wajah atau koordinat employee pada dokumen publik.

| Identitas penerimaan | Nilai |
|---|---|
| Tanggal dan penanggung jawab | Belum ditetapkan |
| Commit/tag kandidat dan URL HTTPS | Belum dipublikasikan |
| Akun/project Supabase milik penerima | Belum dikonfirmasi |
| Hosting/plan yang mengizinkan komersial | Belum dipilih |
| Toko pertama / toko kedua | Belum ditetapkan |
| Android/Chrome dan iPhone/Safari | Belum diuji |
| RPO/RTO, retensi foto/backup, kontak insiden | Belum disepakati |

## Sebelum melibatkan employee

- [ ] Akun hosting/DB/storage/domain dikuasai penerima; tidak memakai project development sebagai produksi.
- [ ] Migrasi clean tanpa seed; owner baru dibuat sekali dan secret bootstrap dibuang.
- [ ] Preflight technicalReady=true; hasil disimpan privat beserta commit/tanggal.
- [ ] HTTPS/domain final dan smoke API publik lulus, tidak ada port web/DB terbuka ke publik.
- [ ] Bucket privat JPEG terbatas, foto owner/employee sendiri terbaca dan employee lain ditolak.
- [ ] Backup terenkripsi di dua lokasi, key terpisah; native restore + foto pada target kosong diuji dengan waktu/RPO/RTO tercatat.
- [ ] Monitoring + penerima alarm serta kontak/operator pengganti sudah aktif.
- [ ] Privacy notice, retensi, aturan toleransi/radius, penolakan HR, sesi dan pemulihan owner disepakati.
- [ ] Penundaan pengujian UI dicabut dan jadwal tes/pilot disetujui pemilik.

## Penerimaan satu toko

- [ ] Owner dari HP menambah/edit toko dan radius, karyawan, ID login, reset PIN, nonaktif/reaktif tanpa developer mengedit kode.
- [ ] Owner publish jadwal normal/lintas malam, overlap ditolak; employee hanya melihat jadwal sendiri.
- [ ] PIN awal wajib diganti; ID/PIN salah ditolak; nonaktif/reset mencabut akses lama.
- [ ] Kamera HTTPS dan GPS nyata pada Android/iPhone; preview/retake, izin ditolak/akurasi buruk/coba lagi jelas.
- [ ] Check-in/out normal memakai waktu server, double tap/retry tidak menggandakan event.
- [ ] Luar radius/GPS gagal + alasan menjadi pending, check-out pending diperbolehkan, approval sah/ditolak tampil konsisten.
- [ ] Koreksi/missing check-out membutuhkan keputusan owner, bukti asli dan audit tetap ada.
- [ ] Offline/foto gagal/DB gagal tidak memberi sukses palsu; error membantu dan tidak membocorkan secrets.
- [ ] KPI/tanggal/laporan cocok dengan catatan pilot; pending tidak dihitung sebagai sah.
- [ ] Owner menyelesaikan seluruh tugas administratif pada HP; tidak ada overflow/aksi tersembunyi. Viewport 320/375/390/tablet/laptop ditinjau setelah penundaan dicabut.
- [ ] Kendala, penanggung jawab perbaikan dan hasil retest dicatat sebelum ekspansi.

## Toko kedua dan handover

- [ ] Seluruh skenario penting diulang pada toko kedua, perpindahan penugasan dan filter lintas toko benar.
- [ ] Kapasitas Supabase DB/Storage diperiksa, strategi pause/kuota/retensi dipahami operator.
- [ ] Pemilik menjalankan tutorial tanpa pendampingan kode, akses dan panduan telah diterima.
- [ ] Tidak ada data demo developer di produksi; data uji nyata dibersihkan hanya melalui prosedur aman yang disetujui.
- [ ] Akses developer ditinjau/dicabut; kandidat diterima dan release final ditag setelah semua blocker ditutup.

Keputusan akhir: **belum diterima untuk operasional**. Nama/tanggal pemilik dan operator, hasil tiap skenario serta daftar kekurangan wajib diisi kemudian. Jangan melanjutkan Fase 11 dari checklist kosong ini.
