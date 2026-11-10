# Autentikasi — Fase 3

## Menjalankan nanti

Migrasi bersifat lokal dan belum dijalankan pada Supabase. Pilih metode instalasi pada `supabase/README.md`. Database tes PGlite hanya digunakan oleh test runner, tidak menjadi fallback runtime aplikasi.

Setelah database tersedia, isi `.env.local` (jangan commit): DATABASE_URL, APP_BASE_URL (origin URL aplikasi), APP_BUSINESS_ID (UUID bisnis baru), SESSION_SECRET (acak minimal 32 karakter). Di produksi APP_BASE_URL harus HTTPS. APP_BUSINESS_ID dipakai runtime dan bootstrap untuk mengikat akun ke satu usaha.

Bootstrap membutuhkan BOOTSTRAP_OWNER_ID, BOOTSTRAP_OWNER_PASSWORD (minimal 12 karakter), BOOTSTRAP_OWNER_NAME (default Owner Reza), dan BOOTSTRAP_BUSINESS_NAME (default Absensi Kita). Jalankan `pnpm owner:bootstrap` satu kali, lalu hapus BOOTSTRAP_OWNER_* dari environment. Tidak ada endpoint bootstrap. Advisory lock transaksi dan marker per business menolak pemanggilan berikutnya, bahkan bila owner dinonaktifkan. Jangan bootstrap pada bisnis seed demo yang sudah mempunyai profil owner.

Buka `/login`, pilih Owner atau Karyawan. Halaman `/account` dijaga di server. Tanpa database/ENV valid, login mengembalikan 503 dan pesan layanan belum tersedia. Halaman `/` tetap merupakan demo visual berlabel DEMO dari Fase 1, bukan dashboard akun terautentikasi. CRUD produksi pada Fase 4 akan menggunakan guards ini.

## Kontrak API

- POST `/api/v1/auth/owner/login`: `{code, credential}` (password).
- POST `/api/v1/auth/employee/login`: `{code, credential}` (PIN).
- GET `/api/v1/me`: identitas sendiri dan mustChangePin, tanpa hash atau credential.
- POST `/api/v1/auth/change-pin`: `{currentPin, newPin}`; hanya employee sendiri; PIN baru 6–12 digit; mencabut seluruh sesi setelah sukses.
- POST `/api/v1/auth/logout`: `{}`; revoke sesi dan hapus cookie.
- POST `/api/v1/employees/:id/reset-pin`: `{}`; owner bisnis yang sama, target employee saja; menghasilkan PIN sementara, mencabut sesi dan mencatat audit. Response no-store hanya menampilkan PIN pada saat reset; tidak ada endpoint untuk mengambil PIN lama.

Seluruh POST mewajibkan JSON, Origin sama persis dengan APP_BASE_URL, dan ukuran body maksimal 4 KB. Token hanya dalam cookie HttpOnly, SameSite=Lax, Path=/; Secure dan prefix __Host- saat production. TTL 7 hari; status akun, bisnis, expiry, revocation dan kewajiban ganti PIN diperiksa di database setiap akses.

## Keamanan yang diuji

Argon2id 19 MiB, 2 iterasi, parallelism 1; token acak 256 bit disimpan SHA-256. Password owner terpisah dari PIN. Hash dummy dipakai saat ID tidak ditemukan. Login salah memiliki pesan yang sama untuk ID tidak ada, password salah atau akun nonaktif. Rate limit disimpan di PostgreSQL (5 percobaan per ID/role dan 100 total per bisnis dalam 15 menit); key ID di-HMAC. Batas global konservatif dapat menyebabkan pengguna sah menunggu saat serangan; tuning dan observabilitas diperlukan sebelum pilot. Change PIN dan reset juga dibatasi. Audit tidak memuat PIN/password/token.

Session temporary hanya bisa memeriksa identitas, mengganti PIN, dan logout; guard resource lainnya menolaknya. Guard role owner dan guard ownership/business tersedia di `src/server/auth/types.ts`. Akses manager lintas toko belum diaktifkan.

Tests menjalankan migrasi asli dan service/handler HTTP dengan PostgreSQL terisolasi: bootstrap satu kali, Argon2id, token hash, PIN awal, reset, revocation, akun nonaktif, expiry, ownership, brute force, CSRF, cookie dan respons 503. File SQL gabungan diuji pada database kosong dan tidak membuat akun demo.

## Batas verifikasi

Login berhasil melalui browser terhadap PostgreSQL/Supabase cloud belum diuji karena koneksi ditunda. Service dan HTTP handler diuji dengan database PostgreSQL tes. Halaman login kedua peran diperiksa pada 320/375/390/768/1440 dan screenshot disimpan; kondisi layanan belum siap diuji di browser. Halaman akun setelah login belum di-review pada runtime database nyata. MFA owner belum diimplementasikan; diperlukan keputusan sebelum pilot. Uji concurrency banyak koneksi, perangkat asli, serta tuning Argon2/server/rate limit tetap diperlukan pada fase hardening.

Retensi teknis: hapus bucket rate limit yang resets_at lebih tua dari satu hari melalui maintenance terotorisasi; jangan menghapus audit. Cleanup session kedaluwarsa direncanakan dalam runbook operasi. Tidak ada credential atau token dicetak dalam log aplikasi.

## Hardening Fase 9

Owner dapat mengganti password sendiri dari `/account` melalui POST `/api/v1/auth/change-password` dengan password lama; seluruh sesi lama dicabut dan harus login kembali. PIN lama tetap tidak bisa dibaca owner. Login berhasil mereset budget kegagalan per ID; budget global tetap berlaku.

Runtime memvalidasi origin/protokol, produksi HTTPS, PostgreSQL TLS remote terverifikasi dan key/secret. `pnpm env:check` kini memeriksa konfigurasi runtime, bukan hanya field nonsecret Fase 0; koneksi diuji terpisah. CA provider dapat diisi melalui DATABASE_SSL_CA. Semua log unexpected memakai allowlist/requestId tanpa password/PIN/token/SQL. MFA aplikasi dan native concurrency/acceptance perangkat masih belum diuji/diimplementasikan sesuai [checkpoint hardening](hardening.md).
