# Aplikasi Absen — Backend

Backend Laravel untuk Aplikasi Absen. Seluruh endpoint pada `KONTRAK-API.md`
sudah tersedia, termasuk riwayat, izin/cuti, shift, hari libur, audit, dan
anomali. Petunjuk produksi ada di `docs/OPERASIONAL.md` dan `docs/RILIS.md`.

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
| GET | `/api/saya/absen` | Riwayat harian magang satu bulan |
| GET | `/api/saya/izin` | Riwayat izin + kuota cuti magang |
| POST | `/api/saya/izin` | Ajukan izin/cuti/sakit |
| GET | `/api/admin/dashboard` | Ringkasan beranda |
| GET | `/api/admin/magang` | Semua akun + daftar divisi |
| POST | `/api/admin/magang` | Buat akun |
| PUT | `/api/admin/magang/{id}` | Ubah sebagian, reset PIN |
| GET | `/api/admin/izin` | Daftar izin + jumlah tiap status |
| POST | `/api/admin/izin/{id}/setujui` | Setujui pengajuan |
| POST | `/api/admin/izin/{id}/tolak` | Tolak pengajuan + catatan |
| GET | `/api/admin/lokasi` | Semua lokasi |
| POST | `/api/admin/lokasi` | Tambah lokasi |
| PUT | `/api/admin/lokasi/{id}` | Ubah lokasi |
| GET | `/api/admin/shift` | Semua shift |
| POST | `/api/admin/shift` | Tambah shift |
| PUT | `/api/admin/shift/{id}` | Ubah shift (parsial) |
| DELETE | `/api/admin/shift/{id}` | Hapus shift bila tidak dipakai |
| GET | `/api/admin/hari-libur` | Daftar hari libur |
| POST | `/api/admin/hari-libur` | Tambah hari libur |
| PUT | `/api/admin/hari-libur/{id}` | Ubah hari libur |
| DELETE | `/api/admin/hari-libur/{id}` | Hapus hari libur |
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

Tes fitur mencakup login/profil/logout, rate limit, CRUD magang, lokasi, shift,
hari libur, laporan bulanan/harian, riwayat magang, pengajuan/izin admin,
kuota cuti, serta kiosk (masuk/pulang/ketiga, validasi foto, mode luar,
perangkat asing, signed URL foto).

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
