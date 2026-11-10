# Fase 8 — Monitoring dan laporan dasar

Owner membuka `/owner/dashboard` dari akun; `/owner/reports` menampilkan riwayat. `/owner` tetap pengelolaan toko/karyawan/pengaturan, dan `/` tetap prototipe DEMO yang terpisah. Halaman monitoring nyata tidak mengimpor data demo dan tidak mengganti kegagalan database dengan angka contoh.

## Definisi angka

**Unit hitung adalah satu jadwal kerja**, dengan maksimal satu sesi per jadwal. Bukan jumlah event, bukan jumlah orang unik dan bukan jumlah permintaan. Dua event masuk/pulang tetap satu jadwal. Terdapat lima kategori yang tidak tumpang tindih, dengan prioritas berikut:

1. `rejected` / Ditolak: setidaknya satu bukti lokasi ditolak, termasuk bila bukti lain masih pending.
2. `pending` / Menunggu review: tidak ada yang ditolak dan setidaknya satu event masih pending.
3. `valid` / Sah: tidak ada pending/rejected dan jam masuk resmi tersedia. Mencakup event tanpa review, lokasi disetujui dan koreksi waktu yang sudah disetujui, termasuk sesi terbuka.
4. `upcoming` / Belum dimulai: belum ada waktu masuk dan mulai jadwal masih di masa depan.
5. `not_recorded` / Belum tercatat: belum ada waktu masuk dan jadwal sudah dimulai.

`total = valid + pending + rejected + upcoming + notRecorded`. `recorded = valid + pending + rejected`. `employees` menghitung UUID orang unik pada jadwal terpilih, termasuk owner yang dijadwalkan; bukan menjumlahkan per-toko yang dapat berisi orang sama.

Permintaan menunggu adalah metrik terpisah: jumlah request pending yang berkaitan dengan jadwal terpilih. Koreksi pending tidak mengubah waktu/status resmi, sehingga absensi sah dapat mempunyai permintaan koreksi pending. Satu shift dapat mempunyai dua exception pending (masuk dan pulang); KPI shift pending tetap satu.

Terlambat dan missingCheckout adalah penanda tambahan, bukan kategori tambahan. Terlambat memakai jam masuk resmi efektif > starts_at snapshot + grace_minutes snapshot. Missing checkout berarti jam masuk ada, jam pulang kosong dan waktu server telah melewati akhir shift snapshot; tidak mengisi jam pulang otomatis. Penanda ini dapat muncul pada absensi pending/rejected dan diberi label sebagai waktu yang tercatat, bukan klaim kehadiran sudah disetujui.

## Tanggal, toko dan histori

Filter memilih 1–31 hari; tanggal akhir pada UI inklusif. API menggunakan from inklusif dan to **eksklusif**, ditafsirkan dalam timezone bisnis. Nama scope/filter dan waktu pembaruan berasal dari server, agar draft form yang belum diterapkan tidak disalahartikan sebagai laporan baru.

KPI dan riwayat berdasarkan tanggal mulai shift. Jika sudah ada absensi, timestamp mulai/akhir dari snapshot sesi menjadi patokan sehingga edit jadwal sesudah hadir tidak memindahkan catatan lama atau menafsirkan ulang keterlambatan. Shift 20.00–05.00 dihitung sekali pada tanggal mulai. Aktivitas menggunakan waktu kejadian asli (recorded_at/created_at/decided_at), sehingga checkout shift malam dapat muncul di hari berikutnya tanpa menggandakan KPI.

Toko mengikuti penugasan jadwal, bukan toko asal employee. Jadwal published dan semua jadwal yang sudah memiliki sesi dihitung; draft/cancelled tanpa sesi tidak dihitung. Pembatalan jadwal sesudah hadir serta nonaktif employee/toko tidak menghapus histori. Toko ketiga dan berikutnya muncul dari database tanpa angka toko tetap di kode. Daftar status toko juga menampilkan toko tanpa jadwal dengan angka nol, dipaginasi 20 toko.

Riwayat menggunakan waktu efektif sesi; detail menampilkan event waktu server, foto, GPS, alasan dan snapshot asli serta histori koreksi/approval dan radius/koordinat/toleransi snapshot yang tidak berubah ketika toko diedit. Jam efektif hasil koreksi tidak mengganti bukti asli. Koreksi tanpa event kamera tidak memperoleh foto/GPS fiktif. Foto diminta hanya saat tombol Tampilkan selfie dipilih, melalui otorisasi dan signed URL Fase 6; path storage dan service key tidak ada di response laporan.

## Halaman dan pemuatan

