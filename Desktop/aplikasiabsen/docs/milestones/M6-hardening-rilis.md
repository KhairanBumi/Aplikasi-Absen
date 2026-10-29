# M6 — Hardening, QA & Rilis

| | |
|---|---|
| Status | **Berjalan** |
| Lingkup | Frontend + backend + operasional |
| Diperbarui | 29 Oktober 2026 |
| Berkas utama | `public/_headers`, `scripts/periksa-build.mjs`, `backend/deploy/`, `PANDUAN-PERBAIKAN.md` |

## Tujuan

Membuat aplikasi aman dan layak dipakai di lingkungan nyata: seluruh alur diuji
dengan backend asli, kiosk diuji di perangkat sebenarnya, data dan foto aman,
serta operasional (monitoring, backup, pemulihan) siap.

Batas milestone: tidak menambah fitur produk baru. Kalau muncul kebutuhan baru,
masukkan ke kontrak dan milestone terpisah.

## Modal awal dari milestone sebelumnya

Bagian ini bukan pekerjaan M6 yang sudah selesai; ini bekal yang sudah ada
sebelum QA dan rilis dimulai.

- [x] Header keamanan frontend di `public/_headers`: CSP, `X-Frame-Options`,
      `Referrer-Policy`, dan `Permissions-Policy`.
- [x] Pemeriksaan build yang menolak mode tiruan, akun demo, atau kunci mock di
      `dist`.
- [x] Sanitasi CSV untuk sel yang diawali `=`, `+`, `-`, atau `@`.
- [x] Penanganan `401`/`sesi_habis` yang tidak mengeluarkan petugas dari kiosk
      saat PIN salah.
- [x] Sesi disegarkan saat aplikasi dibuka; kegagalan jaringan tidak memaksa
      keluar.
- [x] PIN tidak pernah ditampilkan di layar data master.
- [x] Fokus keyboard terlihat dan animasi mengikuti `prefers-reduced-motion`.
- [x] PIN backend di-hash Argon2id; token 32 byte disimpan sebagai SHA-256,
      berlaku 12 jam, dan dicabut saat keluar.
- [x] Rate limit login dan kiosk.
- [x] Foto privat di disk privat, disajikan lewat signed URL 10 menit.
- [x] Cache Nominatim dan lock satu request.
- [x] Batas akurasi GPS 150 m dan penanda lokasi meragukan.
- [x] Audit log perubahan penting.
- [x] Contoh deployment Nginx, PHP-FPM, dan PHP di `backend/deploy/`.

## Sisa pekerjaan

### Keputusan dan kebijakan

- [x] Putuskan kiosk hanya boleh dari IP kantor atau juga untuk dinas luar.
      Allowlist IP tidak boleh memblokir absen luar yang sah.
- [x] Tetapkan masa simpan foto/absen dan siapa yang boleh meminta salinannya.
- [x] Audit ulang `PANDUAN-PERBAIKAN.md`. Beberapa item sudah selesai (mode
      tiruan DEV-only, `401`, CSP, sanitasi CSV, PIN tidak ditampilkan); jangan
      dikerjakan ulang.
- [x] Pastikan kredensial seeder (`ADMIN_NIP`, `ADMIN_PIN`) tidak dipakai di
      produksi.

### Keamanan dan operasional

- [x] Audit viewer admin. Belum ada endpoint di kontrak; tambahkan kontraknya
      lebih dulu.
- [x] Allowlist IP kantor sebagai lapisan tambahan, bukan pengganti `kiosk_id`.
- [x] Monitoring: log error, ukuran database, kapasitas foto, masa berlaku token,
      dan kesehatan server.
- [ ] Backup database dan folder foto privat, plus uji pemulihan.
- [ ] NTP di server dan verifikasi zona waktu `Asia/Jakarta`.
- [x] Deteksi anomali: PIN salah berulang, perpindahan mustahil, absen luar
      dengan akurasi kasar.
- [x] Runbook insiden, prosedur rollback, dan daftar kontak.

### Pengujian

