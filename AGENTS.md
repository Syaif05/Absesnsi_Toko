# PRD — PRINCES Attendance

> **Dokumen master pengembangan berbantuan AI (100%)**  
> Versi: **1.1** · Tanggal: **9 November 2026** · Status: **Revisi: Supabase Free + Vercel Hobby untuk demo; mobile-first mutlak**  
> Bahasa aplikasi: **Indonesia** · Zona waktu default: **Asia/Jakarta**  
> Target: **Usaha Princes (awal 2 toko; jumlah toko/karyawan tidak dibatasi di kode)**

---

## 0. Cara menggunakan dokumen ini

Dokumen ini menjadi **sumber kebenaran produk (single source of truth)** bagi AI coding assistant. AI harus membaca seluruh dokumen sebelum membuat kode, **namun mengerjakan hanya satu fase per instruksi**. Jangan membuat fitur fase berikutnya sebelum fase saat ini lulus acceptance criteria, tes, dan disetujui pengguna.

**Langkah awal di laptop pengembang:**

1. Buat folder proyek `princes-attendance/` dan simpan file ini di `docs/PRD_PRINCES_Attendance.md`.
2. Simpan gambar referensi yang diberikan pemilik proyek di `docs/reference/dashboard-reference.png`. **Gambar hanya referensi visual, bukan data maupun blueprint yang harus disalin 1:1.**
3. Buka folder dalam VS Code/Codex/AI coding assistant. Minta AI membaca dokumen ini dan hanya mengerjakan **Fase 0** (§20). Tidak ada prompt siap salin di PRD; fase dan kriteria penerimaannya adalah spesifikasi kerja.
4. Setiap fase wajib berhenti pada checkpoint, melaporkan file berubah, tes yang dijalankan, hasilnya, risiko, dan instruksi menjalankan hasil.
5. Gunakan Git dan commit setiap fase yang lulus. Jangan menjalankan migrasi destruktif atau mengganti konfigurasi produksi tanpa persetujuan.

### Prioritas keputusan jika terjadi konflik

1. Keamanan, integritas data, dan privasi karyawan.
2. Aturan bisnis dan acceptance criteria pada PRD ini.
3. Pengalaman mobile-first untuk karyawan **dan owner**, performa dan kesederhanaan operasional.
4. Konsistensi desain sesuai referensi gambar.
5. Preferensi implementasi teknis; AI boleh mengusulkan alternatif dengan alasan, tetapi **tidak mengganti stack diam-diam**.

### Definisi istilah

- **Owner**: pemilik usaha, punya hak administrasi bisnis semua toko.
- **Manager**: kepala toko (opsional fase berikut), akses terbatasi per toko.
- **Employee**: karyawan, hanya data dan tindakan miliknya.
- **Check-in / Check-out**: absen masuk / absen pulang.
- **Exception**: absensi di luar aturan, misalnya GPS di luar radius, membutuhkan review.
- **Correction**: permintaan memperbaiki catatan waktu/status absensi, tidak menghapus bukti asli.
- **MVP**: versi minimal yang layak dipakai.

---

## 1. Latar belakang dan sasaran

Usaha Princes mula-mula memiliki dua toko dan beberapa karyawan. Seluruh karyawan menggunakan **HP** untuk absen masuk/pulang melalui **selfie**. Owner memantau dari **HP dan laptop**, serta mengatur hampir seluruh proses bisnis tanpa meminta pengembang mengubah kode.

**Sasaran utama:**

- Pengalaman karyawan: login **ID karyawan + PIN**, melihat jadwal, selfie + lokasi, berhasil mencatat absensi dalam alur singkat.
- Pengalaman owner: memantau ringkasan lintas toko, mengatur toko/karyawan/jadwal/aturan/akun, memproses approval, dan membaca riwayat/audit.
- Aplikasi **ringan, responsif, mobile-first, mudah dipelihara**.
- Proyek dibangun dahulu di laptop developer dengan **data contoh**, lalu dipindahkan ke infrastruktur milik teman/pemilik usaha **tanpa mengubah source code inti**.
- Sistem mendukung pertambahan toko, karyawan, dan shift tanpa hardcode angka "2 toko".

### Bukan sasaran MVP

Payroll/gaji, face recognition/biometrik AI, pelacakan GPS terus-menerus, aplikasi Android/iOS native, integrasi WhatsApp otomatis, multi-tenant untuk banyak perusahaan, mode offline yang mengklaim absensi berhasil tanpa server, dan notifikasi push wajib.

### Ukuran keberhasilan

- Owner dapat menambah toko/karyawan, mengubah aturan dan jadwal **tanpa edit kode**.
- Semua aksi sensitif melewati otorisasi server dan tercatat dalam audit.
- Data untuk dua toko dapat dipantau dari satu dashboard; filter per toko/tanggal.
- Karyawan tidak dapat membaca/mengubah data karyawan lain.
- Kegagalan selfie, GPS, dan internet memiliki pesan jelas; tidak ada sukses palsu.
- Dashboard dan PWA berjalan baik pada HP layar sempit dan laptop.

---

## 2. Keputusan produk yang terkunci

1. **Lokasi fleksibel**: default absen di radius toko yang menjadi penugasan shift; di luar radius tetap dapat **mengirim permohonan pengecualian** dengan foto, lokasi, dan alasan; status `pending` sampai owner menyetujui/menolak.
2. **Jadwal fleksibel**: jadwal harian/mingguan dapat berubah, karyawan bisa membantu toko lain, shift bisa melewati pergantian tanggal.
3. **Login karyawan ID + PIN**: owner membuat ID dan PIN awal, karyawan wajib mengganti PIN sementara saat login pertama; PIN tersimpan **hash**, bukan plaintext. Owner boleh **mengubah ID** dan **mereset PIN**, tetapi **tidak boleh melihat PIN lama**.
4. **Koreksi approval**: karyawan mengajukan koreksi, owner review; perubahan resmi dilakukan hanya setelah disetujui, dengan histori sebelum/sesudah yang tidak hilang.
5. **Owner fleksibel**: toko, karyawan, penugasan, jadwal, radius, toleransi, alasan dan status yang diizinkan, serta pengaturan branding dasar dapat dikelola dari panel owner.
6. **Konfigurasi infrastruktur terpisah**: pemilik tidak memasukkan kredensial database atau kunci API sembarangan di dashboard. Penggantian penyedia DB/storage/domain dilakukan lewat `ENV` / prosedur deployment yang aman.
7. **Penyedia yang dipilih**: **Supabase Free** untuk PostgreSQL dan foto (Supabase Storage), serta **Vercel Hobby/Free untuk deployment pengembangan, preview, dan demo nonkomersial**. Vercel Hobby tidak boleh diasumsikan legal untuk penggunaan operasional bisnis; sebelum dipakai usaha secara nyata, pilih hosting dengan izin komersial.
8. **Mobile-first sebagai aturan utama**: seluruh halaman, **termasuk dashboard owner dan seluruh fitur administrasi**, harus selesai dan lolos pengujian pada HP terlebih dahulu sebelum versi laptop dipoles.

---

## 3. Persona, peran, dan otorisasi

| Kemampuan | Owner | Manager (opsional) | Employee |
|---|---:|---:|---:|
| Login dan ganti PIN sendiri | ✓ | ✓ | ✓ |
| Lihat jadwal & absensi sendiri | ✓ | ✓ | ✓ |
| Selfie absen milik sendiri | ✓ jika dijadwalkan | ✓ | ✓ |
| Lihat data seluruh toko | ✓ | ✕ | ✕ |
| Lihat satu toko yang ditugaskan | ✓ | ✓ | ✕ |
| Tambah/edit/nonaktif toko | ✓ | ✕ | ✕ |
| Tambah/edit/nonaktif karyawan | ✓ | izin terbatas nanti | ✕ |
| Ubah ID karyawan | ✓ | ✕ | ✕ |
| Reset PIN karyawan | ✓ | ✕ | ✕ |
| Atur jadwal, lokasi, aturan | ✓ | terbatas nanti | ✕ |
| Approve/reject koreksi/exception | ✓ | terbatas nanti | ✕ |
| Ekspor laporan | ✓ | opsional | milik sendiri opsional |
| Lihat audit log | ✓ | ✕ | ✕ |