- Dashboard: lima KPI, penanda terlambat/belum pulang, jumlah permintaan pending, rekap harian untuk rentang lebih dari sehari, status toko, serta aktivitas masuk/pulang/pengajuan/keputusan terbaru.
- Laporan: filter toko/tanggal, filter kategori pada baris riwayat, ringkasan per karyawan, detail sesi dan histori permintaan. KPI tetap mencakup semua kategori dalam scope toko/tanggal/karyawan; filter kategori hanya membatasi baris riwayat.
- Semua daftar memakai pagination 20 baris dan mengambil maksimal 21 untuk hasMore; daftar pilihan toko menggunakan endpoint CRUD berukuran 50 dengan pencarian serta muat halaman berikutnya. Tidak mengambil seluruh foto/data ke browser.
- Request ringkasan, riwayat/status toko dan aktivitas yang independen dimulai paralel di client; agregasi SQL memakai satu baris per jadwal sebelum menghitung (event terlebih dahulu direduksi). Tidak menjumlahkan raw join event/approval/correction.
- Pembaruan otomatis setiap 60 detik hanya saat tab terlihat, navigator online dan seluruh daftar berada di halaman pertama. Satu siklus tidak tumpang tindih. Saat tab terlihat kembali/koneksi online, refresh segera. Request dibatalkan ketika filter berubah/halaman ditinggal. Halaman lama memakai refresh manual agar polling tidak menggeser bacaan.
- Gagal polling memperlihatkan error dan menyebut data terakhir bila scope sama. Gagal memuat scope baru tidak menampilkan angka scope sebelumnya. Tidak ada status sukses palsu/offline success.
- Batas statement query reporting 8 detik, rentang maksimal 31 hari, tanpa polling cepat. Pagination offset dan urutan timestamp+UUID stabil untuk tie, tetapi bukan snapshot lintas request; aktivitas baru saat berpindah halaman dapat menggeser offset. Evaluasi cursor dan benchmark native PostgreSQL pada hardening bila volume meningkat.

## API dan otorisasi

| Method | Endpoint | Akses / fungsi |
|---|---|---|
| GET | `/api/v1/dashboard/summary` | Owner: KPI dan rekap harian |
| GET | `/api/v1/dashboard/stores` | Owner: status cabang paginated |
| GET | `/api/v1/dashboard/activity` | Owner: aktivitas berdasarkan waktu kejadian |
| GET | `/api/v1/attendance` | Owner: riwayat jadwal/sesi paginated |
| GET | `/api/v1/employees/:id/attendance` | Owner: profil minimal, KPI, riwayat karyawan |
| GET | `/api/v1/attendance/:sessionId` | Owner satu usaha / pemilik sesi: bukti asli dan histori permintaan |

Summary menerima `{from,to,storeId?,employeeId?}` melalui query. Stores/activity menambah offset; attendance menambah offset dan category=all/valid/pending/rejected/not_recorded/upcoming. Endpoint employee menerima from/to/storeId/offset/category, bukan employeeId yang menimpa ID path. Detail sesi menerima requestOffset untuk pagination histori permintaan. Daftar `{items,hasMore,nextOffset}`; summary memuat metrics, daily, pendingRequests, timezone, scope dan generatedAt server.

Sesi aktif, bisnis aktif dan PIN sementara yang sudah diganti wajib. Employee/manager tidak boleh membaca KPI/riwayat global; hanya detail sesi miliknya dapat diakses. UUID toko/employee di luar bisnis mengembalikan 404. Query tidak menerima identitas atau role untuk mengganti cookie. Semua respons no-store, error terstruktur tanpa credential/stack trace. Endpoint hanya GET; tidak ada mutasi laporan/ekspor payroll/CSV pada fase ini.

## Database dan menjalankan

`drizzle/0008_monitoring_indexes.sql` menambah indeks waktu kejadian, waktu mulai jadwal, target workflow dan keputusan approval. Tidak menambah tabel/kolom, tidak mengubah data atau izin; tabel tetap 18 dengan RLS. Snapshot/schema dan file gabungan `supabase/sql/001_schema_all.sql` sudah diperbarui sampai Fase 8, hanya untuk database baru kosong.

Setelah koneksi PostgreSQL dapat dijangkau:

```sh
pnpm db:migrate
pnpm dev
```

Login owner yang sah, buka `/owner/dashboard` atau `/owner/reports`. Buat toko/karyawan/publish jadwal melalui owner bila bisnis masih kosong. Bootstrap owner tetap melalui CLI sesuai panduan auth. Tidak ada seed produksi.

## Checkpoint

- `pnpm test:server`: **113 tes backend** (92 regresi + 21 reporting) lulus. Kasus baru meliputi hitung kategori sekali per shift, dua event/pending correction tidak menggandakan KPI, rejection precedence, scope toko/jadwal lintas toko, toko ketiga dan lebih dari 20 toko, waktu efektif tanpa event fiktif, shift malam, timezone/batas tanggal, snapshot jadwal yang diedit, histori nonaktif/cancelled, pagination event/history/request, HTTP read-only/no-store dan akses role/bisnis/ownership.
- Lint, TypeScript dan build produksi diperiksa. SQL gabungan dimigrasikan ke database kosong oleh tes regresi. Query diuji pada PostgreSQL PGlite terisolasi, bukan fallback aplikasi.
- **Tidak menjalankan tests/ui, browser, screenshot, uji viewport/perangkat atau UI/UX**, sesuai arahan pengguna. Perilaku polling/responsivitas belum diverifikasi di browser; native PostgreSQL multi-koneksi dan benchmark volume besar juga belum dijalankan. Penerimaan mobile/laptop ditunda, bukan diklaim lulus.
- Direct DATABASE_URL masih gagal ENOTFOUND pada pemeriksaan Fase 8. Migrasi cloud 0006–0008 belum diterapkan; terakhir terverifikasi sampai 0005, dan konektor terakhir gagal transport pada fase sebelumnya. Bucket privat tidak diubah. Tidak ada data demo, karyawan atau foto cloud baru. GitHub tidak dipush, Fase 9 belum dimulai.
