# Aplikasi Absen — Backend Fase 1

Backend Laravel untuk Aplikasi Absen. Isi repo ini **Fase 1** plus sebagian
Fase 2: tulis lokasi (`POST/PUT /admin/lokasi`) dan laporan admin
(`GET /admin/laporan`, `GET /admin/laporan/harian`). Endpoint Fase 2 lain
(riwayat magang, izin/cuti, tulis shift/hari libur) belum dibuat.

## Stack

- Laravel 13 / PHP 8.3+
- MariaDB 10.11 (produksi), SQLite (pengembangan lokal)
- Nginx + PHP-FPM
- Redis opsional untuk cache dan rate limit
- Foto di disk privat `storage/app/private`, disajikan lewat signed URL 10 menit
- HTTPS Let's Encrypt

## Menjalankan lokal

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Untuk lokal, ubah `.env`:

```dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000
APP_FORCE_HTTPS=false
DB_CONNECTION=sqlite
CACHE_STORE=file
HASH_DRIVER=argon2id

ADMIN_NIP=ADM001
ADMIN_PIN=1111
```

`ADMIN_NIP` dan `ADMIN_PIN` hanya dipakai seeder. PIN asli tidak boleh
ditulis di repo; isi lewat `.env` atau environment server.

```bash
touch database/database.sqlite
php artisan migrate:fresh --seed
php artisan serve
```

Seeder membuat satu admin, satu lokasi, satu shift `Reguler` 08:00–17:00
(toleransi 15 menit), satu kiosk `kiosk-kantor-pusat`, dan hari libur tetap
tahun berjalan.

## Kiosk

Frontend menyimpan identitas perangkat di `localStorage` dengan kunci
`absen-kiosk-perangkat`. Untuk memakai kiosk hasil seeder, buka DevTools di
halaman kiosk lalu jalankan:

```js
localStorage.setItem('absen-kiosk-perangkat', 'kiosk-kantor-pusat');
location.reload();
```

Tanpa itu frontend membuat id acak, dan `POST /kiosk/absen` akan menolaknya
dengan `403` karena perangkat tidak terdaftar. Ini memang lapisan keamanan,
bukan bug.

## Endpoint yang tersedia

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/masuk` | NIP + PIN, rate limit |
| POST | `/api/keluar` | Cabut token |
| GET | `/api/saya/profil` | Profil pengguna aktif |
| GET | `/api/admin/dashboard` | Ringkasan beranda |
| GET | `/api/admin/magang` | Semua akun + daftar divisi |
| POST | `/api/admin/magang` | Buat akun |
| PUT | `/api/admin/magang/{id}` | Ubah sebagian, reset PIN |
| GET | `/api/admin/lokasi` | Semua lokasi |
| POST | `/api/admin/lokasi` | Tambah lokasi |
| PUT | `/api/admin/lokasi/{id}` | Ubah lokasi |
| GET | `/api/admin/shift` | Semua shift |
| GET | `/api/admin/laporan` | Rekap absen semua magang satu bulan |
| GET | `/api/admin/laporan/harian` | Rincian harian satu magang |
| GET | `/api/kiosk/lokasi` | Lokasi perangkat |
| POST | `/api/kiosk/absen` | Absen masuk/pulang + foto |
| GET | `/api/foto/{kode}` | Signed URL foto privat |

Kontrak bentuk response ada di `../KONTRAK-API.md`.

## Pengujian

```bash
php artisan test
```

Tes fitur mencakup login/profil/logout, rate limit, CRUD magang, tulis lokasi,
laporan bulanan/harian, penolakan perangkat kiosk asing, absen masuk/pulang/ketiga,
validasi foto, mode luar, dashboard hari kerja/libur, signed URL foto, dan
penolakan akses langsung ke folder privat.

## Catatan keamanan

- PIN di-hash Argon2id; tidak pernah dikembalikan API atau ditulis ke audit.
- Token bearer 32 byte acak, disimpan sebagai SHA-256, berlaku 12 jam.
- Foto hanya di disk privat. Route `storage.local` dimatikan; akses lewat
  signed URL berumur 10 menit dengan validasi prefix path.
- Rate limit login 5 gagal per NIP+IP per 60 detik. Kiosk 5 gagal per NIP+IP
  dan per `kiosk_id`.
- Header CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, dan HSTS
  dipasang middleware dan contoh Nginx.
- `APP_DEBUG=false` dan `APP_ENV=production` wajib di server.

## Deployment

Lihat `deploy/README.md` untuk Nginx, PHP-FPM, MariaDB, Let's Encrypt, Redis,
NTP, dan backup.