**Aturan RBAC**: menu yang tersembunyi **bukan** kontrol keamanan; setiap endpoint memvalidasi identitas, role, cakupan toko, dan kepemilikan sumber daya di server. Nonaktifkan akun = hentikan akses sesi aktif. Tidak ada registrasi publik karyawan.

---

## 4. User journey

### 4.1 Owner: mulai menggunakan aplikasi

1. Developer men-deploy aplikasi kosong dengan migrasi database; **tanpa data demo produksi**.
2. Proses bootstrap yang aman membuat **owner pertama** sekali saja menggunakan variabel environment/CLI; rahasia bootstrap tidak ditampilkan di frontend, tidak dapat dipanggil lagi setelah selesai.
3. Owner login dengan **kredensial kuat dan MFA bila memungkinkan** (owner **tidak** harus memakai PIN karyawan).
4. Owner melengkapi profil usaha/branding, menambah toko dan koordinat lokasi, mengisi radius default.
5. Owner menambah karyawan satu per satu atau impor CSV terkontrol; sistem menghasilkan ID/PIN sementara.
6. Owner membuat template shift, menerbitkan jadwal per hari/minggu, menguji absensi, dan memeriksa dashboard.
7. Sistem baru dinyatakan aktif setelah uji penerimaan.

### 4.2 Employee: login

`Halaman Login → Masukkan ID + PIN → Backend validasi + rate limit → (jika PIN sementara: wajib ganti PIN) → Beranda`

- ID login dapat diedit oleh owner, tetapi perubahan harus **unik** dan tercatat dalam audit.
- Perubahan ID tidak boleh mengubah `employee.id` internal dan tidak boleh merusak riwayat/jadwal.
- Owner dapat menerbitkan PIN sementara baru; tampilkan **sekali** kepada owner. Jangan menyimpan atau mengirim PIN via log.
- Bila lupa PIN, karyawan menghubungi owner; owner melakukan reset setelah verifikasi identitas operasional.

### 4.3 Employee: absen masuk normal

`Beranda → Absen Masuk → Izin kamera & lokasi → Selfie → Preview + ambil ulang → Kirim → Validasi server → Sukses`

Yang disimpan: `employee_id`, `schedule_id`, `store_id`, waktu server, foto privat, koordinat, akurasi GPS, jarak ke toko, status lokasi, dan status review.

### 4.4 Employee: di luar area / GPS gagal

- Jika di luar radius: tampilkan informasi lokasi, input **alasan wajib**, tombol `Ajukan Absensi`.
- Jika izin GPS ditolak/tidak tersedia/akurasi buruk: tampilkan **coba lagi**, lalu jalur pengecualian dengan alasan; beri tag penyebab.
- Permohonan mencatat waktu server dan tidak diblokir sampai owner merespons; status **menunggu persetujuan**.
- **Tercatat ≠ disetujui**; ringkasan harus membedakan keduanya.

### 4.5 Employee: absen pulang

`Beranda → Absen Pulang → Selfie + GPS → Validasi sesi kerja terbuka → Simpan event → Sesi selesai atau butuh review`

- Check-out tetap dapat diajukan walaupun check-in sedang pending approval.
- Tidak bisa check-out untuk sesi milik karyawan lain.
- Sesi yang tidak memiliki check-out **tidak diisi otomatis** dengan jam shift; tandai `missing_checkout` untuk review/koreksi.

### 4.6 Employee: koreksi absensi

`Riwayat → Pilih sesi/tanggal → Ajukan Koreksi → Jenis & waktu yang diklaim + alasan → Pending → Owner approve/reject → Hasil terlihat`

- Original event, waktu sebenarnya pengajuan, alasan, reviewer, dan nilai sebelum/sesudah tidak dihapus.
- Karyawan tidak bisa langsung mengedit waktu absensi server.

### 4.7 Owner: review persetujuan

`Dashboard → Kotak Masuk Persetujuan → Buka detail selfie, lokasi, shift, waktu, alasan → Setujui / Tolak + catatan → Audit`

- Tombol persetujuan menampilkan konfirmasi tindakan.
- Hanya permintaan status `pending` yang dapat diputuskan; cegah approve ganda dengan transaksi database.

---

## 5. Ruang lingkup fitur dan prioritas

### P0 — MVP wajib

**Karyawan:** login ID + PIN, perubahan PIN awal, beranda status hari ini, jadwal, selfie check-in/check-out, GPS, exception, riwayat, koreksi.

**Owner:** dashboard lintas toko, daftar dan CRUD toko, daftar/CRUD/nonaktif karyawan, ubah ID, reset PIN, assignment toko, template shift, jadwal, konfigurasi absensi, approval inbox, laporan data dasar, audit.

**Sistem:** API dengan validasi, storage privat, waktu server, pengamanan login, backup/panduan restore, error handling, test dan deployment manual.

### P1 — Sesudah pilot

Izin/cuti/sakit, ekspor Excel/CSV, pencarian dan filter lanjutan, pengingat dalam aplikasi, impor karyawan CSV, analitik tren, dukungan manager dengan cakupan toko, pengaturan brand lebih luas.

### P2 — Jika ada bukti kebutuhan

Push notification, laporan otomatis terjadwal, integrasi payroll, face liveness/identity verification berizin, proses offline terkontrol dengan sinkronisasi yang jelas dan tetap harus divalidasi server.

---

## 6. Dashboard owner: SEMUA pengaturan bisnis mudah diubah

Menu desktop disarankan:

1. **Dashboard**: KPI, status cabang, aktivitas hari ini, permintaan pending, tren kehadiran.
2. **Absensi**: semua sesi masuk/pulang, filter toko/tanggal/status, lihat foto/lokasi.
3. **Persetujuan**: exception lokasi, koreksi waktu, missing check-in/out.
4. **Jadwal**: kalender mingguan, template shift, penugasan lintas toko.
5. **Karyawan**: tambah, edit, nonaktif, ubah ID, reset PIN, pindah toko, riwayat kerja.
6. **Toko**: tambah toko tanpa ubah kode, nama, alamat, GPS, radius, aktivasi.
7. **Laporan**: tabel rekap, ekspor CSV (P1), statistik.
8. **Pengaturan**: profil usaha, aturan absensi, toleransi, timezone, branding, preferensi.
9. **Audit & Keamanan**: perubahan penting, sesi aktif, riwayat reset PIN.
10. **Profil Owner**: ubah identitas, password, MFA, logout.

### Matriks setting: dashboard vs deployment

| Pengaturan | Owner dashboard? | Cara pengubahan | Catatan |
|---|---|---|---|
| Nama usaha, logo, warna aksen | **Ya** | UI form | validasi aset/warna |
| Toko (nama, alamat, koordinat, radius) | **Ya** | UI CRUD | jangan hapus toko bersejarah; nonaktifkan |
| Karyawan (nama, status, toko asal) | **Ya** | UI CRUD | histori tetap |
| Employee login ID | **Ya** | UI edit + konfirmasi | unik, audit, sesi dievaluasi |
| PIN karyawan | **Reset saja** | UI reset → PIN baru sekali tampil | tidak pernah bisa dibaca |
| Shift & jadwal | **Ya** | kalender/editor | validasi overlap dan perubahan |
| Toleransi keterlambatan, radius default | **Ya** | UI setting | simpan versi/riwayat aturan |
| Aktif/nonaktif modul opsional | **Ya, bila sudah dibuat** | fitur toggle | bukan bypass keamanan |
| Nama domain/URL aplikasi | **Tidak** | konfigurasi hosting/DNS | teknis |
| URL database, password database | **Tidak** | ENV di server | rahasia |
| Kunci Supabase/Storage/API | **Tidak** | ENV/secrets server | rahasia |
| Backup storage/retensi teknis | **Sebagian** | UI kebijakan, eksekusi server/admin | hindari tombol merusak backup |
| Provider database/storage | **Tidak langsung** | adapter + deployment | perlu prosedur migrasi |

**Prinsip:** fleksibilitas owner berarti **pengaturan bisnis** tanpa developer; bukan memberikan akses ke kredensial infrastruktur. Panel owner bukan phpMyAdmin.

### Detail manajemen karyawan

Form: nama lengkap (wajib), ID unik (otomatis disarankan dan bisa diedit), toko asal, peran, status, tanggal bergabung (opsional), nomor telepon (opsional), PIN sementara (sistem generate). Owner dapat search, filter toko/status, edit, nonaktif, reaktif, reset PIN, dan lihat ringkasan kehadiran. Hapus permanen dilarang jika karyawan mempunyai histori absensi; gunakan soft delete/nonaktif.

