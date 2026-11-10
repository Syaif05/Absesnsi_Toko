# Absensi selfie & GPS — checkpoint Fase 6

Halaman nyata: `/attendance`, dari `/account` atau `/my-schedule`. Halaman `/` tetap prototipe DEMO. Karyawan memerlukan akun aktif, PIN sementara yang sudah diganti, dan jadwal published. Owner yang dijadwalkan juga dapat absen miliknya sendiri.

## Perilaku

- Kamera depan langsung melalui getUserMedia; HTTPS atau localhost wajib. Ada preview, ambil ulang, penanganan izin, kamera tidak tersedia, GPS timeout/ditolak, dan coba lagi. Tidak ada input galeri.
- Canvas membatasi sisi terpanjang 960 px dan menurunkan kualitas JPEG menuju target ≤250 KB. Batas keras upload 512 KB. Server memeriksa MIME, signature, dimensi minimal 160 px, batas 4 megapixel (diperketat Fase 9), decode JPEG dengan sharp, resize dan re-encode untuk membuang EXIF/payload tambahan.
- GPS hanya diminta ketika pengguna membuka alur atau menekan coba GPS. Server menghitung Haversine dan status inside/outside/inaccurate/denied/unavailable terhadap snapshot toko jadwal, bukan toko asal employee atau radius dari client.
- Check-in tersedia dalam interval published `[starts_at, ends_at)`, termasuk shift lintas tanggal. Tidak ada check-in awal sebelum starts_at atau sesi tanpa jadwal; hubungi owner untuk penugasan. Jadwal/store aktif diperiksa server. Ini batas pencocokan jadwal Fase 6; jendela check-in awal belum menjadi pengaturan bisnis.
- Satu sesi per jadwal dan maksimal satu sesi terbuka per karyawan. Waktu berasal dari jam PostgreSQL sebelum upload, bukan waktu HP. Late memakai starts_at + grace_minutes pada snapshot. Bukti menyimpan tanggal penuh, aturan lokasi, nama toko dan jam jadwal saat check-in.
- Di luar radius, akurasi buruk, GPS ditolak/tidak tersedia: alasan minimal 5 karakter, event pending dan approval `location_exception` dibuat bersama sesi/audit dalam transaksi. Tercatat bukan berarti disetujui.
- Check-out menerima sesi sendiri termasuk check-in pending. Aturan/toko mengacu bukti check-in, sehingga perubahan jadwal, pemindahan toko, pembatalan jadwal, atau toko dinonaktifkan tidak menutup jalur pulang. Sesi completed hanya bila kedua event tidak pending/rejected; selain itu needs_review.
- Jika jam akhir jadwal sudah lewat dan checkout kosong, konteks menandai `missingCheckout:true`. Tidak ada pengisian waktu otomatis. Sesi lama tetap dapat diabsen pulang pada waktu server sebenarnya; perubahan waktu yang diklaim memerlukan koreksi fase berikutnya.
- Riwayat sendiri dipaginasi 20 event. Foto tidak ikut payload daftar; endpoint foto mengecek sesi aktif, business dan ownership/owner, lalu menerbitkan signed URL 60 detik. Akun lain/manager tidak mendapat akses lintas karyawan.

## Retry, transaksi dan foto yatim

POST menggunakan multipart: satu `metadata` JSON dan satu `photo` JPEG. Metadata `{idempotencyKey,scheduleId,location,reason}`. Location berbentuk `{status:"available",lat,lng,accuracyM}` atau `{status:"denied"|"unavailable"}`. Employee ID, waktu resmi, radius, jarak dan keputusan review tidak boleh dikirim client.

1. Buat jurnal upload durable (attendance_uploads) dalam transaksi autentikasi terpisah; simpan hash payload dan foto, path acak dan expiry 24 jam, tanpa biner foto.
2. Dalam transaksi kedua, lock employee dan jurnal, cek duplicate, sesi/jadwal, hitung lokasi, upload privat, lalu simpan event/sesi/approval/audit dan completed sekaligus. Lock jadwal mencegah perubahan bersamaan selama pencatatan.
3. Upload gagal tidak menghasilkan sesi/event berhasil. DB gagal sesudah upload menyisakan jurnal pending untuk path yang dapat ditemukan. Retry payload identik menimpa path yang sama; payload berbeda dengan kunci sama ditolak 409.
4. Jika response hilang setelah commit, retry mengembalikan event lama, tanpa upload/event/approval baru. UI mempertahankan foto, metadata dan kunci selama hasil belum pasti. Jangan tutup/refresh halaman ketika mencoba ulang; foto tidak disimpan ke localStorage. Setelah refresh, lihat riwayat dan konteks server.
5. Maksimal 20 kunci pengiriman baru per karyawan per jam, termasuk percobaan gagal setelah jurnal dibuat. Retry kunci yang sudah ada tetap dapat menyelesaikan transaksi.
6. Jalankan `pnpm storage:reconcile` secara berkala oleh operator (mis. harian). Memproses maksimal 50 jurnal pending lewat 24 jam, memakai lock yang sama dan SKIP LOCKED, serta mengecek tidak ada event yang mereferensikan path sebelum menghapus objek. Jurnal completed/bukti sah tidak dihapus. Belum ada scheduler otomatis.

