# M2 — Kiosk Absen

| | |
|---|---|
| Status | **Selesai** |
| Lingkup | Frontend + backend |
| Diperbarui | 28 Oktober 2026 |
| Berkas utama | `src/views/absen.js`, `src/kamera.js`, `src/lokasi.js`, `backend/app/Http/Controllers/KioskController.php` |

## Tujuan

Menyediakan layar absen publik di PC kiosk yang dipakai bergantian. Magang
memasukkan NIP + PIN, memilih absen di kantor atau di luar, mengambil selfie, dan
mendapat konfirmasi. Kiosk tidak boleh membuat atau membutuhkan sesi admin, dan server harus
tetap memvalidasi perangkat, PIN, lokasi, serta jenis absen.

Batas milestone: tidak ada layar admin untuk mendaftarkan atau mengelola
perangkat kiosk; pendaftaran dilakukan di sisi server/seed.

## Pekerjaan yang selesai

- [x] Rute `#/absen` bersifat publik: dapat dibuka tanpa login dan tidak membuat
      sesi baru di PC kiosk. Tautan kembali hanya muncul kalau sudah ada sesi.
- [x] Identitas perangkat dibuat sekali di `localStorage`
      (`absen-kiosk-perangkat`) dan dikirim ke server sebagai dasar device
      enrollment.
- [x] Lokasi perangkat diambil dari `GET /kiosk/lokasi`. `#/absen?lokasi=<id>`
      menentukan lokasi saat perangkat pertama terikat; setelah terikat, URL
      tidak bisa memindahkan kiosk.
- [x] Alur formulir NIP + PIN dan pilihan mode, lalu selfie, lalu kirim.
- [x] GPS diminta untuk kedua mode; mode `luar` mewajibkan koordinat dan
      menolak akurasi di atas 150 m. Akurasi di atas 50 m ditandai kasar.
- [x] Kamera selfie dengan pratinjau, ambil ulang, dan pesan yang jelas saat
      izin ditolak atau kamera tidak tersedia.
- [x] Server menentukan absen masuk atau pulang; absen ketiga pada hari yang sama
      ditolak.
- [x] Layar hasil bertahan 7 detik, lalu kembali ke layar awal. Kolom
      dikosongkan setelah 45 detik tanpa ketikan.
- [x] Timer, kamera, dan objek URL dibersihkan saat layar ditinggalkan.
- [x] Tampilan kiosk besar, jam berjalan, fokus otomatis ke NIP, dan tombol
      kembali hanya muncul kalau ada sesi.
- [x] Backend `GET /kiosk/lokasi` dan `POST /kiosk/absen`: validasi perangkat,
      PIN, mode, GPS, foto, jarak Haversine, dan penyimpanan foto privat.
- [x] Rate limit kiosk 5 percobaan gagal per NIP + IP dan per `kiosk_id` per 60
      detik.

## Verifikasi

- Buka `#/absen` di jendela privat tanpa sesi; layar harus tetap dapat dipakai.
- Untuk perangkat hasil seeder, set
  `localStorage.setItem('absen-kiosk-perangkat', 'kiosk-kantor-pusat')` seperti
  dijelaskan di `backend/README.md`.
- Tes backend di `backend/tests/Feature/Fase1Test.php` mencakup penolakan
  perangkat asing, absen masuk/pulang/ketiga, validasi foto, dan mode luar.
- Kamera dan geolocation hanya berjalan di HTTPS atau `localhost`.

## Berikutnya

1. Daftarkan setiap PC kiosk di server sebelum dipakai; id acak akan ditolak
   dengan `403`.
2. Putuskan apakah kiosk dibatasi allowlist IP kantor atau boleh dipakai untuk
   dinas luar; keputusan ini memengaruhi mode `luar` dan dibahas di
   [M6](M6-hardening-rilis.md).
3. Uji kamera, GPS, dan tata letak di perangkat kiosk sebenarnya.

## Kriteria penerimaan

- [x] Kiosk dapat dibuka tanpa login; absen tidak membutuhkan token admin.
- [x] Perangkat yang tidak terdaftar ditolak server.
- [x] NIP + PIN, mode kantor/luar, dan selfie terkirim dalam satu alur.
- [x] Mode luar tanpa GPS atau dengan akurasi > 150 m ditolak.
- [x] Absen masuk/pulang ditentukan server; absen ketiga ditolak.
- [x] Layar kembali siap untuk orang berikutnya tanpa meninggalkan timer atau
      kamera hidup.
- [x] Endpoint kiosk dan pengujian Fase 1 tersedia.

## Risiko dan catatan

- `kiosk_id` disimpan di `localStorage` dan bisa dipalsukan. Nilainya bukan
  rahasia; keamanan bertumpu pada validasi server, rate limit, dan opsional
  allowlist IP.
- Selfie mengurangi titip absen, tetapi tidak menghilangkannya. Kebijakan
  disiplin tetap dibutuhkan.
- Akurasi GPS adalah perkiraan, bukan bukti. Admin melihat `± N m` dan tautan
  peta, bukan tuduhan otomatis.
- Kamera dan geolocation memerlukan secure context. Kiosk produksi wajib HTTPS.
- Belum ada UI pendaftaran/perangkat kiosk; itu di luar kontrak saat ini.

## Referensi

- `KONTRAK-API.md` — bagian sesi dan kiosk, foto selfie.
- `PANDUAN-BACKEND-V2.md` — rate limit, GPS, foto privat.
- `src/views/absen.js`, `src/kamera.js`, `src/lokasi.js`, `src/api.js`
- `backend/routes/api.php`, `backend/app/Http/Controllers/KioskController.php`
- `backend/tests/Feature/Fase1Test.php`, `backend/README.md`