### Detail manajemen toko

Form: nama, kode unik, alamat, lokasi koordinat (pilih titik peta opsional, input manual tersedia), radius meter, jam operasional informasional, status. Tambah toko ketiga harus langsung bisa melalui UI. Toko dapat dinonaktifkan, tidak boleh menghancurkan histori terkait.

---

## 7. UI/UX — berdasarkan screenshot referensi

### 7.1 Karakter visual WAJIB

Referensi: dashboard desktop yang dilampirkan pengguna (background keseluruhan biru keabu-abuan; panel aplikasi terang dengan radius besar; sidebar putih kiri; area konten abu-abu sangat muda; kartu statistik putih; satu kartu KPI dengan aksen **periwinkle/soft blue**; tipografi sans-serif modern; icon line tipis; grafik sederhana; spacing lega; tabel bersih; panel samping ringkas).

**Terapkan bahasa visual, bukan konten gambar.** Ganti metrik `Projects`, `Revenue`, dan `Transactions` menjadi `Kehadiran`, `Karyawan`, `Toko`, `Persetujuan`, `Aktivitas`, dan `Jadwal`. Jangan meniru logo/avatar/nama orang dari screenshot.

**Desain token awal (bisa disesuaikan setelah review):**

```css
:root {
  --app-bg: #eef2f5;
  --shell-bg: #f6f8fa;
  --surface: #ffffff;
  --sidebar-bg: #ffffff;
  --text-primary: #1d2430;
  --text-secondary: #77818e;
  --border: #e8edf2;
  --accent: #8095f5;
  --accent-hover: #6e84e9;
  --accent-soft: #edf0ff;
  --success: #278663;
  --warning: #c48630;
  --danger: #bf4d53;
  --radius-card: 16px;
  --radius-shell: 26px;
  --shadow-card: 0 2px 12px rgb(27 44 66 / 3%);
}
```

- Layout desktop: sidebar **220–250px**, header ringkas, area KPI 3–4 kartu dengan grid adaptif, konten dua kolom hanya bila ruang cukup.
- Layout HP: **tanpa sidebar permanen**; gunakan bottom navigation atau drawer, satu kolom, tombol absen besar mudah dijangkau ibu jari.
- Ukuran area sentuh minimal **44×44 CSS px**; teks utama mudah dibaca (umumnya 14–16px minimum untuk konten form).
- Gaya: flat-clean dengan sedikit bayangan; **hindari efek glass/blur berlebihan**, gradient mencolok, animasi berat, kartu generik bertumpuk, dan terlalu banyak badge.
- Gunakan font open-source yang tersedia (misalnya Inter/Geist) dengan fallback system; optimalkan pengiriman font.
- Ikon konsisten, misalnya Lucide; jangan campur beberapa gaya ikon.
- Gunakan status warna **dan teks**, bukan warna saja.
- Mode terang prioritas; dark mode opsional P1.

### 7.2 Kebijakan MOBILE-FIRST yang wajib dipatuhi

**Prioritas desain utama adalah HP (320–430 CSS px).** Gambar referensi merupakan inspirasi gaya visual **dashboard laptop**, bukan perintah menyalin komposisi desktop ke layar kecil.

- Mulai desain dan implementasi **dari viewport 375×812**, lalu 390×844, 320×568, tablet, dan terakhir desktop 1440×900; jangan memulai dari desktop lalu sekadar mengecilkannya.
- **Owner wajib mampu menyelesaikan 100% tugas administratif penting melalui HP**: tambah/edit toko, tambah/edit karyawan, ubah ID, reset PIN, atur shift, ubah radius/aturan, approve/reject, dan buka laporan.
- Karyawan hanya perlu beberapa interaksi untuk check-in/check-out; CTA absen mudah dijangkau ibu jari; kamera dan izin GPS mendapat penanganan khusus Safari iOS dan Chrome Android.
- Di HP, gunakan daftar/kartu ringkas atau tabel responsif dengan detail dibuka per item. **Dilarang mewajibkan swipe horizontal tabel** untuk menemukan tombol Edit, Simpan, dan Approve.
- Form administrasi mobile wajib menggunakan label jelas, input sesuai tipe keyboard, validasi inline, tombol simpan konsisten, dan konfirmasi untuk aksi sensitif.
- Navigasi HP ringan: bottom bar untuk halaman utama karyawan, dan bottom bar atau menu ringkas untuk owner. Jangan menampilkan sidebar permanen di HP.
- Perhatikan safe-area, keyboard virtual, tap target ≥44×44px, layout satu kolom bila perlu, kontras, koneksi lambat, dan penggunaan satu tangan.
- **Urutan review UI di setiap fase:** mobile karyawan → mobile owner → tablet → laptop. Sebuah fitur belum lulus jika hanya berfungsi di desktop.

### 7.3 Responsivitas

| Lebar layar | Perilaku |
|---|---|
| 320–479px | 1 kolom, nav bawah, form penuh, kartu statistik 2×2 jika muat |
| 480–767px | layout mobile lega; tidak ada tabel horizontal panjang yang memotong kontrol |
| 768–1023px | tablet, sidebar collapse, grid 2 kolom |
| ≥1024px | sidebar tetap, dashboard 3–4 KPI, tabel dan kolom detail |

**Larangan:** overflow horizontal halaman, modal lebih besar dari viewport, tombol kecil sulit ditekan, tabel tanpa versi mobile. Gunakan skeleton/loading state seperlunya, empty state yang memberi tindakan, dan pesan error yang membantu.

### 7.4 Layar yang harus dibuat

- Login ID + PIN; ganti PIN awal.
- Employee: Beranda; kamera selfie + preview; hasil absen; Jadwal; Riwayat/Detail; Ajukan Koreksi; Profil.
- Owner: Dashboard; Absensi + detail; Approval inbox/detail; Karyawan daftar/editor; Toko daftar/editor; Jadwal + template; Pengaturan; Audit.
- Halaman error/akses ditolak/not found/offline tanpa data palsu.

### 7.5 Aturan AI agar **tidak terlihat seperti template AI**

1. **Mulai dari screenshot**: tulis observasi desain visual dulu, buat peta komponen, baru implementasi.
2. **Gunakan komposisi khusus Princes**, bukan template admin yang menampilkan contoh "Revenue/Projects".
3. Tetapkan sistem token konsisten (spacing, radius, warna, typography, icon).
4. Jangan menambah grafik hanya untuk dekorasi; setiap visual harus menyampaikan data bisnis yang valid.
5. Minimalkan teks berulang dan elemen dekoratif; utamakan hirarki, whitespace, dan alignment.
6. Hindari dashboard yang penuh gradient ungu, efek glassmorphism, glow, emoji berlebihan, atau kartu identik tanpa prioritas visual.
7. Maksimum satu CTA utama di setiap konteks; destructive action diberi konfirmasi.
8. Desain loading, error, empty, denied, success **sebelum** menyatakan halaman selesai.
9. Uji screenshot pada viewport **320×568, 375×812, 390×844, 768×1024, 1440×900**; lakukan review visual setelah setiap fase UI.
10. Jangan mengklaim "pixel-perfect" sebelum screenshot runtime dibandingkan referensi dan diverifikasi.

---

## 8. Arsitektur aplikasi yang ringan dan mudah dipindahkan

### 8.1 Stack rekomendasi

- **Next.js App Router + TypeScript**: frontend dan backend (Route Handlers) dalam satu repository.
- **Tailwind CSS + shadcn/ui + Lucide**: UI responsif dengan komponen dapat dikontrol sendiri.
- **Supabase Free PostgreSQL**: database cloud utama yang dipilih untuk development/pilot; PostgreSQL lokal melalui Docker Compose bersifat opsional untuk pengujian offline. Gunakan project development terpisah dari project berisi data karyawan nyata.
- **Drizzle ORM + migrasi SQL**: skema versioned, hindari bergantung pada dashboard DB.
- **Zod** untuk validasi input, **React Hook Form** untuk form.
- **Argon2id** untuk hashing PIN (parameter disesuaikan dengan resource dan ancaman).
- **Sesi berbasis cookie aman** pada backend, session token acak kuat yang disimpan dalam bentuk hash server-side; gunakan `HttpOnly`, `Secure` (produksi), `SameSite`, expiry, dan revocation.
- **Supabase Storage Free**: penyimpanan foto privat yang dipilih; adapter tetap disiapkan agar penyedia penyimpanan dapat diganti saat kapasitas atau biaya berubah. Penyimpanan lokal opsional khusus development.
- **Testing**: Vitest (unit/integration) + Playwright (E2E).
- **Vercel Hobby (Free)**: pilihan hosting untuk development, preview, dan demonstrasi pribadi/nonkomersial. **Tidak untuk operasional usaha komersial** sesuai syarat Vercel; sebelum go-live bisnis, migrasikan ke Vercel Pro atau hosting lain yang mengizinkan komersial. Pastikan fungsi Node.js/server dan batas platform cocok.

