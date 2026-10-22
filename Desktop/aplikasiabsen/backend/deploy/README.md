# Deployment Backend Fase 1

Panduan singkat untuk VPS kecil (1–2 GB RAM), Ubuntu 24.04, Nginx, PHP 8.3
FPM, MariaDB 10.11, dan HTTPS Let's Encrypt. Redis opsional.

Contoh domain: `absen.example.com`. Ganti path dan domain sesuai server.

## 1. Paket

```bash
sudo apt update
sudo apt install -y nginx mariadb-server \
  php8.3-fpm php8.3-cli php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-zip php8.3-mysql php8.3-intl php8.3-gd \
  certbot python3-certbot-nginx unzip
```

Redis (opsional, disarankan):

```bash
sudo apt install -y redis-server php8.3-redis
```

## 2. Database

```bash
sudo mariadb
```

```sql
CREATE DATABASE absen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'absen'@'127.0.0.1' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON absen.* TO 'absen'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

MariaDB hanya listen lokal secara bawaan. Jangan buka port 3306 ke internet.
Untuk VPS 1 GB, `innodb_buffer_pool_size` sekitar 128–256 MB sudah cukup.

## 3. Kode dan dependensi

Upload/clone kode ke `/var/www/aplikasiabsen` (backend ada di
`/var/www/aplikasiabsen/backend`). Lalu:

```bash
cd /var/www/aplikasiabsen/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

Isi `.env` produksi:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://absen.example.com
APP_FORCE_HTTPS=true
APP_TIMEZONE=Asia/Jakarta

DB_CONNECTION=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=absen
DB_USERNAME=absen
DB_PASSWORD=GANTI_PASSWORD_KUAT
DB_TIMEZONE=+07:00

CACHE_STORE=database
# CACHE_STORE=redis
# REDIS_CLIENT=phpredis

ADMIN_NIP=ADM001
ADMIN_PIN=GANTI_PIN_ADMIN
ADMIN_NAMA="Administrator"
ADMIN_DIVISI="Management Data"

SEED_LOKASI_NAMA="Kantor Pusat"
SEED_LOKASI_ALAMAT="Alamat kantor"
SEED_LOKASI_LINTANG=-6.2246
SEED_LOKASI_BUJUR=106.8094
SEED_LOKASI_RADIUS_M=50

SEED_SHIFT_NAMA="Reguler"
SEED_SHIFT_MASUK="08:00"
SEED_SHIFT_PULANG="17:00"
SEED_SHIFT_TOLERANSI=15

SEED_KIOSK_ID="kiosk-kantor-pusat"
SEED_KIOSK_NAMA="Kiosk Kantor Pusat"
```

`ADMIN_PIN` hanya dipakai seeder. Jangan simpan PIN asli di repo. Seeder
memakai `updateOrCreate`, jadi menjalankan `db:seed` lagi akan mengatur ulang
PIN admin ke nilai `.env` saat itu.

Migrasi dan data awal:

```bash
php artisan migrate --seed --force
```

Hak akses:

```bash
sudo chown -R www-data:www-data storage bootstrap/cache
sudo find storage bootstrap/cache -type d -exec chmod 775 {} \;
sudo find storage bootstrap/cache -type f -exec chmod 664 {} \;
```

Foto privat ada di `storage/app/private`. Jangan membuat symlink
`public/storage` ke folder itu.

## 4. Nginx dan PHP-FPM

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/absen
sudo ln -s /etc/nginx/sites-available/absen /etc/nginx/sites-enabled/absen
sudo rm -f /etc/nginx/sites-enabled/default
```

Edit domain, root, dan path sertifikat di file Nginx. Lalu PHP:

```bash
sudo cp deploy/php.ini.example /etc/php/8.3/fpm/conf.d/99-absen.ini
sudo cp deploy/php-fpm-pool.conf.example /etc/php/8.3/fpm/pool.d/absen.conf
sudo systemctl restart php8.3-fpm
sudo nginx -t
sudo systemctl reload nginx
```

Catatan:

- `client_max_body_size 2m` di Nginx dan `post_max_size=2M` di PHP harus
  kompatibel. Body terlalu besar dibalas JSON `413`, bukan HTML.
