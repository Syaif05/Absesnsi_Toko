# Fase 7 — Persetujuan dan koreksi absensi

Karyawan membuka `/my-approvals` dari halaman `/attendance`. Owner membuka `/owner/approvals` dari pengelolaan usaha. Owner yang mempunyai jadwal sendiri juga dapat mengajukan melalui `/my-approvals`.

## Pengajuan dan keputusan

- Pengecualian lokasi tetap dikirim bersama selfie/GPS melalui alur Fase 6, lalu otomatis masuk inbox sebagai location_exception pending. Tercatat bukan berarti disetujui. Endpoint POST approvals dapat memulihkan workflow untuk event pending milik sendiri; bila permintaan otomatis sudah ada, respons memakai permintaan yang sama.
- Koreksi waktu memilih jadwal milik sendiri: published yang sudah dimulai, atau jadwal historis dengan sesi meski kemudian dibatalkan. Pilih jam masuk/pulang, tanggal penuh, dan alasan 5–1000 karakter. Mendukung shift lintas tanggal dan timezone snapshot jadwal (Jakarta/Makassar/Jayapura), tanpa mengandalkan zona perangkat.
- Hanya check_in_at/check_out_at yang dapat diajukan. Tidak menerima employeeId, storeId, status resmi, GPS pengganti atau foto pengganti dari client. Waktu masa depan, jam pulang sebelum masuk, perubahan tanpa nilai berbeda dan field berulang ditolak. Jam masuk wajib ada bila mengisi jam pulang. Mengosongkan waktu resmi bukan bagian workflow ini.
- Satu koreksi waktu pending per jadwal. Sebelum disetujui, jam resmi tidak berubah. Request key dan hash input menangani retry; retry identik mengembalikan hasil lama (termasuk bila owner sudah memutuskan), bukan membuat permintaan baru. Key sama dengan data berbeda ditolak 409.
- Owner melihat alasan, waktu pengajuan server, jadwal/snapshot toko, waktu resmi terkini, nilai sebelum/diminta/diterapkan, event server asli, selfie privat, koordinat, akurasi, jarak dan status lokasi/review. Foto memakai endpoint otorisasi Fase 6 dengan signed URL 60 detik, tidak ada service key di frontend.
- Setujui/Tolak membuka konfirmasi dalam halaman dengan checkbox pemeriksaan dan catatan wajib 3–1000 karakter. Hanya owner satu usaha yang dapat memutuskan. Keputusan final, satu kali, dan memiliki reviewer serta waktu server. Permintaan/status milik karyawan lain atau usaha lain tidak dapat dibaca employee/manager.

## Catatan resmi dan bukti asli

Koreksi yang disetujui mengubah waktu **efektif pada attendance_sessions**, mengisi applied_value dan provenance is_corrected; tidak mengubah attendance_events.recorded_at, selfie, GPS, alasan atau snapshot asli. Audit menyimpan before/after. Riwayat kamera di `/attendance` tetap memperlihatkan waktu pengiriman asli; hasil koreksi dan waktu efektif tersedia pada detail `/my-approvals`.

Session menyimpan snapshot aturan sendiri agar koreksi missing check-in tidak bergantung pada event kamera yang tidak pernah ada. Bila sebelumnya tidak ada sesi, approval membuat sesi corrected berdasarkan waktu yang diminta; **tidak** membuat event/foto/GPS fiktif. Sesi corrected yang masih terbuka dapat diabsen pulang menggunakan kamera dan snapshot yang tersimpan. Missing checkout tetap kosong sampai pengajuan disetujui atau checkout nyata dilakukan.

Status sesi diturunkan konsisten: event pending/rejected → needs_review; jika tidak ada dan pernah dikoreksi → corrected; selain itu checkout terisi → completed; lainnya open. Status corrected tidak menentukan sesi tertutup: check_out_at tetap menjadi patokan. Koreksi waktu tidak menyetujui/meniadakan review lokasi. Late dihitung dari waktu efektif dan toleransi snapshot pada detail koreksi; waktu bukti asli tetap ada.

Permintaan menyimpan baseline kedua waktu serta UUID sesi. Bila ada checkout nyata atau koreksi lain yang mengubah baseline, approval ditolak 409. Owner harus menolak permintaan lama dan karyawan mengajukan ulang agar nilai terbaru ditinjau. Untuk pengajuan tanpa sesi, versi/status jadwal juga diperiksa saat approval. Perubahan aturan sesudah check-in tidak menafsirkan ulang snapshot bukti historis.

## Atomicity dan concurrency

Keputusan, perubahan review event atau waktu efektif, applied_value, status sesi dan audit berada dalam satu transaksi. Kegagalan audit membatalkan seluruh perubahan. Identitas owner dicek ulang setelah menunggu lock. Urutan lock: employee owner/requester diurutkan UUID → jadwal → sesi → permintaan → event/correction. Ini menyelaraskan keputusan dengan alur absensi dan menghindari pertukaran urutan antar-owner atau foreign key employee saat membuat sesi missing check-in.

