# Progres fase

## Fase 0 — Audit kebutuhan, setup, dan desain teknis

- [x] Baca PRD lengkap dan audit isi repository.
- [x] Kerangka Next.js, TypeScript strict, lint, token desain mobile, halaman status setup.
- [x] `.env.example`, pemeriksaan format ENV, dan script cek koneksi PostgreSQL.
- [x] Keputusan arsitektur, desain, dan README setup lokal.
- [ ] Database development dapat dihubungi. Ditunda atas arahan pemilik (9 November 2026).
- [ ] Review gambar referensi asli. File belum tersedia.

Pemeriksaan 9 November 2026: `pnpm lint`, `pnpm typecheck`, `pnpm env:check`, dan `pnpm build` lulus; `pnpm dev` merespons HTTP 200 pada `/`. `pnpm db:check` gagal terkontrol karena `DATABASE_URL` kosong, bukan karena error aplikasi. Tampilan setup dicek pada 320×568, 375×812, 390×844, 768×1024, dan 1440×900; `scrollWidth` sama dengan lebar viewport. Perbandingan gambar referensi belum dilakukan.

Keputusan: pakai root `AbsenToko` yang sudah berisi PRD; Git lokal dipakai untuk checkpoint, GitHub ditunda. Supabase project baru dan data disiapkan kemudian. Tidak memakai project TimSAPA yang terhubung.

Risiko: tanpa koneksi DB, acceptance Fase 0 belum lengkap. Karena gambar referensi belum ada, kemiripan visual tidak dapat dinilai. Fase 1 belum dimulai.

Pekerjaan berikutnya pada Fase 0 jika prasyarat tersedia: tempatkan gambar di `docs/reference/dashboard-reference.png`, buat project Supabase development khusus Princes, isi `.env.local`, jalankan `pnpm db:check`, lalu review hasil. Lanjut Fase 1 hanya setelah instruksi pemilik.

## Fase 1 — Design system & prototipe UI

Status: prototipe tersedia untuk review. Pemilik menginstruksikan lanjut pada 9 November 2026 dan melampirkan referensi. Koneksi database dan GitHub tetap ditunda sesuai instruksi sebelumnya.

- [x] Referensi gambar disimpan dan observasi visual diperbarui.
- [x] Login demo; beranda, jadwal, riwayat/koreksi dan profil/PIN karyawan dalam simulasi browser.
- [x] Dashboard owner, daftar absensi, persetujuan dengan konfirmasi, karyawan, toko, jadwal/template, pengaturan, laporan dan audit visual.
- [x] Editor demo, nonaktif/aktif, ubah ID, konfirmasi reset PIN; kontrol tanpa tabel horizontal.
- [x] Kondisi normal, loading, kosong, error dan denied bisa dipilih pada panel owner; pesan sukses demo.
- [x] Screenshot karyawan dan owner pada 320/375/390/768/1440 tersimpan di `docs/screenshots/`. Lebar halaman sama dengan viewport pada sepuluh pemeriksaan.
- [x] Browser mobile: tambah toko ketiga, edit ID, buka konfirmasi reset PIN, tampilkan error.
- [x] Lint, typecheck dan build lulus.

File utama: `src/components/attendance-demo.tsx`, `demo-data.ts`, `ui.tsx`, `src/app/page.tsx`, `globals.css`, gambar referensi dan screenshot, README serta catatan desain/progres.

Batasan: semua data fiktif; form adalah simulasi, bukan validasi/penyimpanan bisnis. Kamera/GPS, autentikasi, PIN nyata, upload foto, audit permanen dan database belum aktif. Tanggal dan data grafik tetap untuk demo; tombol hari pada jadwal memberi pratinjau pilihan, belum memfilter kalender riil. Belum diuji pada perangkat fisik Android/iPhone, jaringan lemah, atau pembaca layar. Screenshot adalah pemeriksaan browser, bukan klaim pixel-perfect.

Cara review: `pnpm dev`, buka localhost:3000, gunakan pemilih tampilan demo di atas dan Menu pada HP. Pada owner, buka Karyawan/Toko/Jadwal untuk mencoba editor; gunakan pemilih kondisi UI untuk loading/empty/error/denied. Refresh mereset perubahan. Fase berikutnya menunggu instruksi pemilik; tidak ada migrasi yang dijalankan.

## Fase 2 — Skema, migrasi, repository

- [x] 14 tabel PostgreSQL privat, UUID/FK, timestamps UTC, constraints dan indeks inti.
- [x] Migrasi Drizzle versioned dari database kosong; exclusion constraint jadwal published dan snapshot aturan.
- [x] Repository dengan filter business; edit ID mempertahankan UUID dan histori.
- [x] Seed development guarded dan idempotent: 2 toko, 8 karyawan, 1 profil Owner Reza DEMO nonaktif tanpa kredensial, 2 template, 8 jadwal, 3 sesi dan 6 event contoh tanpa foto nyata.
- [x] Delapan tes integrasi PostgreSQL in-memory lulus; lint/typecheck/build lulus.
- [x] ERD dan petunjuk migrasi/seed di `docs/database.md`.
- [ ] Supabase cloud: pemilik memilih melewati pembuatan project. Tidak mengubah TimSAPA.

UI tetap prototipe Fase 1. PGlite dipakai untuk tes, bukan mengganti database aplikasi. Akun owner yang bisa login/bootstrap belum dibuat karena termasuk Fase 3. Pengujian role Supabase, koneksi aplikasi cloud, dan concurrency multikoneksi belum dilakukan. Tidak ada migrasi destruktif atau kredensial yang ditambahkan ke Git.

GitHub: origin disetel ke https://github.com/ownerreza/absensi_kita.git. Push ditolak HTTP 403 pada 9 November 2026. Git CLI dan konektor menggunakan Syaif05; metadata repository menyatakan `push=false`. Pemilik perlu memberikan akses Write atau masuk menggunakan akun dengan izin menulis sebelum push dapat diulang. Remote belum menerima source code.