- `fastcgi_param HTTPS on` penting agar Laravel tahu request aman dan signed
  URL memakai HTTPS.
- Jangan menaruh `add_header` di dalam `location`, karena akan menimpa header
  keamanan di level `server`.
- `opcache.validate_timestamps=0` berarti PHP-FPM harus di-reload setiap
  deploy.

## 5. HTTPS Let's Encrypt

Arahkan DNS `absen.example.com` ke IP VPS, lalu:

```bash
sudo certbot --nginx -d absen.example.com
sudo systemctl status certbot.timer
```

HSTS hanya aktif setelah HTTPS benar. Kamera dan geolocation browser juga
hanya bekerja di HTTPS (atau `http://localhost`), jadi jangan jalankan kiosk
lewat `http://IP-kantor`.

## 6. Frontend

Build frontend, lalu salin hasilnya ke `backend/public`:

```bash
npm ci
npm run build
cp -r dist/* /var/www/aplikasiabsen/backend/public/
```

`index.html` disajikan oleh route `/` Laravel; aset statis dilayani Nginx.
Frontend memakai hash router, jadi tidak perlu catch-all tambahan. Pastikan
`VITE_API_BASE=/api` (same-origin) saat build produksi.

## 7. Cache produksi

```bash
cd /var/www/aplikasiabsen/backend
php artisan optimize
```

Setelah mengubah `.env` atau kode:

```bash
php artisan optimize:clear
php artisan optimize
```

## 8. Redis opsional

Kalau Redis dipasang, ubah `.env`:

```dotenv
CACHE_STORE=redis
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Redis dipakai untuk rate limit dan cache Nominatim. Tanpa Redis,
`CACHE_STORE=database` tetap bekerja karena tabel cache ikut migrasi.

## 9. Jam server

Jam absen memakai jam server. Wajib sinkron:

```bash
sudo timedatectl set-ntp true
timedatectl status
```

## 10. Backup

Contoh harian (sesuaikan kredensial dan folder):

```bash
sudo mkdir -p /var/backups/absen
mysqldump --single-transaction -u absen -p absen | gzip > /var/backups/absen/db-$(date +%F).sql.gz
tar czf /var/backups/absen/foto-$(date +%F).tar.gz \
  -C /var/www/aplikasiabsen/backend/storage/app/private absen
```

Simpan juga salinan `.env` di tempat aman. Backup foto dan database harus
berpasangan; memulihkan salah satu saja akan membuat baris absen kehilangan
fotonya.

## 11. Kiosk baru

Fase 1 belum punya endpoint admin untuk mendaftarkan perangkat. Daftarkan
lewat SQL setelah tahu `lokasi_id`:

```sql
SELECT id, nama FROM lokasi;
INSERT INTO perangkat_kiosk (id, nama, lokasi_id, aktif, created_at)
VALUES ('kiosk-gudang-cikarang', 'Kiosk Gudang Cikarang', 2, 1, NOW());
```

Di browser kiosk, set identitas perangkat sebelum halaman kiosk dipakai:

```js
localStorage.setItem('absen-kiosk-perangkat', 'kiosk-gudang-cikarang');
location.reload();
```

`POST /kiosk/absen` menolak `kiosk_id` yang tidak terdaftar/nonaktif dengan
`403`.

## 12. Verifikasi

```bash
curl -i https://absen.example.com/api/kiosk/lokasi?perangkat=kiosk-kantor-pusat
curl -i https://absen.example.com/up
```

Periksa:

- Response JSON, bukan HTML.
- Header CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, dan
  HSTS ada.
- Login admin berhasil, `GET /api/saya/profil` mengembalikan objek yang sama.
- Absen kiosk menyimpan foto di `storage/app/private/absen/...`, dan URL
  `/storage/...` tidak bisa diakses langsung.
- `php artisan test` lulus di server (opsional, butuh SQLite/DB test).

## 13. Firewall

Hanya buka 22, 80, dan 443. Jangan buka 3306 (MariaDB) atau 6379 (Redis) ke
internet.