- [x] `php artisan test` seluruh Fase 1 + Fase 2 lulus.
- [x] Uji manual frontend untuk setiap rute dan setiap peran.
- [x] Uji end-to-end di staging dengan `VITE_USE_MOCK=false`.
- [ ] Uji kiosk di perangkat sebenarnya: kamera, GPS, keyboard, layar sentuh,
      dan koneksi yang putus.
- [ ] Uji kasus gagal: server mati, jaringan putus, sesi kedaluwarsa, akun
      nonaktif, perangkat kiosk tidak terdaftar, dan foto terlalu besar.
- [x] Uji beban 50 magang dalam satu bulan; catat waktu muat laporan dan absen.
      Bukti lokal: laporan p95 1.417 ms, harian p95 881 ms (SQLite terisolasi).
- [x] Tambahkan CI otomatis untuk `npm run build` dan `php artisan test`.

### Rilis

- [ ] Verifikasi HTTPS, sertifikat, dan header keamanan di domain produksi.
- [ ] Pastikan `APP_ENV=production`, `APP_DEBUG=false`, dan `VITE_USE_MOCK`
      tidak membawa mode tiruan.
- [ ] Siapkan database produksi, migrasi, seeder admin, dan akun kiosk.
- [ ] Uji backup sebelum dan sesudah rilis.
- [ ] Umumkan prosedur ke pengguna: cara absen, menghubungi admin saat PIN
      bermasalah, dan cara mengajukan izin.
- [ ] Tanda tangan persetujuan rilis.

## Berikutnya

1. Jalankan latihan pemulihan staging dengan `backup.sh` dan `restore.sh`;
   catat tanggal dan hasilnya di `docs/RILIS.md`.
2. Uji kiosk di perangkat nyata: kamera, GPS, keyboard, layar sentuh, dan
   jaringan yang putus.
3. Verifikasi HTTPS dan header keamanan di staging.
4. Uji pembaca layar untuk pengumuman hasil kiosk dan tautan lewati.
5. Ulangi uji beban di staging MySQL dan catat p95-nya.
6. Lengkapi `docs/RILIS.md` dan minta tanda tangan persetujuan.

## Kriteria penerimaan

- [x] Seluruh tes backend lulus.
- [x] Seluruh rute frontend diuji dengan backend asli, bukan mode tiruan.
- [ ] Kiosk lulus uji kamera, GPS, dan pemulihan koneksi di perangkat nyata.
- [ ] Backup dan pemulihan sudah diuji.
- [ ] Monitoring dan peringatan dasar berjalan.
- [ ] Kebijakan retensi dan akses foto disetujui.
- [ ] Tidak ada akun demo, PIN seeder, atau mode tiruan di produksi.
- [ ] HTTPS dan header keamanan terverifikasi di domain produksi.
- [x] Uji beban 50 magang memenuhi target waktu respons.
- [x] Runbook, rollback, dan kontak insiden tersedia.
- [ ] Persetujuan rilis ditandatangani.

## Risiko dan catatan

- CI sudah ada dan menjalankan build serta tes backend. Uji kiosk, pemulihan,
  dan header staging tetap manual dan belum dijalankan.
- Audit viewer sudah tersedia; jangan menambah endpoint hapus audit.
- Allowlist IP sudah diputuskan sebagai penanda, bukan pemblokir; jangan
  mengubahnya menjadi pemblokir tanpa keputusan baru.
- Foto selfie menumpuk setiap hari. Tanpa monitoring dan retensi, disk bisa
  penuh tanpa peringatan.
- `PANDUAN-PERBAIKAN.md` ditulis sebelum beberapa perbaikan masuk. Baca kode
  sebelum mengerjakan ulang itemnya.
- Rilis tanpa uji perangkat kiosk berisiko: masalah kamera/GPS biasanya baru
  terlihat di perangkat nyata.

## Referensi

- `PANDUAN-PERBAIKAN.md` — daftar hardening dan definition of done.
- `PANDUAN-BACKEND-V2.md` — hardening dan regression test.
- `backend/README.md` — catatan keamanan dan deployment.
- `backend/deploy/README.md` — Nginx, PHP-FPM, MariaDB, Let's Encrypt, Redis,
  NTP, dan backup.
- `public/_headers`, `scripts/periksa-build.mjs`
- `docs/milestones/M5-integrasi-backend.md`