### 8.2 Supabase Free + Vercel Free: keputusan dan batasannya

**Pilihan infrastruktur eksplisit:**

| Komponen | Provider/plan yang dipilih | Kegunaan |
|---|---|---|
| Database | **Supabase Free (PostgreSQL)** | Semua data toko, karyawan, jadwal, absensi dan audit |
| Penyimpanan selfie | **Supabase Free Storage (private bucket)** | Foto bukti absen; akses hanya lewat backend terotorisasi |
| Hosting aplikasi | **Vercel Hobby/Free** | Hosting development, preview dan demo **nonkomersial** |
| Go-live untuk bisnis | **Hosting yang mengizinkan penggunaan komersial** | Diputuskan sebelum aplikasi benar-benar dipakai operasional; kode harus mudah dipindah |

**Kuota Supabase Free yang perlu dipantau** (per dokumentasi Supabase yang diakses 9 November 2026; dapat berubah): sekitar **500 MB database/project**, **1 GB storage** dan **dua project aktif gratis**. Foto selfie dikompresi, diberi kebijakan retensi, dan pemakaian kapasitas diperiksa berkala. Jangan menaruh gambar biner di database. Layanan Free dapat **pause** setelah aktivitas rendah; tidak ada jaminan operasional 24/7 atau backup otomatis setara layanan berbayar. Siapkan ekspor/backup terenkripsi mandiri dan tes pemulihan. Dokumentasi: https://supabase.com/docs/guides/platform/billing-on-supabase dan https://supabase.com/docs/guides/platform/free-project-pausing .

**Pembatasan Vercel Hobby:** layanan hanya untuk **personal/noncommercial use**. Meski aplikasi dibagikan gratis kepada teman, penggunaan sebagai sistem kehadiran karyawan usaha tidak otomatis menjadi nonkomersial. Karena itu **Vercel Free dipakai untuk tahap pembuatan dan demo saja**, bukan dijanjikan sebagai hosting final usaha. Jika ingin tetap gratis saat operasional, evaluasi alternatif hosting yang secara eksplisit mengizinkan skenario tersebut, dengan batas dan risiko masing-masing. Dokumentasi: https://vercel.com/docs/plans/hobby dan https://vercel.com/docs/limits/fair-use-guidelines .

**Pengaturan saat serah terima:** pemilik membuat/menjadi owner akun Supabase dan hosting miliknya sendiri; developer menyiapkan migrasi skema pada project baru, secret baru, bucket privat, domain dan akun owner. **Tidak menyalin data dummy, token, atau kredensial developer.** Semua pengaturan bisnis tetap lewat dashboard owner, tetapi secrets/provider tetap di environment hosting agar aman.

**Strategi hemat kuota:** foto maksimal 150–250 KB setelah kompresi (target, bukan jaminan), hindari polling cepat, gunakan pagination, indeks database, query agregat, komponen ringan, dan batas ukuran upload. Tampilkan peringatan kapasitas internal bila memungkinkan; jangan menganggap kuota gratis tidak terbatas.

### 8.3 Pengembangan dan migrasi database

Pengembang memakai **Supabase Free project development** dengan data fiktif; PostgreSQL lokal via Docker bersifat opsional. Saat penyerahan, jalankan migrasi pada **Supabase project baru milik teman** yang masih kosong dan masukkan data asli melalui dashboard. **Jangan** menyalin data demo, PIN, rahasia, atau foto uji ke project pemilik. Jangan diam-diam berpindah ke SQLite. Gunakan migrasi versi yang sama untuk dev dan produksi.

### 8.4 Layering

```text
UI (employee & owner)
  → Route Handlers / server actions dengan auth + validation
  → Application services (attendance, schedule, approvals, employees)
  → Repository interface / Drizzle repositories
  → PostgreSQL
  → Storage interface → LocalDevStorage / SupabaseStorage / S3Storage
```

- **Business logic tidak boleh bergantung langsung pada provider cloud tertentu.**
- `lib/config` memuat konfigurasi, tervalidasi saat startup, dengan safe defaults untuk nonsecret.
- `server/storage/StorageProvider` memiliki `uploadPrivate`, `getSignedReadUrl`, `delete` bila diizinkan.
- `server/auth`, `server/db`, `server/services` dibedakan dari komponen UI.
- `settings` DB menyimpan aturan bisnis dan branding, **bukan secrets**.
- Semua provider mengganti **konfigurasi dan adapter**, bukan mengubah komponen UI atau business rules.

### 8.5 Konfigurasi lokal vs deployment

Contoh `.env.example` **tanpa nilai rahasia nyata**:

```dotenv
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
APP_TIMEZONE=Asia/Jakarta
DATABASE_URL=postgresql://USER:CHANGE_ME@HOST:5432/postgres
# Koneksi PostgreSQL milik Supabase development; tidak pernah dipakai di frontend
SESSION_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
STORAGE_DRIVER=supabase
# Gunakan SUPABASE_URL project development; secret hanya server:
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=attendance-photos
# Bootstrap hanya untuk initial setup, sekali pakai:
BOOTSTRAP_OWNER_ID=
BOOTSTRAP_OWNER_PASSWORD=
```

**Peringatan:** `.env.example` adalah contoh nama konfigurasi, bukan implementasi siap produksi. Validasi dan implementasi actual harus menghindari akses insecure; bootstrap tidak boleh aktif terus. Jangan commit `.env`, foto, database dump, atau PIN.

### 8.6 Cara penyerahan ke pemilik

1. Akhiri pengembangan; tag release Git dan simpan README runbook.
2. Siapkan **project Supabase milik teman**, bucket privat dan secret baru; pilih hosting yang mengizinkan penggunaan bisnis (Vercel Hobby hanya untuk demo nonkomersial).
3. Jalankan migrasi dan validasi koneksi; siapkan backup otomatis dan restore test.
4. Bootstrap owner milik teman, nonaktifkan mekanisme bootstrap.
5. Owner login dan mengisi sendiri toko, karyawan, jadwal, radius, logo, serta aturan melalui dashboard.
6. Buat akun karyawan dengan PIN sementara yang wajib diubah.
7. Uji check-in/out secara nyata di kedua toko, GPS, approval, dan dashboard mobile.
8. Hapus data uji dari produksi via prosedur aman sebelum go-live, pastikan akun developer tidak memiliki akses permanen tanpa izin.
9. Serahkan dokumentasi operasi, reset PIN, backup/restore, serta cara mengganti domain dan provider storage.

---

## 9. Model database PostgreSQL

Gunakan ID internal **UUID** dan referential integrity. Timestamps kejadian disimpan `timestamptz` dalam UTC; tampilkan zona `Asia/Jakarta`. Data bisnis bersejarah tidak dihapus permanen lewat CRUD biasa.

### 9.1 Entitas inti