## Menyiapkan database dan Storage

Environment server: DATABASE_URL PostgreSQL, APP_BUSINESS_ID, SESSION_SECRET, APP_BASE_URL, STORAGE_DRIVER=supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET=attendance-photos. Service key tidak masuk bundle browser.

```sh
pnpm db:migrate
pnpm storage:setup
pnpm dev
```

`storage:setup` membuat bucket bila belum ada: public=false, JPEG saja, maksimal 524288 byte. Bucket existing public ditolak; script tidak mengganti konfigurasi bucket public secara diam-diam. Adapter memeriksa private sebelum upload/sign. Alternatif SQL setup bucket tersedia di `supabase/sql/002_storage_private.sql`, terpisah dari skema PostgreSQL aplikasi.

Migrasi incremental baru `drizzle/0006_attendance_uploads.sql`: jurnal upload RLS + unique idempotency + indeks expiry/rate limit/riwayat/foto dan unique sesi per jadwal. File `supabase/sql/001_schema_all.sql` berisi seluruh skema sampai Fase 6 untuk database **kosong** saja. Jangan tempel file gabungan ke database existing. Migrasi 0006 tidak menghapus data; indeks unik akan menolak pemasangan bila data lama memiliki sesi ganda, sehingga perlu diperiksa operator.

`pnpm storage:check` mengunggah gambar persegi polos sintetis ke path UUID acak tanpa referensi absensi, memeriksa signed read dan akses publik ditolak, lalu menghapus objek dalam finally. Script tidak menggunakan foto wajah. Tidak mencetak key atau signed URL.

## Privasi dan batas

Foto dipakai hanya untuk bukti absensi; akses employee sendiri dan owner dalam usaha yang sama. Tidak ada face recognition, liveness, atau jaminan GPS asli. Kamera dan GPS browser dapat dimanipulasi; validasi di sini memeriksa format dan aturan, bukan identitas biometrik.

Retensi foto sah/audit dan prosedur penghapusan harus disepakati owner sebelum pilot. Cleanup 24 jam di atas hanya menangani upload yang tidak menjadi bukti; belum menghapus bukti absensi berdasarkan usia. Permintaan akses/penghapusan diarahkan ke owner. Otomasi retensi bukti dan backup tetap pekerjaan operasional berikutnya.

## Verifikasi 10 November 2026

- `pnpm test:server`: 66 tes PostgreSQL/API, tanpa direktori tests/ui. Kasus baru termasuk normal masuk/pulang, toleransi, pending empat penyebab GPS, alasan, upload gagal, DB gagal setelah upload, retry/double submit, missing checkout, jadwal/ownership, sesi dicabut/nonaktif/PIN sementara, foto palsu/EXIF, CSRF/batas body, rate limit dan rekonsiliasi.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: diperiksa pada checkpoint. PGlite adalah PostgreSQL terisolasi untuk tes, bukan pengganti database aplikasi. Native PostgreSQL multikoneksi belum diuji. Saat ini upload berada dalam transaksi final untuk menjaga lock jadwal/employee hingga bukti tersimpan; dua panggilan Storage dibatasi timeout masing-masing 15 detik. Ini menahan perubahan pada employee/jadwal yang sama saat upload; evaluasi pemisahan upload dengan lease bila beban pilot meningkat.
- Bucket privat berhasil dibuat melalui API Storage Supabase di project absensi kita; tanpa data employee atau foto orang. Hasil smoke check dicatat di phase-progress.md.
- Migrasi 0006 **belum diterapkan ke cloud**: konektor Supabase gagal transport dan direct DATABASE_URL gagal DNS ENOTFOUND pada hostname db.zeegtujueffpmrymnoxu.supabase.co. Cloud terakhir terverifikasi sampai 0005; runtime database tetap perlu koneksi yang dapat dijangkau (misalnya Session pooler dari dashboard Connect).
- Bootstrap owner operasional tetap belum dijalankan. Alur browser/perangkat fisik dan seluruh pengujian UI/UX **sengaja tidak dijalankan** sesuai instruksi pengguna, termasuk tests/ui dan screenshot. Acceptance perangkat ditunda, bukan diklaim lulus.
- Keputusan approve/reject dan koreksi waktu ditambahkan Fase 7; lihat approvals.md. GitHub tidak dipush.
