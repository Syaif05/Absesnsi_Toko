# API owner yang tersedia — Fase 4

Semua response menggunakan `{ data: ... }` atau `{ error: { code, message, fields?, requestId } }`; Cache-Control no-store. Sesi owner aktif dan business yang sesuai wajib. Semua write memerlukan Content-Type JSON dan Origin yang sama dengan APP_BASE_URL. Error: 400 validasi/konfirmasi, 401 login, 403 izin/CSRF, 404 resource tak terlihat, 409 kode duplikat/versi konflik, 503 infrastruktur belum tersedia.

| Method | Endpoint | Isi |
|---|---|---|
| GET/POST | `/api/v1/stores` | Daftar / tambah toko |
| GET/PATCH | `/api/v1/stores/:id` | Detail / edit atau nonaktif/aktif |
| GET/POST | `/api/v1/employees` | Daftar employee / tambah dengan PIN sekali tampil |
| GET/PATCH | `/api/v1/employees/:id` | Detail / edit ID, profil, penugasan atau status |
| POST | `/api/v1/employees/:id/reset-pin` | Reset PIN melalui service Fase 3 |
| GET/PATCH | `/api/v1/settings` | Baca / ubah pengaturan whitelist |

GET daftar mendukung `q`, `status=active|inactive`, `offset`; employee juga `storeId`. Response `{items, hasMore, nextOffset}` berisi maksimal 50 data per halaman. Daftar tidak menyertakan hash/token/PIN.

POST toko: `{name, code, address, lat, lng, radiusM?, isActive?, operatingHours?}`. PATCH menerima subset field tersebut, ditambah `confirmSensitive:true` bila mengubah status. Radius 10–2000 m; koordinat valid.

POST employee: `{fullName, code?, storeId?, status?, phone?, joinedAt?}`. Code kosong/tidak ada di API berarti otomatis hanya bila field dihilangkan; UI menghilangkan field kosong. joinedAt memakai YYYY-MM-DD. Response `{employee, temporaryPin}`; simpan PIN secara aman saat respons pertama. PATCH menerima subset field; perubahan code/status/storeId memerlukan `confirmSensitive:true`. storeId dan field opsional bisa null untuk mengosongkan. Role, businessId, hash dan credential tidak dapat dikirim melalui form ini.

PATCH settings mengirim snapshot lengkap `{businessName, timezone, accent, radiusM, accuracyM, graceMinutes, version}` dari GET terakhir. version diperiksa secara atomik; konflik mengembalikan 409. Nama/branding/aturan hanya menyimpan data bisnis, tidak ada key API atau secret. Semua mutation membuat audit dalam transaksi yang sama.