| Tabel | Kolom kunci / fungsi | Catatan |
|---|---|---|
| `businesses` | `id`, `name`, `logo_path`, `timezone`, `is_active` | satu bisnis saat MVP; hindari hardcode nama |
| `stores` | `id`, `business_id`, `code`, `name`, `address`, `lat`, `lng`, `radius_m`, `is_active` | `code` unik per bisnis |
| `employees` | `id`, `business_id`, `employee_code`, `full_name`, `primary_store_id`, `role`, `status`, `joined_at`, `created_at` | ID login editable, UUID tetap |
| `employee_credentials` | `employee_id`, `pin_hash`, `must_change_pin`, `failed_attempts`, `locked_until`, `changed_at` | **tidak pernah simpan PIN asli** |
| `auth_sessions` | `id`, `employee_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at` | token asli hanya cookie; jangan log |
| `employee_store_assignments` | `id`, `employee_id`, `store_id`, `starts_at`, `ends_at` | histori penugasan |
| `shift_templates` | `id`, `business_id`, `name`, `start_local_time`, `end_local_time`, `crosses_midnight`, `grace_minutes` | template, bukan sumber kebenaran untuk satu shift |
| `schedules` | `id`, `employee_id`, `store_id`, `template_id?`, `starts_at`, `ends_at`, `status`, `published_at`, `created_by` | tanggal penuh; deteksi overlap |
| `attendance_sessions` | `id`, `employee_id`, `schedule_id?`, `status`, `check_in_at?`, `check_out_at?` | satu sesi kerja |
| `attendance_events` | `id`, `session_id`, `event_type`, `recorded_at`, `photo_path`, `lat?`, `lng?`, `accuracy_m?`, `distance_m?`, `location_status`, `review_status`, `reason?`, `idempotency_key` | event masuk/pulang dan bukti |
| `approval_requests` | `id`, `requester_id`, `type`, `target_type`, `target_id`, `reason`, `status`, `reviewer_id?`, `decision_note?`, `decided_at?` | satu workflow persetujuan |
| `attendance_corrections` | `id`, `approval_request_id`, `field`, `old_value`, `requested_value`, `applied_value?` | rekam sebelum/sesudah |
| `business_settings` | `business_id`, `key`, `value_json`, `updated_by`, `updated_at` | whitelist key + schema, non-secret |
| `audit_logs` | `id`, `actor_id?`, `action`, `entity_type`, `entity_id?`, `metadata_redacted`, `created_at` | append-only secara aplikasi |

### 9.2 Constraints/index wajib

- `UNIQUE(business_id, employee_code)` dan `UNIQUE(business_id, store.code)` secara konsep; sesuaikan SQL.
- `UNIQUE(employee_id, idempotency_key)` untuk retry absensi.
- `UNIQUE(session_id, event_type)` untuk satu check-in/check-out efektif per sesi normal; koreksi jangan menggandakan event.
- `CHECK(ends_at > starts_at)` pada jadwal; `radius_m > 0`, `accuracy_m >= 0` bila tersedia.
- Indeks `(employee_id, starts_at)` pada jadwal, `(employee_id, check_in_at)` pada sesi, `(review_status, recorded_at)` pada event, `(status, created_at)` pada approvals.
- Cegah jadwal `published` yang overlap pada karyawan sama, idealnya exclusion constraint PostgreSQL atau transaksi plus locking yang terbukti aman.
- Pembuatan/keputusan approval dan penerapan correction harus **atomic**.
- `employee_code` boleh diganti tanpa mengubah foreign key (FK hanya ke UUID).
- Foto privat dan log audit menggunakan retensi yang terdefinisi; penghapusan dilakukan sesuai prosedur.

### 9.3 Aturan perubahan data

- Edit profil, shift, radius diperbolehkan owner sesuai role.
- Perubahan aturan berlaku pada transaksi berikutnya; aturan yang berdampak pada laporan historis harus punya **snapshot** atau versi untuk menjaga interpretasi lama.
- Edit jadwal setelah ada absensi harus dikonfirmasi dan diaudit.
- `inactive`/soft delete untuk karyawan & toko; data historis dipertahankan sesuai retensi.
- Perubahan ID login mencabut/memeriksa ulang sesi bila diperlukan.

---

## 10. Aturan absensi yang presisi

### 10.1 Waktu

- Waktu absensi resmi **dari server**, bukan jam HP.
- `late` = `recorded_check_in_at > schedule.starts_at + grace_minutes`, kecuali ada koreksi yang disetujui/aturan khusus.
- Untuk jadwal melewati tengah malam, hitung terhadap `starts_at` dan `ends_at` penuh (tanggal + waktu), bukan hanya `HH:mm`.
- Jika tidak ada jadwal sah, tampilkan pesan dan proses permohonan penugasan/exception; jangan buat sesi otomatis tanpa dasar.

### 10.2 GPS

- Ambil lokasi hanya saat absensi, dengan izin pengguna.
- Hitung jarak geodesik (mis. Haversine) antara posisi perangkat dan koordinat toko jadwal.
- Default radius **100 m**, default batas akurasi **100 m**; keduanya bisa diubah owner, dengan validasi batas yang wajar.
- Jika jarak di luar radius atau akurasi buruk/tidak tersedia: jalur exception, alasan wajib, status review pending.
- GPS browser **bisa dimanipulasi**. Jangan klaim anti-fraud 100%. Foto kamera juga bukan verifikasi identitas biometrik.

### 10.3 Foto

- Kamera langsung diprioritaskan; tidak ada opsi upload galeri dalam alur normal.
- Preview + retake, kompresi di perangkat (contoh target 100–250 KB, dapat dituning tanpa merusak wajah), validasi MIME dan ukuran di server.
- Jangan simpan data foto sebagai Base64 dalam database; simpan objek privat dan path/ref di DB.
- Akses foto hanya lewat backend authorized / signed URL singkat.
- Jika upload gagal, **jangan tampilkan absensi berhasil**. Gunakan operasi idempotent/dua fase yang jelas agar tidak meninggalkan sesi palsu.
- Foto wajah adalah data pribadi: jelaskan tujuan, akses, retensi, keamanan, dan kebijakan penghapusan kepada karyawan.

### 10.4 State machine

**Event review:** `not_required | pending | approved | rejected`.  
**Session:** `open | completed | needs_review | corrected` (turunan status harus didefinisikan konsisten).  
**Approval:** `pending → approved/rejected` saja; keputusan ulang perlu workflow eksplisit, bukan tombol ganda.  
**Jadwal:** `draft → published → cancelled` dengan audit.

**Aturan penting:** event yang sudah terkirim dengan status pending tidak berarti karyawan belum berusaha hadir. Dashboard tampilkan kategori terpisah `tercatat / disetujui / menunggu / ditolak / belum absen` sehingga KPI tidak double count.

### 10.5 Kondisi tepi

1. Klik tombol kirim berulang / request terduplikasi.
2. Internet putus sebelum atau sesudah upload selfie.
3. GPS belum diizinkan, ditolak, atau memberi akurasi buruk.
4. Check-out saat check-in pending approval.
5. Check-out tanpa sesi terbuka.
6. Sesi dua hari lalu belum check-out.
7. Karyawan dipindah toko di tengah minggu.
8. Dua shift bertabrakan.
9. Perubahan shift setelah karyawan hadir.
10. Owner reset PIN saat employee sedang login.
11. Owner edit ID yang sudah dipakai orang lain.
12. Toko dinonaktifkan tapi mempunyai riwayat.
13. Status approval berubah dari dua browser sekaligus.
14. Karyawan mencoba membaca signed URL milik orang lain.
15. Penyerang mengirim waktu/lokasi/foto palsu via API; server tetap memvalidasi aturan, tetapi mengakui batasan keaslian perangkat.

---

## 11. API kontrak versi 1

Prefix `/api/v1`; semua input divalidasi Zod; response error konsisten, tanpa stack trace/secret; otorisasi di server.

| Method | Endpoint | Aktor | Tujuan |
|---|---|---|---|
| POST | `/auth/employee/login` | publik dibatasi | ID+PIN → cookie sesi |
| POST | `/auth/owner/login` | publik dibatasi | owner login lebih kuat |
| POST | `/auth/logout` | login | revoke sesi |
| POST | `/auth/change-pin` | employee | ubah PIN sendiri |
| POST | `/employees/:id/reset-pin` | owner | reset PIN sementara |
| GET | `/me` | login | identitas/role/toko |
| GET | `/me/schedules` | employee | jadwal sendiri |
| GET | `/me/attendance` | employee | absensi sendiri |
| POST | `/attendance/check-in` | employee | selfie + lokasi |
| POST | `/attendance/check-out` | employee | selfie + lokasi |
| GET | `/attendance` | owner | filter sesi lintas toko |
| GET | `/attendance/:id` | owner/owner sesi | detail authorized |
| POST | `/approvals` | employee | pengajuan exception/koreksi |
| GET | `/approvals` | owner / employee sendiri | daftar |
| POST | `/approvals/:id/decision` | owner | approve/reject |
| GET | `/dashboard/summary` | owner | KPI harian |
| GET/POST/PATCH | `/stores` dan `/:id` | owner | kelola toko |
| GET/POST/PATCH | `/employees` dan `/:id` | owner | kelola karyawan |
| GET/POST/PATCH | `/shift-templates` dan `/:id` | owner | template shift |
| GET/POST/PATCH | `/schedules` dan `/:id` | owner | jadwal |
| GET/PATCH | `/settings` | owner | aturan bisnis nonsecret |
| GET | `/audit-logs` | owner | audit terfilter |

