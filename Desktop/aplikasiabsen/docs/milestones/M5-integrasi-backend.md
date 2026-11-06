# M5 — Integrasi Backend

| | |
|---|---|
| Status | **Selesai** |
| Lingkup | Backend + integrasi frontend |
| Diperbarui | 28 Oktober 2026 |
| Berkas utama | `backend/routes/api.php`, `backend/app/Http/Controllers/`, `backend/app/Support/Harian.php`, `src/api.js` |

## Tujuan

Mengganti mode tiruan dengan backend Laravel untuk seluruh layar, sesuai
`KONTRAK-API.md`. Milestone ini selesai kalau semua endpoint yang dipakai
frontend tersedia, aturan bisnisnya diuji, dan frontend berjalan dengan
`VITE_USE_MOCK=false`.

Batas milestone: hardening operasional, audit viewer, dan backup dibahas di
[M6](M6-hardening-rilis.md).

## Pekerjaan yang selesai

### Backend Fase 1

- [x] `POST /masuk`, `POST /keluar`, `GET /saya/profil`.
- [x] `GET /admin/dashboard`.
- [x] `GET/POST /admin/magang`, `PUT /admin/magang/{id}`.
- [x] `GET /admin/lokasi`, `GET /admin/shift`.
- [x] `GET /kiosk/lokasi`, `POST /kiosk/absen`.
- [x] Foto privat lewat signed URL 10 menit (`GET /foto/{kode}`).
- [x] PIN Argon2id, token acak 32 byte yang disimpan sebagai SHA-256 dan berlaku
      12 jam.
- [x] Rate limit login dan kiosk.
- [x] Cache Nominatim dan batas satu request.
- [x] Batas akurasi GPS 150 m dan penanda lokasi meragukan.
- [x] Audit log untuk perubahan penting.
- [x] Penyusun baris harian `App\Support\Harian`.

### Sudah selesai lebih awal (Fase 2)

- [x] `POST/PUT /admin/lokasi`.
- [x] `GET /admin/laporan`.
- [x] `GET /admin/laporan/harian`.
- [x] Tes Fase 1 + lokasi + laporan. Catatan terakhir: 15 tes, 230 assertion
      (21 Oktober 2026); jalankan ulang untuk angka terkini.

### Fase 2 — sisa M5

- [x] `GET /saya/absen?bulan=YYYY-MM`.
- [x] `GET /saya/izin`, `POST /saya/izin`.
- [x] `GET /admin/izin`, `POST /admin/izin/{id}/setujui`, `POST /admin/izin/{id}/tolak`.
- [x] Izin disetujui tersambung ke `App\Support\Harian`, dashboard, dan laporan.
- [x] `POST/PUT/DELETE /admin/shift`, termasuk tiga penolakan hapus.
- [x] `GET/POST/PUT/DELETE /admin/hari-libur`.
- [x] Regresi seluruh Fase 1 + Fase 2: 138 tes, 991 assertion (28 Oktober 2026).

### Integrasi frontend

- [x] Satu lapisan API (`src/api.js`) untuk seluruh layar.
- [x] Proxy development `/api` ke `http://127.0.0.1:8000`.
- [x] Sesi disegarkan lewat `GET /saya/profil` setiap aplikasi dibuka.
- [x] Penanganan `401`, `403`, `sesi_habis`, dan kegagalan jaringan.
- [x] Mode tiruan bisa dimatikan dengan `VITE_USE_MOCK=false`.
- [x] Layar yang endpoint-nya sudah ada dapat memakai backend asli.

## Sisa pekerjaan

| Bagian | Endpoint / pekerjaan | Status |
|---|---|---|
| Riwayat magang | `GET /saya/absen?bulan=YYYY-MM` | Selesai |
| Izin — magang | `GET /saya/izin`, `POST /saya/izin` | Selesai |
| Izin — admin | `GET /admin/izin`, `POST /admin/izin/{id}/setujui`, `.../tolak` | Selesai |
| Integrasi izin | `App\Support\Harian` + regresi laporan | Selesai |
| Tulis shift | `POST/PUT/DELETE /admin/shift` | Selesai |
| Hari libur | `GET/POST/PUT/DELETE /admin/hari-libur` | Selesai |
| Regression test | Seluruh Fase 1 + Fase 2 | Selesai |
| Uji staging | Frontend dengan `VITE_USE_MOCK=false` | Selesai — 28 Oktober 2026 |

`POST/PUT /admin/lokasi`, `GET /admin/laporan`, dan
`GET /admin/laporan/harian` tidak masuk daftar sisa karena sudah selesai.

## Uji staging

