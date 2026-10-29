# Daftar Periksa Rilis — Aplikasi Absen

Rilis tidak boleh dilakukan sebelum seluruh butir wajib tercentang. Setiap
butir harus menyebut bukti: perintah, berkas, atau tangkapan layar di tiket.

Butir yang sudah tercentang di bawah adalah yang benar-benar dijalankan di
lingkungan pengembangan lokal pada 29 Oktober 2026. Butir staging, perangkat
kiosk nyata, dan produksi masih terbuka.

## 1. Pra-rilis

- [x] `npm test` lulus. Bukti: 5 tes lulus (csv + tabel), 29 Oktober 2026.
- [x] `npm run build` lulus dan `scripts/periksa-build.mjs` tidak menemukan
      akun demo/mode tiruan.
- [x] `cd backend && php artisan test` lulus seluruhnya (M5 + M6).
      Bukti: 157 tes lulus, 1062 asersi.
- [x] `composer audit` dan `npm audit --audit-level=high` tidak menemukan
      kerentanan tinggi/kritis. Temuan lain: `symfony/mime` CVE-2026-45070
      (medium, email header injection). Aplikasi ini tidak mengirim email;
      risiko diterima pemilik sampai pembaruan patch dijadwalkan.
- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_FORCE_HTTPS=true`.
- [ ] `ADMIN_PIN` produksi diisi lewat environment, bukan repo; seeder hanya
      dijalankan sekali.
- [ ] `ABSEN_IP_KANTOR` kosong atau berisi IP kantor yang benar.
- [ ] `ABSEN_FOTO_SIMPAN_HARI=180`, `ABSEN_AUDIT_SIMPAN_HARI=730`.
- [ ] NTP aktif dan `date` menunjukkan `Asia/Jakarta`.
- [x] Cron `schedule:run` aktif di kode; `php artisan schedule:list`
      menampilkan `absen:periksa` dan `absen:bersihkan`. Bukti: Task 9.
      Pemasangan cron di server staging/produksi belum dilakukan.
- [ ] Backup harian terjadwal dan satu backup manual baru saja dibuat.
- [ ] Latihan pemulihan staging berhasil (tanggal: ______).
- [x] Uji beban 50 magang: laporan p95 **1.417 ms**, harian p95 **881 ms**
      (target ≤ 2000). Bukti: `npm run uji:beban` pada staging SQLite lokal
      terisolasi, 50 magang, ±2.000 baris absen. Ulangi di staging MySQL
      sebelum rilis dan catat angkanya.
- [ ] Uji kiosk nyata: kamera, GPS, keyboard, layar sentuh, jaringan putus,
      dan kirim ulang.
- [x] Uji seluruh rute frontend dengan `VITE_USE_MOCK=false` untuk admin dan
      magang. Bukti: Task M5.13 (uji browser backend asli).
- [ ] Aksesibilitas: tautan lewati, fokus setelah rute, caption tabel, dan
      pengumuman kiosk diuji. Tautan lewati, fokus, caption, dan
      `prefers-reduced-motion` sudah diuji keyboard di browser; pengumuman
      kiosk lewat pembaca layar belum diuji karena tidak tersedia di
      lingkungan ini.

## 2. Rilis

- [ ] Salin `dist` ke `backend/public` dari akar proyek.
- [ ] `composer install --no-dev --optimize-autoloader` di backend.
- [ ] `php artisan migrate --force` (bukan `migrate:fresh`, bukan seeder rutin).
- [ ] `php artisan optimize`.
- [ ] Reload PHP-FPM.
- [ ] Verifikasi `https://<domain>/up` dan `https://<domain>/api/kiosk/lokasi`.
- [ ] Verifikasi header CSP, `X-Frame-Options`, `Referrer-Policy`,
      `Permissions-Policy`, dan HSTS.
- [ ] Login admin, buka dashboard, kiosk, laporan, audit, dan anomali.

## 3. Pasca-rilis

- [ ] Satu absen uji tercatat dan fotonya bisa dibuka lewat signed URL.
- [ ] `absen:periksa` melaporkan `status: ok`.
- [ ] Log tidak memuat PIN, token, atau `pin_hash`.
- [ ] Backup malam pertama berhasil.
- [ ] Pengguna menerima pengumuman: cara absen, menghubungi admin saat PIN
      bermasalah, dan cara mengajukan izin.

## 4. Rollback

- [ ] Commit rilis sebelumnya diketahui.
- [ ] Backup sebelum rilis tersedia.
- [ ] Langkah rollback di `docs/OPERASIONAL.md` sudah dibaca PIC.
- [ ] Rencana komunikasi ke pengguna disiapkan.

## 5. Persetujuan

| Peran | Nama | Tanggal | Tanda tangan |
|---|---|---|---|
| Pemilik aplikasi |  |  |  |
| PIC infrastruktur |  |  |  |
| Perwakilan pengguna |  |  |  |

Rilis hanya boleh dilanjutkan setelah ketiga tanda tangan ada.