### Format error standar

```json
{
  "error": {
    "code": "ATTENDANCE_OUTSIDE_SCHEDULE",
    "message": "Tidak ada jadwal aktif. Hubungi pemilik toko.",
    "requestId": "req_example"
  }
}
```

`requestId` untuk debugging; tidak bocorkan stack trace atau data pribadi. Gunakan kode HTTP benar (400 validasi, 401 login, 403 izin, 404 tidak terlihat, 409 konflik, 429 rate limit, 5xx server). **Jangan percaya `employee_id` dari client**; ambil dari sesi.

### Performa monitoring

Untuk skala awal gunakan **polling dashboard 30–60 detik** dan refresh manual, bukan wajib websocket/realtime. Jika kebutuhan monitoring mendesak, tambah realtime belakangan. Hindari query mahal setiap render; gunakan pagination/filter sisi server.

---

## 12. Keamanan, privasi, dan operasional

- Owner login dengan password kuat dan MFA bila tersedia; employee ID+PIN minimal **6 digit** dengan throttling/rate limit, lockout bertahap, sesi aman.
- Owner boleh **reset** PIN, **tidak melihat** PIN lama; password/secret tidak boleh muncul pada response umum atau audit.
- Protect server route dan page; CSRF protection untuk cookie-authenticated writes; rate limiting untuk login, upload, reset PIN, dan approval.
- Validasi dan sanitasi input, batas ukuran foto, file signature, content type, dan pencegahan akses path traversal.
- Rahasia hanya di ENV/secrets manager di server; `.env*` yang berisi rahasia di `.gitignore`.
- Foto dan GPS pribadi hanya untuk keperluan absensi; akses berbasis role + need-to-know.
- HTTPS wajib produksi, termasuk kamera/geo browser.
- Audit append-only untuk reset PIN, perubahan employee ID, perubahan aturan, pergantian jadwal, approval, dan koreksi.
- Backup PostgreSQL + foto sesuai RPO/RTO usaha yang disepakati; tes restore **sebelum** go-live.
- Untuk regulasi privasi Indonesia, lakukan peninjauan UU Perlindungan Data Pribadi serta dokumentasikan tujuan, dasar pemrosesan, transparansi, retensi, dan mekanisme hak subjek data. **Jangan mengasumsikan selfie otomatis boleh disimpan tanpa kebijakan.**
- Jangan mengaktifkan tracking GPS terus-menerus.

**Default usulan** (konfirmasikan pemilik): radius 100m; akurasi GPS 100m; toleransi terlambat 5 menit; dua selfie/shift; sesi login 7 hari dengan rotasi/expiry sesuai risiko; retensi foto awal 90 hari **hanya setelah disepakati**; penggunaan data demo hanya di development.

---

## 13. Kebutuhan non-fungsional

| Aspek | Target MVP |
|---|---|
| Akses | Mobile browser terbaru Android/iOS; dashboard mobile + laptop |
| Ringan | Hindari dependensi berat, chart berlebihan, gambar besar, autoplay dan animasi mahal |
| Performa | Halaman beranda cepat pada jaringan seluler normal; ukur Lighthouse dan Web Vitals, jangan tebak |
| Responsif | No horizontal page overflow pada 320px sampai desktop |
| Aksesibilitas | Label form, keyboard focus, kontras cukup, tombol ≥44px, status tidak hanya warna |
| Reliabilitas | Tidak ada double submit; request idempotent; pesan gagal jelas |
| Keamanan | TLS, role checks, rate limit, private storage, audit |
| Maintainability | TypeScript strict, migration versioned, modul service/repo, lint/typecheck/test |
| Observability | Log terstruktur yang menyamarkan PII, request ID, error monitoring ringan |
| Backups | Backup + documented restore drill sebelum produksi |
| Portabilitas | Tanpa hardcode domain/provider/ID toko; seed data demo terpisah |

---

## 14. Struktur folder target

```text
princes-attendance/
├── docs/
│   ├── PRD_PRINCES_Attendance.md
│   ├── reference/dashboard-reference.png
│   ├── architecture.md
│   ├── api-contract.md
│   ├── design-system.md
│   ├── phase-progress.md
│   └── deployment-runbook.md
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (employee)/
│   │   ├── (owner)/
│   │   └── api/v1/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── employee/
│   │   └── owner/
│   ├── features/
│   │   ├── attendance/
│   │   ├── approvals/
│   │   ├── employees/
│   │   ├── schedules/
│   │   └── stores/
│   ├── server/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── storage/
│   ├── lib/
│   ├── hooks/
│   └── styles/
├── drizzle/
├── scripts/
│   ├── bootstrap-owner.ts
│   ├── seed-dev.ts
│   └── verify-env.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
├── docker-compose.yml
├── .env.example
├── README.md
└── package.json
```

Folder dapat disesuaikan jika ada alasan kuat, tetapi **separation of concerns wajib**. Jangan buat satu file 1.500 baris berisi semua page, auth, database, dan UI.

---

## 15. Data demo, seed, dan migrasi

**Pengembangan di laptop:**

- `docker compose up -d` untuk PostgreSQL lokal.
- `pnpm install` (atau npm jika disepakati dan lockfile konsisten).
- Salin `.env.example` → `.env.local`, isi kredensial development.
- `pnpm db:migrate`; `pnpm db:seed:dev` **hanya pada development**.
- Data demo: 2 toko fiktif, 8–12 karyawan fiktif, beberapa shift, data absensi contoh; tandai `DEMO` jelas. Jangan gunakan nama/foto orang nyata tanpa izin.
- Jalankan `pnpm dev`, cek UI di laptop dan HP pada jaringan lokal yang aman; camera/geolocation pada HP memerlukan secure context/HTTPS, sehingga gunakan tunnel HTTPS development yang aman bila perlu.

**Produksi:**

- **JANGAN** jalankan seed demo.
- Jalankan migrasi yang sama ke PostgreSQL baru; bootstrap owner sekali; input data nyata dari dashboard.
- Beda environment hanya konfigurasi, credential, storage driver, dan data; bukan cabang kode terpisah.

**Migrasi data:** tidak boleh otomatis `drop table`, `reset database`, atau menghapus data saat deploy. Migrasi destruktif harus diajukan beserta backup + rollback plan dan persetujuan owner/developer.

---

## 16. Acceptance criteria per fitur

### Login dan akun

- [ ] Owner bisa tambah/edit/nonaktif karyawan tanpa kode.
- [ ] Owner bisa mengganti `employee_code` jika belum dipakai akun lain.
- [ ] Owner bisa reset PIN dan hanya melihat PIN sementara sekali.
- [ ] Karyawan harus mengganti PIN awal saat login pertama.
- [ ] PIN tidak ada dalam plaintext database, API response biasa, console, atau log.
- [ ] Percobaan login salah dibatasi dan tidak membocorkan keberadaan ID akun.
- [ ] Akun nonaktif atau sesi dicabut tidak dapat memanggil API private.

### Toko/jadwal

- [ ] Owner bisa tambah toko ke-3 dari UI tanpa deploy ulang.
- [ ] Owner bisa edit nama, alamat, titik lokasi, radius, status toko.
- [ ] Penugasan karyawan lintas toko tidak merusak riwayat.
- [ ] Shift 20:00–05:00 tersimpan dan diproses dengan benar.
- [ ] Jadwal overlap ditolak atau membutuhkan prosedur penyelesaian yang eksplisit.

### Absensi

- [ ] Selfie + GPS + timestamp server berhasil masuk sebagai event.
- [ ] Lokasi di luar radius menghasilkan exception pending dengan alasan.
- [ ] GPS gagal menyediakan retry/exception, bukan silent failure.
- [ ] Double-click/retry tidak menghasilkan dua absensi.
- [ ] Check-out tidak dapat dibuat untuk sesi milik orang lain.
- [ ] Upload foto gagal tidak menampilkan sukses palsu.
- [ ] Foto tidak bisa dilihat orang yang tidak berhak.

### Approval/koreksi

- [ ] Owner bisa review dan putuskan permohonan dengan catatan.
- [ ] Keputusan ganda/race condition ditangani aman.
- [ ] Data asli sebelum koreksi tetap ada di audit.
- [ ] Karyawan bisa melihat status permohonan sendiri.