Dijalankan 28 Oktober 2026 dengan database SQLite terpisah
(`backend/database/staging.sqlite`), frontend `VITE_USE_MOCK=false` menuju
backend staging. Port 8001 dipakai karena 8000 sedang dipakai server
pengembangan; file staging dihapus setelah uji dan database pengembangan tidak
disentuh.

Rute dan alur yang diverifikasi:

- Masuk admin, tambah anak magang, lalu absen masuk dan pulang di kiosk
  (foto tersimpan privat, koordinat dan akurasi tercatat).
- Riwayat absen magang menampilkan status hari ini, bukan `belum`.
- Pengajuan cuti mengurangi kuota `sisa` dan menambah `menunggu`; persetujuan
  admin memindahkannya ke Disetujui.
- Laporan bulan berjalan menampilkan kolom cuti dan CSV terunduh.
- Beranda: `sudah_masuk + belum_masuk + izin` sama dengan total anak magang;
  orang yang izin tidak muncul di Belum Absen.
- Shift: tambah `Sore` 13.00–21.00, ubah nama, hapus; `Reguler` ditolak
  dengan 409 karena masih dipakai.
- Hari libur: menambah hari ini mengubah Beranda menjadi mode libur, menghapus
  mengembalikannya ke hari kerja.

Network hanya berisi request ke backend staging; tidak ada mock, tidak ada
response `500`. `409` pada hapus shift dan `403` pada kiosk yang perangkatnya
belum terdaftar adalah penolakan yang memang dirancang. Satu-satunya 404 adalah
`favicon.ico` yang sudah ada sebelumnya.

## Berikutnya

1. Lanjut ke [M6 — Hardening, QA & Rilis](M6-hardening-rilis.md).

## Kriteria penerimaan

- [x] `GET /saya/absen` mengirim seluruh hari dalam bulan, status benar, dan
      `telat_menit` dibaca dari baris absen.
- [x] `GET /saya/absen` memakai `App\Support\Harian` yang sama dengan
      `GET /admin/laporan/harian`.
- [x] `GET /saya/izin` mengirim riwayat pengajuan dan kuota yang bisa dijumlahkan.
- [x] `POST /saya/izin` menolak tanggal lewat, rentang tanpa hari kerja,
      tumpang tindih, absen yang sudah ada, dan cuti yang melebihi jatah.
- [x] `GET /admin/izin` mengirim jumlah seluruh status, bukan hanya yang tersaring.
- [x] Setujui/tolak menolak pengajuan yang sudah diputuskan dan mencatat audit.
- [x] Izin/cuti/sakit muncul di riwayat dan laporan dengan prioritas yang benar.
- [x] `POST/PUT/DELETE /admin/shift` berjalan, termasuk tiga penolakan hapus.
- [x] CRUD hari libur langsung memengaruhi dashboard dan laporan.
- [x] Tes laporan lama tetap lulus setelah izin disambungkan.
- [x] Tidak ada PIN/token mentah di database, log, atau response.
- [x] `php artisan test` lulus seluruh Fase 1 + Fase 2 (138 tes, 991 assertion).
- [x] Dokumentasi endpoint di `backend/README.md` diperbarui.
- [x] Frontend berjalan dengan `VITE_USE_MOCK=false` di staging (28 Oktober
      2026; seluruh alur pada bagian Uji staging lulus).

## Risiko dan catatan

- `KONTRAK-API.md` yang menang. Jangan menambah endpoint atau bentuk response
  baru tanpa memperbarui kontrak lebih dulu.
- Migration `izin` harus aman untuk data yang sudah ada; jangan menghapus atau
  menulis ulang baris absen.
- Kuota cuti hanya memotong `cuti`; pengajuan `menunggu` ikut dihitung.
- Laporan yang sudah ada tidak perlu ditulis ulang; cukup sambungkan izin di
  `Harian` dan jaga tes lama tetap lulus.
- Perbedaan kecil antara mock dan backend adalah hal biasa. Catat dan perbaiki
  di sisi yang sesuai kontrak, bukan dengan menambah pengecualian di layar.
- Angka tes 138/991 adalah hasil 28 Oktober 2026; jalankan ulang sebelum
  mengutipnya sebagai hasil terbaru.

## Referensi

- `KONTRAK-API.md` — seluruh endpoint dan aturan response.
- `PANDUAN-BACKEND-V2.md` — rincian sisa Fase 2 dan definisi selesai.
- `backend/routes/api.php`
- `backend/app/Support/Harian.php`
- `backend/app/Http/Controllers/`
- `backend/tests/Feature/`
- `src/api.js`, `vite.config.js`