Unique index membatasi satu koreksi waktu pending per jadwal dan satu workflow lokasi per event. Permintaan yang sudah diputuskan menghasilkan 409 bila dicoba lagi. Trigger database menjaga bukti asli, isi pengajuan dan histori koreksi tidak dapat ditimpa/dihapus lewat CRUD; event review hanya pending → approved/rejected. Audit tetap append-only. Penghapusan menurut retensi memerlukan prosedur operator terpisah, bukan endpoint biasa.

Pembatasan persisten per actor: 20 percobaan pengajuan baru per 15 menit dan 60 percobaan keputusan per 15 menit. Retry koreksi dengan key yang sudah tersimpan diperiksa sebelum limit dan tidak menambah quota. Counter keputusan tetap tersimpan walaupun keputusan gagal/target tak ditemukan. Respons tidak berisi credential, photo_path, atau stack trace.

## API

- GET/POST `/api/v1/approvals` — daftar/pengajuan. Query `view=mine|inbox`, `status=all|pending|approved|rejected`, `type=attendance_correction|location_exception`, `storeId?`, `offset=0`. Owner default inbox; peran lain default mine. Inbox memerlukan owner. Pagination 20 baris `{items,hasMore,nextOffset}`.
- GET `/api/v1/approvals/:id` — detail scoped employee sendiri atau owner satu usaha.
- POST `/api/v1/approvals/:id/decision` — `{status:"approved"|"rejected",note,confirmed:true}`, owner saja.
- GET `/api/v1/me/correction-targets?offset=0` — jadwal sendiri yang sah untuk pengajuan, 20 per halaman, waktu resmi dan timezone.

POST koreksi: `{type:"attendance_correction",requestKey:UUID,scheduleId:UUID,reason,changes:[{field:"check_in_at"|"check_out_at",value:ISO8601}]}`. ISO8601 harus bertanda Z atau offset; server menormalisasi UTC. Maksimal dua perubahan unik.

POST recovery exception: `{type:"location_exception",requestKey:UUID,eventId:UUID,reason}`. Event harus milik sendiri dengan review pending dan lokasi bukan inside. Bukti baru tetap harus lewat alur selfie/GPS Fase 6.

Seluruh write menggunakan JSON, batas body 4096 byte dan Origin sama dengan APP_BASE_URL, cookie sesi aktif dan PIN sementara yang sudah diganti. Semua respons no-store. 400 invalid/konfirmasi, 401 sesi, 403 role/CSRF, 404 resource di luar scope, 409 pending/keputusan/baseline/constraint conflict, 429 limit, 503 infrastruktur. Jika hasil jaringan tidak pasti, muat ulang detail/daftar atau retry pengajuan dengan key yang sama; jangan menampilkan keputusan lokal seolah tersimpan.

## Migrasi dan menjalankan

Migrasi baru `drizzle/0007_approval_corrections.sql` menambahkan request key/hash/context, is_corrected/snapshot sesi, indeks, dan trigger histori. Backfill snapshot dari event check-in yang sudah ada mempertahankan bukti. Jumlah tabel tetap 18 dan RLS tetap aktif. Migrasi tidak menghapus data. Indeks unik menolak pemasangan bila ada workflow lama duplikat; periksa dan selesaikan dengan prosedur terkontrol, jangan menghapus histori otomatis.

```sh
pnpm db:migrate
pnpm dev
```

Untuk database Supabase baru kosong, `supabase/sql/001_schema_all.sql` sudah mencakup Fase 7 dan jurnal Drizzle. Jangan menjalankan ulang file gabungan pada database existing. Gunakan DATABASE_URL PostgreSQL yang dapat dijangkau; Session pooler dari Connect dapat dipakai bila direct hostname/IPv6 tidak tersedia. Bootstrap akun owner dan konfigurasi bisnis/jadwal mengikuti panduan fase sebelumnya.

## Verifikasi checkpoint

`pnpm test:server`: **92 tes backend** (66 regresi + 26 approval/koreksi) lulus. Mencakup pending/approved/rejected, dua owner mencoba memutuskan, idempotency, missing check-in/out, aturan checkout setelah koreksi, stale baseline/versi jadwal, rollback audit, histori immutable, timezone, rate limit, CSRF/konfirmasi dan akses lintas employee/role/bisnis. Pengujian memakai PostgreSQL PGlite terisolasi; Promise.allSettled memverifikasi duplikasi di adapter tes, belum merupakan stress test native PostgreSQL multikoneksi. Binary postgres/Docker tidak tersedia pada lingkungan ini.

Lint, TypeScript, build produksi dan SQL gabungan fresh database diperiksa. **Tidak menjalankan tests/ui, browser, screenshot atau uji perangkat/UI/UX**, sesuai instruksi pengguna. Penerimaan UI/perangkat tetap ditunda.

Cloud belum diperbarui: direct DB masih ENOTFOUND dan konektor Supabase gagal transport pada pemeriksaan Fase 7. Migrasi 0006 dan 0007 masih pending di cloud; terakhir terverifikasi sampai 0005. Bucket privat Fase 6 tidak diubah. Belum ada bootstrap akun owner operasional; tidak ada seed atau data karyawan di cloud. GitHub tidak dipush, dan Fase 8 belum dikerjakan.