### Dashboard/UI

- [ ] KPI tidak menghitung double antara approved/pending/rejected.
- [ ] Filter toko/tanggal konsisten untuk semua panel.
- [ ] Mobile 375px dan desktop 1440px tidak overflow; kontrol mudah disentuh.
- [ ] Screenshot visual menunjukkan gaya sesuai referensi, bukan template admin default.
- [ ] Semua page mempunyai loading, empty, error states.

### Deploy/operasional

- [ ] Aplikasi menggunakan database produksi kosong tanpa perubahan business logic.
- [ ] Seed development tidak bisa dijalankan tidak sengaja di produksi.
- [ ] Secrets tidak masuk repository/browser.
- [ ] Backup dan restore pernah diuji.
- [ ] README dan runbook cukup untuk orang lain menjalankan/deploy.

---

## 17. Test plan minimum

**Unit:** perhitungan keterlambatan, shift lintas tengah malam, Haversine, akurasi GPS, transisi state, validasi PIN, schema Zod, fungsi permission.

**Integration (dengan database tes terisolasi):** employee CRUD, uniqueness ID, change PIN, reset PIN, session revocation, schedule overlap, check-in idempotency, approval atomic, correction history, filter data per toko, storage fail rollback/reconcile.

**E2E Playwright:** login employee; selfie/mock camera; GPS in/out area; check-in; check-out; view history; submit correction; login owner; approve; add 3rd store; edit ID; reset PIN; viewport mobile/desktop; access denied.

**Manual perangkat asli:** Android Chrome dan iPhone Safari/PWA; permission camera+GPS; jaringan lemah; browser reload; tombol back; upload retry; home screen install; keyboard menutupi form; foto cukup jelas.

**Keamanan:** IDOR terhadap employee lain, role escalation, CSRF, brute-force login, file upload tidak sah, token reuse setelah logout, replay request, signed URL expiry, secret leakage.

Semua tes dilakukan dengan data fiktif. Tes yang tidak bisa dijalankan karena keterbatasan environment harus dilaporkan sebagai **belum diuji**, bukan diberi status lulus.

---

## 18. Definition of Done (DoD) — berlaku untuk setiap fase

Satu fase dianggap selesai **hanya jika**:

**Kriteria mobile wajib:** bila fase mengubah UI, semua alur terkait harus diperiksa pada 320px/375px/390px, termasuk **UI owner mobile**; jangan menyatakan selesai hanya berdasarkan screenshot desktop.

1. Semua acceptance criteria fase terpenuhi.
2. `lint`, `typecheck`, dan test relevan lulus (atau keterbatasan dijelaskan secara eksplisit).
3. Tidak ada TypeScript error, import rusak, route rusak, atau placeholder TODO pada jalur fitur utama.
4. Semua aksi yang memodifikasi data diverifikasi izin dan inputnya **di server**.
5. UI responsif, memiliki loading/error/empty states, dan konsisten dengan design tokens.
6. Database berubah lewat migrasi terdokumentasi, bukan edit manual liar.
7. File `.env.example` dan dokumentasi terbaru konsisten dengan implementasi.
8. AI menyajikan bukti pengujian (perintah + ringkasan output), file berubah, risiko tersisa, dan instruksi uji manual.
9. AI **berhenti** dan meminta persetujuan lanjut fase berikutnya, tidak otomatis lanjut.

---

## 19. Aturan wajib untuk AI coding assistant

### 19.1 Prosedur kerja

1. **Baca PRD dan repo dahulu**; sebelum mengedit, ringkas tujuan fase, files yang akan disentuh, dependensi, dan acceptance criteria.
2. **Hanya kerjakan fase yang diminta.** Jangan membuat semua fitur sekaligus.
3. Bila repo sudah punya file/komponen, **modifikasi secara minimal**; jangan rewrite seluruh proyek jika tidak perlu.
4. Tulis kode yang **benar-benar berjalan**, bukan mock yang diklaim production-ready. Mock hanya diperbolehkan jika fase memang desain prototipe, dan harus diberi label `DEMO`.
5. Gunakan TypeScript strict, function/component kecil, nama jelas, prinsip sederhana (KISS), dan hindari abstraksi berlebihan.
6. Jangan menambah dependency tanpa alasan konkret. Periksa kompatibilitas versi dengan dokumentasi resmi yang tersedia.
7. Semua variabel lingkungan dipusatkan dan divalidasi; tidak ada URL/ID/token rahasia hardcoded.
8. Semua input dari client tidak dipercaya; validasi role, kepemilikan, dan data di server.
9. Jangan pernah membuat endpoint reset database, seed demo, atau bootstrap owner yang terbuka di produksi.
10. Jangan menyimpan secret atau PIN plaintext; tidak ada password yang bisa dibaca ulang oleh owner.
11. Jangan menggunakan gambar stock/avatar acak sebagai bukti absensi riil.
12. Jangan menyalin UI generik/tampilan bawaan shadcn mentah; custom-kan komposisi sesuai screenshot referensi.
13. Gunakan icon set konsisten dan hindari animasi berlebihan.
14. Jangan menghapus data historis hanya karena record toko/karyawan dinonaktifkan.
15. Jangan melakukan migrasi destruktif tanpa review dan backup.
16. Jangan menyatakan lulus tes jika belum menjalankannya. Jika error, perbaiki akar masalah, jangan abaikan tipe/lint.
17. Untuk error, mulai dari reproduksi + penyebab + tes regresi; jangan menambal gejala dengan `any`, `@ts-ignore`, atau `try/catch` kosong.
18. Jangan memulai fase berikutnya tanpa instruksi eksplisit.
19. Ikuti struktur folder modular, tambah komentar hanya bila menjelaskan alasan yang tidak jelas dari kode.
20. Setelah setiap fase, perbarui `docs/phase-progress.md` dengan checklist, keputusan, risiko, dan pekerjaan berikutnya.

### 19.2 Format laporan AI di akhir setiap fase

```text
FASE: [nomor & nama]
STATUS: [Selesai / Parsial / Terblokir]
FITUR SELESAI: [...]
FILE DIBUAT/DIUBAH: [...]
MIGRASI/KONFIGURASI: [...]
PERINTAH TES + HASIL: [...]
SCREENSHOT/REVIEW UI: [...]
RISIKO & BATASAN: [...]
CARA MENJALANKAN/MENGUJI: [...]
CHECKLIST ACCEPTANCE: [...]
MENUNGGU PERSETUJUAN UNTUK FASE SELANJUTNYA.
```

---

## 20. Roadmap fase pengerjaan — tidak boleh digabung otomatis

> Setiap fase adalah satu unit kerja dengan checkpoint. Durasi tidak ditetapkan karena bergantung laptop, AI, dan temuan tes. Jika fase berat, AI boleh membaginya menjadi subfase **tanpa melompati acceptance**.

### Fase 0 — Audit kebutuhan, setup, dan desain teknis

**Tujuan:** menghasilkan blueprint repo, keputusan stack, desain arsitektur, dan lingkungan development.

**Pekerjaan:** baca PRD+gambar; cek tool yang terpasang; buat Next.js TypeScript dengan lint; pasang desain token **mobile-first**; siapkan konfigurasi **Supabase Free project development** (PostgreSQL lokal Compose opsional); `.env.example`, README, keputusan arsitektur, pemeriksaan env. Vercel Hobby untuk preview/demo nonkomersial. **Belum buat autentikasi/absensi sesungguhnya.**

**Kriteria selesai fase:** `dev`, `lint`, `typecheck` berjalan; DB dev dapat dihubungi; repo rapi; tidak ada secret dalam Git.


### Fase 1 — Design system & prototipe UI

**Tujuan:** membangun UI **mobile-first** karyawan dan owner terlebih dahulu, kemudian adaptasi tablet/desktop dengan komponen konsisten.

**Pekerjaan:** bottom navigation/menu ringkas mobile, layar owner mobile CRUD, header, kartu KPI, daftar responsif, badge status, form, dialog, empty/loading/error states, kemudian sidebar desktop. Buat halaman **demo visual statis** login, employee home, owner dashboard, karyawan/toko/jadwal dengan data dummy yang jelas.

**Kriteria selesai fase:** screenshot 320/375/390/768/1440; seluruh tugas owner dapat dilakukan via HP; tidak overflow; desain sesuai screenshot tetapi metrik absensi; tidak ada klaim data riil; accessibility dasar.


