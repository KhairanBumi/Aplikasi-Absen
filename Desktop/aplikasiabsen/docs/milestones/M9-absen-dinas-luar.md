# M9 — Absen Dinas Luar Mandiri & Persetujuan Admin

| | |
|---|---|
| Status | **Berjalan** |
| Lingkup | Keduanya (Backend & Frontend) |
| Branch | `feat/m9-absen-dinas-luar` |
| Berkas utama | `KONTRAK-API.md`, `backend/database/migrations/*_add_persetujuan_dinas_to_absen_table.php`, `backend/app/Models/Absen.php`, `backend/app/Http/Controllers/SayaAbsenController.php`, `backend/app/Http/Controllers/AdminAbsenDinasController.php`, `backend/app/Support/Harian.php`, `backend/app/Http/Controllers/DashboardController.php`, `backend/app/Http/Controllers/AdminLaporanController.php`, `backend/routes/api.php`, `src/menu.js`, `src/main.js`, `src/mock.js`, `src/views/absen-dinas.js`, `src/views/absen-dinas-masuk.js` |

## Tujuan

Menyediakan jalur absensi mandiri khusus peserta magang yang bertugas di luar
kantor (`#/absen-dinas`) tanpa membuka akses ke terminal kiosk utama kantor
(`PerangkatKiosk`), dilengkapi halaman verifikasi dan persetujuan oleh admin
(`#/absen-dinas-masuk`).

Setiap absen dinas luar menangkap waktu server aktual, foto selfie kamera
langsung, koordinat GPS (beserta alamat reverse-geocoding), dan keterangan
tugas dinas, lalu menyimpannya ke tabel `absen` dengan status awal
`menunggu`. Admin memeriksa bukti foto, lokasi, dan keterangan dinas untuk
menyetujui (`disetujui`) atau menolak dengan alasan wajib (`ditolak`).

Batas milestone:
- Tidak mengubah mekanisme autentikasi perangkat `PerangkatKiosk` maupun alur
  `POST /api/kiosk/absen` pada `#/absen`.
- Tidak mengubah `gradient.json`, splash loader BPJS, maupun token material kaca
  dasar yang telah ditetapkan pada M7.
- Tidak melakukan `git push` atau merge otomatis ke `main`.

## Arsitektur & Aturan Bisnis

1. **Identitas Terkunci ke Token Sesi:** `POST /api/saya/absen` mengambil
   `pengguna_id` secara eksklusif dari middleware `auth.token`, menutup celah
   titip absen antar-peserta magang.
2. **Dukungan Mixed Day:** Satu hari kerja dapat berisi kombinasi absen kiosk
   dan absen dinas luar (misalnya `masuk` lewat kiosk kantor berstatus
   `disetujui`, lalu `pulang` dari lokasi dinas luar berstatus `menunggu`).
3. **Siklus Status & Dampak ke Rekap Harian (`Harian::susun`):**
   - `disetujui`: dihitung sebagai kehadiran sah (`tepat` atau `telat`); absen
     `pulang` saja dihitung `tepat`.
   - `menunggu`: ditampilkan dengan status `menunggu` pada riwayat dan
     dashboard; belum dihitung `hadir`, tetapi juga tidak ditandai `alpha`.
   - `ditolak`: tidak dihitung sebagai kehadiran sah dan menampilkan catatan
     penolakan admin kepada peserta magang; peserta dapat mengirim ulang absen
     pada sesi (`tipe`) yang sama jika masih di hari yang sama.
4. **Standar UI/UX Pro Max & Material Glass M7:**
   - Kartu ringkasan memakai `KARTU_RINGKASAN` (`kaca-lembut` 0.70); kartu
     formulir dan tabel daftar memakai `KARTU` (`kaca-kartu` 0.72 tanpa
     `backdrop-filter` agar performa scroll tetap ringan); dialog penolakan dan
     pratinjau foto memakai `kaca-tebal` (0.92).
   - Seluruh teks sekunder menggunakan `text-muted` / `text-ink/70` dan lencana
     status menggunakan shade `-800` (`emerald-800`, `amber-800`, `rose-800`)
     agar rasio kontras tetap `>= 4.5:1`.
   - Target sentuh seluruh tombol dan input minimal `44×44px` (`min-h-11`).

## Perubahan Skema & Kontrak API

### 1. Perubahan Tabel `absen`
- `status_persetujuan`: `string(20)->default('disetujui')` (`disetujui` | `menunggu` | `ditolak`) — default `'disetujui'` menjaga kompatibilitas penuh dengan absen Kiosk.
- `keterangan_dinas`: `text()->nullable()` — alasan/lokasi tugas dinas dari peserta magang.
- `catatan_admin`: `string(500)->nullable()` — alasan penolakan atau catatan verifikasi dari admin.
- `diputuskan_oleh`: `foreignId()->nullable()->constrained('pengguna')->nullOnDelete()` — ID admin pemutus.
- `diputuskan_at`: `timestamp()->nullable()` — waktu keputusan admin.
- `kiosk_id`: `string(64)->nullable()->change()` — baris absen mandiri tidak berasal dari perangkat kiosk. Tambahkan indeks unik (`pengguna_id`, `kunci_idempoten`) untuk idempotensi baris mandiri; `kunci_idempoten` tetap nullable agar baris lama dan kiosk tidak terganggu.

