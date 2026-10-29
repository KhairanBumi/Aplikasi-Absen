# Operasional — Aplikasi Absen

Panduan untuk PIC infrastruktur. Tidak memuat PIN, token, atau kata sandi.

## 1. Pemeriksaan harian

- Jalankan `php artisan absen:periksa` manual bila ada kecurigaan.
- Jadwal Laravel menjalankannya setiap 5 menit. Pastikan cron Laravel aktif:

```cron
* * * * * cd /var/www/aplikasiabsen/backend && php artisan schedule:run >> /dev/null 2>&1
```

- Periksa `storage/logs/laravel.log` untuk `ERROR`. Jangan menyalin isi log
  yang memuat data pribadi ke tiket publik.
- Pastikan `absen:periksa` melaporkan `status: ok`. `warning` berarti disk
  hampir penuh atau belum ada absen setelah pukul 10.00 pada hari kerja.

## 2. Kredensial backup

Buat `/etc/absen-backup.cnf` dengan hak akses 0600:

```ini
[client]
host=127.0.0.1
user=absen
password=GANTI_PASSWORD
```

Jangan menaruh berkas ini di repo. Jangan menulis kata sandi di crontab.

## 3. Backup

Jadwal harian pukul 01.00:

```cron
0 1 * * * cd /var/www/aplikasiabsen/backend && APP_DIR=/var/www/aplikasiabsen/backend BACKUP_DIR=/var/backups/absen /var/www/aplikasiabsen/backend/deploy/backup.sh >> /var/log/absen-backup.log 2>&1
```

Backup disimpan 14 hari dan terdiri dari database, foto, serta checksum.
Verifikasi mingguan:

```bash
cd /var/backups/absen
sha256sum -c "$(ls -t SHA256SUMS-* | head -1)"
```

## 4. Latihan pemulihan

Lakukan di staging, bukan produksi:

1. Siapkan database staging kosong dan salinan folder foto staging.
2. Jalankan `restore.sh` dengan `--yes` di staging.
3. Pastikan login admin, dashboard, laporan, dan satu foto lama bisa dibuka.
4. Catat tanggal, berkas backup yang dipakai, dan hasilnya di tiket rilis.

Pemulihan produksi hanya setelah aplikasi masuk maintenance:

```bash
php artisan down
DB=$(ls -t /var/backups/absen/db-*.sql.gz | head -1)
FOTO=$(ls -t /var/backups/absen/foto-*.tar.gz | head -1)
/var/www/aplikasiabsen/backend/deploy/restore.sh "$DB" "$FOTO"
php artisan up
```

Jangan menjalankan pemulihan produksi tanpa persetujuan pemilik aplikasi.

## 5. Rollback aplikasi

1. Simpan `.env` dan backup terbaru.
2. Checkout commit rilis sebelumnya.
3. `composer install --no-dev --optimize-autoloader`.
4. `npm ci && npm run build` dari akar, lalu salin `dist` ke `backend/public`.
5. `php artisan migrate --force` hanya kalau migrasi kompatibel mundur. Kalau
   tidak, pulihkan database dari backup.
6. `php artisan optimize:clear && php artisan optimize`.
7. Uji login, dashboard, kiosk, dan satu absen.

## 6. Insiden

| Insiden | Tindakan pertama |
|---|---|
| PIN diduga bocor | Nonaktifkan akun, reset PIN lewat Data Master, periksa audit dan anomali. |
| Foto bisa diakses publik | Periksa signed URL dan permission storage, putus akses, ganti kredensial bila perlu. |
| Database down | Hentikan kiosk, pulihkan dari backup, catat waktu kejadian. |
| Disk penuh | Jalankan `absen:bersihkan --force`, pindahkan backup lama, tambah kapasitas. |
| Absen ganda | Periksa `kunci_idempoten` dan log; jangan hapus baris tanpa persetujuan. |

Kontak insiden ada di password manager kantor, bukan di repo.