### Fase 2 — Skema database, migrasi, repository

**Pekerjaan:** skema dan constraints §9, migrasi Drizzle, repositories, seed development dengan data fiktif, test integrasi DB, dokumentasi ERD.

**Kriteria selesai fase:** migrasi dari DB kosong berhasil, seed dev idempotent, constraints diuji, test data production terpisah.


### Fase 3 — Autentikasi, owner bootstrap, RBAC

**Pekerjaan:** owner bootstrap aman sekali pakai; owner login kuat; ID+PIN employee; Argon2id; rate limit; change/reset PIN; session cookie; logout/revoke; guards dan permission tests.

**Kriteria selesai fase:** owner tidak bisa membaca PIN lama; employee lain tidak dapat diakses; auth test lulus; secret tidak terekspos; bootstrap tidak aktif setelah setup.


### Fase 4 — CRUD toko, karyawan, dan pengaturan owner

**Pekerjaan:** koneksi UI ke API+DB; tambah/edit/nonaktif toko/karyawan, ubah ID, reset PIN (menggunakan service Fase 3), setting bisnis, audit perubahan.

**Kriteria selesai fase:** owner tambah toko ketiga dan edit ID tanpa kode; unique validation; employee tidak dapat melakukan perubahan admin.


### Fase 5 — Shift dan jadwal fleksibel

**Pekerjaan:** template shift, kalender/daftar jadwal mingguan, publish, penugasan toko, overlap check, shift lintas tengah malam, audit perubahan jadwal.

**Kriteria selesai fase:** shift 20:00–05:00 valid; pindah toko tidak mengubah histori; jadwal overlap gagal aman; test lulus.


### Fase 6 — Alur absensi selfie & GPS

**Pekerjaan:** live camera, permission handling, preview/retake, kompresi foto, storage private, GPS dan akurasi, event check-in/out, waktu server, exception pending, retry/idempotency, tampilan status.

**Kriteria selesai fase:** check-in/out normal, luar area pending, GPS gagal, foto gagal, double tap, test authorization; UI mobile dicek di perangkat.


### Fase 7 — Approval & koreksi

**Pekerjaan:** employee exception/correction submission, inbox owner, detail foto/lokasi/jadwal, approve/reject, corrected record + immutable audit trail, race condition protection.

**Kriteria selesai fase:** pending/approved/rejected konsisten; original value tersimpan; approval ganda ditolak; permission tests lulus.


### Fase 8 — Dashboard monitoring & laporan dasar

**Pekerjaan:** KPI sah vs pending vs belum; filter toko/tanggal; aktivitas terbaru; detail per karyawan; pemuatan cepat; polling ringan; tabel riwayat dengan pagination.

**Kriteria selesai fase:** KPI tidak double count; dua toko dan tiga toko berjalan; mobile & laptop lulus; tidak ada data dummy di layar produksi.


### Fase 9 — Hardening, pengujian menyeluruh, dan UX polish

**Pekerjaan:** audit auth/data access, E2E skenario, tes perangkat, optimasi gambar/query, error handling, aksesibilitas, visual regression, backup/restore drill, update dokumentasi.

**Kriteria selesai fase:** checklist §16–17 terpenuhi atau kekurangan dicatat sebagai blocker; tidak ada bug kritis; UI tidak overflow di seluruh breakpoint.


### Fase 10 — Deployment, handover, dan pilot toko

**Pekerjaan:** setup Supabase project baru milik teman (Free sesuai kuota), bucket privat, **hosting legal untuk operasional komersial (bukan Vercel Hobby)**, migrasi clean, bootstrap owner, input data nyata via dashboard, domain/HTTPS, backup mandiri, monitoring, smoke test, handover dan tutorial ringkas.

**Kriteria selesai fase:** pemilik dapat menambah toko/karyawan/reset PIN/ubah aturan sendiri; data demo tidak ada di produksi; kamera dan GPS bekerja via HTTPS; backup restore diuji; pilot satu toko lalu kedua toko.


### Fase 11 (opsional, pasca-MVP) — Penambahan fitur

Izin/cuti/sakit, ekspor, impor CSV, manager role, notifikasi, analitik tambahan berdasarkan prioritas yang disetujui. **Jangan mulai tanpa PRD tambahan dan persetujuan.**

---

## 21. Definition of Ready untuk memulai fase berikutnya

Sebelum meminta AI lanjut ke fase N+1, pengguna harus mendapatkan:

- Ringkasan apa yang sudah selesai di fase N.
- Cara menjalankan aplikasi dan melihat hasilnya secara nyata.
- Bukti tes yang dilakukan, error yang masih ada, dan snapshot/screenshot UI jika relevan.
- File/commit checkpoint agar bisa rollback.
- Konfirmasi bahwa acceptance criteria fase N terpenuhi.

Jika belum memenuhi, **tetap di fase N** dan perbaiki sampai siap.

---

## 22. Risiko utama dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| PIN mudah ditebak | pembajakan akun | minimal 6 digit, hash, rate limit, lockout, reset aman |
| Foto orang lain / GPS spoof | absensi palsu | selfie langsung, audit, exception review; jangan klaim verifikasi identitas absolut |
| Foto/GPS bocor | pelanggaran privasi | bucket privat, signed URLs, RBAC, retensi, backup aman |
| Koneksi lambat | gagal absen | kompresi, retries idempotent, pesan jelas, exception/koreksi |
| Jadwal berubah | laporan tidak akurat | snapshot aturan, histori perubahan, audit |
| AI membuat terlalu banyak fitur | error & technical debt | pengerjaan per fase, DoD, tes, kontrol scope |
| Desain generik | UX buruk | design tokens, screenshot review, komponenisasi dan visual QA |
| Data dev ikut produksi | kebocoran/kekacauan | lingkungan terpisah, migrasi clean, seed dev guarded |
| Owner mengubah hal teknis sembarangan | downtime/kebocoran secret | dashboard hanya untuk setting bisnis, secret pada server |
| Vendor hosting berubah | migrasi rumit | PostgreSQL compatible, storage adapter, ENV, runbook |

---

## 23. Open decisions kecil yang perlu dikonfirmasi sebelum go-live

Dokumen ini sengaja memberikan default agar pengembangan bisa berjalan. Keputusan berikut **tidak memblokir Fase 0–5**, tetapi harus final sebelum pilot:

1. Jam/toleransi sebenarnya per toko dan kebijakan terlambat.
2. Radius GPS per toko serta bagaimana menangani gedung yang sinyal GPS-nya buruk.
3. Apakah setiap employee harus mempunyai jadwal publish sebelum absen, atau ada shift darurat yang dapat disetujui.
4. Penanganan absensi yang ditolak owner (kebijakan HR operasional).
5. Masa simpan foto, dasar pemrosesan data dan pemberitahuan kepada karyawan.
6. Masa aktif sesi login dan mekanisme keamanan HP bersama.
7. Siapa yang ditunjuk sebagai owner cadangan/administrator darurat.
8. Hosting final yang mengizinkan penggunaan komersial (Vercel Hobby hanya untuk demo), domain, serta strategi backup pada Supabase Free.

---

## 24. Hasil akhir yang harus diserahkan

1. Source code dalam repository Git, bersih dari secrets dan demo production.
2. Aplikasi employee PWA + dashboard owner responsif, UI sesuai gaya referensi.
3. Database schema/migration, storage adapter, ENV template.
4. Automated tests dan laporan hasil tes.
5. README setup lokal, development, build, deploy, troubleshooting.
6. Runbook untuk backup/restore, bootstrap owner, penggantian hosting/DB/storage.
7. Panduan singkat owner: tambah toko, tambah karyawan, edit ID, reset PIN, jadwal, approval, pengaturan.
8. Panduan singkat karyawan: login PIN, ubah PIN, selfie, izin GPS, pengajuan koreksi.
9. Catatan versi, migrasi, dan known limitations.

**Prinsip akhir: owner mengelola operasional sehari-hari dari dashboard; developer hanya dibutuhkan untuk pembaruan aplikasi dan pemeliharaan infrastruktur, bukan untuk menambah toko/karyawan atau mengubah jadwal.**

---

_Dokumen ini adalah rancangan produk dan teknis, bukan jaminan bahwa kode otomatis aman/benar tanpa review dan uji nyata. Gunakan sebagai kontrak pekerjaan AI fase demi fase._