### 2. Endpoint Baru (`routes/api.php`)
- `POST /api/saya/absen` (`auth.token`, role `magang`): submit absen dinas luar (`masuk`/`pulang` otomatis) beserta foto selfie live, GPS, `keterangan_dinas`, dan `kunci_idempoten`.
- `GET /api/saya/absen-dinas` (`auth.token`, role `magang`): daftar riwayat pengajuan absen dinas milik user login beserta status dan `catatan_admin`.
- `GET /api/admin/absen-dinas?status=menunggu|disetujui|ditolak|semua` (`auth.token`, `admin`): daftar antrean absen dinas luar lengkap dengan counter per tab status.
- `POST /api/admin/absen-dinas/{id}/setujui` (`auth.token`, `admin`): menyetujui absen dinas luar (`status_persetujuan = 'disetujui'`) dan mencatat audit log.
- `POST /api/admin/absen-dinas/{id}/tolak` (`auth.token`, `admin`): menolak absen dinas luar dengan `catatan` wajib (4–500 karakter) dan mencatat audit log.

## Pekerjaan yang Harus Diselesaikan

### Tahap 1 — Persiapan Branch & Kontrak API
- [x] Buat branch baru `feat/m9-absen-dinas-luar` dari `main`.
- [x] Daftarkan M9 pada `docs/README.md` dan lengkapi spesifikasi 5 endpoint M9
      pada `KONTRAK-API.md`.

### Tahap 2 — Skema Database & Model
- [x] Buat migration `add_persetujuan_dinas_to_absen_table` dan jalankan migrasi.
- [x] Perbarui `App\Models\Absen` (fillable/guarded, casts, relasi `pemutus()`,
      dan serializer array API).

### Tahap 3 — Backend Magang & Kalkulasi Rekap (TDD)
- [x] Implementasikan `SayaAbsenController::store` dan `SayaAbsenController::dinas`
      (validasi foto, GPS + Nominatim, idempotensi, penanganan kirim ulang saat
      status sebelumnya `ditolak`, serta pencatatan `Audit`).
- [x] Sesuaikan `App\Support\Harian::susun()`, `DashboardController`, dan
      `AdminLaporanController` terhadap status `menunggu` dan `ditolak`.
- [x] Tulis dan luluskan `SayaAbsenDinasTest.php`.

### Tahap 4 — Backend Persetujuan Admin (TDD)
- [ ] Buat `AdminAbsenDinasController` (`index`, `setujui`, `tolak`) dengan
      transaksi database (`lockForUpdate`) dan audit log.
- [ ] Tulis dan luluskan `AdminAbsenDinasTest.php`.

### Tahap 5 — Frontend Halaman Magang (`#/absen-dinas`)
- [ ] Daftarkan rute dan menu `#/absen-dinas` (`peran: ['magang']`) di
      `src/menu.js` dan `src/main.js`.
- [ ] Bangun `src/views/absen-dinas.js` (status sesi hari ini, GPS otomatis
      `src/lokasi.js`, input `keterangan_dinas`, kamera selfie live
      `src/kamera.js` dengan pembersihan track aman, antrean offline
      `localStorage` + `kunci_idempoten`, serta riwayat status persetujuan).
- [ ] Tambahkan handler mock endpoint magang di `src/mock.js`.

### Tahap 6 — Frontend Halaman Admin (`#/absen-dinas-masuk`) & Verifikasi Akhir
- [ ] Daftarkan rute dan menu `#/absen-dinas-masuk` (`peran: ['admin']`) di
      `src/menu.js` dan `src/main.js`.
- [ ] Bangun `src/views/absen-dinas-masuk.js` (tab filter status + counter,
      tabel responsif & kartu seluler, pratinjau foto selfie, alamat Nominatim +
      jarak + akurasi GPS, serta aksi Setujui & Tolak wajib catatan).
- [ ] Tambahkan handler mock endpoint admin di `src/mock.js`.
- [ ] Jalankan seluruh test suite dan build produksi, lalu perbarui status M9.

## Verifikasi

```bash
# Backend (dari Desktop/aplikasiabsen/backend)
php artisan test

# Frontend (dari Desktop/aplikasiabsen)
npm test
npm run build
```

## Kriteria Penerimaan

- [ ] Seluruh pekerjaan dikerjakan di atas branch `feat/m9-absen-dinas-luar` tanpa `git push` otomatis.
- [ ] Peserta magang dapat melakukan absen masuk/pulang dinas luar dari perangkat sendiri dengan foto live, GPS, dan keterangan dinas.
- [ ] Peserta magang tidak dapat memanipulasi `pengguna_id` maupun mengakses terminal kiosk admin.
- [ ] Absen dinas luar otomatis berstatus `menunggu` dan tampil di menu persetujuan admin lengkap dengan foto, alamat Nominatim, akurasi GPS, dan keterangan.
- [ ] Admin dapat menyetujui atau menolak (wajib isi catatan penolakan), dan keputusan langsung memperbarui rekap harian serta log audit.
- [ ] Tampilan mematuhi sistem material kaca M7 dan standar kontras/aksesibilitas UI/UX Pro Max (`>= 4.5:1`, target sentuh `>= 44px`, tanpa overflow horizontal).
- [ ] `php artisan test`, `npm test`, dan `npm run build` lulus tanpa galat.

## Risiko & Catatan Teknis

- **Unique Index Harian (`pengguna_id`, `tanggal`, `tipe`):** Jika absen dinas luar ditolak admin dan peserta harus mengirim ulang pada hari & tipe yang sama, backend wajib memperbarui record berstatus `ditolak` tersebut (sambil tetap mencatat histori ke tabel `audit`) agar tidak terbentur galat duplikat indeks unik database.
- **Konteks Aman Kamera & GPS:** Pada pengujian lewat jaringan lokal selain `localhost`, browser mewajibkan `HTTPS` untuk `getUserMedia` dan `geolocation`. Pastikan pesan galat dari `src/kamera.js` dan `src/lokasi.js` ditampilkan informatif di layar.