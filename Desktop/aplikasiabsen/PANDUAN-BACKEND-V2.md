# Panduan Backend v2 — Fase 2

Dokumen ini adalah **versi eksekusi** dari `PANDUAN-BACKEND.md`. Isinya bukan
kontrak baru: bentuk request/response tetap mengikuti **`KONTRAK-API.md`**.

Cara membacanya:

- `PANDUAN-BACKEND.md` → alur aplikasi, jebakan, dan contoh `curl`.
- `KONTRAK-API.md` → bentuk data yang wajib dipatuhi.
- Dokumen ini → sisa pekerjaan Fase 2 dan batas selesainya.

> **Status per 21 Oktober 2026**
>
> - Fase 1 sudah selesai: masuk/keluar/profil, kiosk, dashboard, dan baca data
>   master.
> - Sudah selesai lebih awal: tulis lokasi (`POST/PUT /admin/lokasi`), laporan
>   bulanan (`GET /admin/laporan`), dan laporan harian
>   (`GET /admin/laporan/harian`).
> - Tes saat ini: **15 tes, 230 assertion lulus**.
> - Dokumen ini **hanya berisi sisa Fase 2**. Bagian yang sudah jadi sengaja
>   dihapus supaya tidak dikerjakan dua kali.

---

## 0. Fondasi yang sudah ada

Jangan dikerjakan ulang:

| Bagian | Status |
|---|---|
| Masuk / keluar / profil | Selesai |
| Kiosk lokasi + absen | Selesai |
| Admin magang baca/tambah/ubah | Selesai |
| Dashboard admin | Selesai |
| Baca lokasi dan shift | Selesai |
| Tulis lokasi (`POST/PUT /admin/lokasi`) | Selesai |
| Laporan bulanan (`GET /admin/laporan`) | Selesai |
| Laporan harian (`GET /admin/laporan/harian`) | Selesai |
| Penyusun daftar harian (`App\Support\Harian`) | Selesai |
| Foto privat + signed URL 10 menit | Selesai |
| Cache Nominatim + lock 1 request | Selesai |
| Batas akurasi GPS 150 m | Selesai |
| Rate limit login dan kiosk | Selesai |
| Audit log perubahan penting | Selesai |
| Tes Fase 1 + lokasi + laporan | Selesai |

Catatan penting:

- Laporan sudah memakai `App\Support\Harian::susun()`. Jangan membuat
  perhitungan harian kedua di controller lain.
- Laporan **belum bisa menampilkan izin/cuti/sakit** karena tabel `izin` belum
  ada. Nilainya masih `0` sampai bagian izin di bawah dikerjakan. Itu bukan bug.
- `GET /saya/absen` belum ada, tetapi fungsi hariannya sudah siap dipakai.

---

## 1. Sisa pekerjaan Fase 2

| Bagian | Endpoint | Status |
|---|---|---|
| Riwayat magang | `GET /saya/absen?bulan=YYYY-MM` | Belum |
| Izin & cuti — magang | `GET /saya/izin`, `POST /saya/izin` | Belum |
| Izin & cuti — admin | `GET /admin/izin`, `POST /admin/izin/{id}/setujui`, `POST /admin/izin/{id}/tolak` | Belum |
| Integrasi izin ke laporan | `App\Support\Harian` + regresi laporan | Belum |
| Data master — shift | `POST/PUT/DELETE /admin/shift` | Belum |
| Data master — hari libur | `GET/POST/PUT/DELETE /admin/hari-libur` | Belum |
| Hardening | Audit viewer, monitoring, allowlist IP | Sebagian |
| Regression test | Seluruh Fase 1 + Fase 2 | Belum |

`POST/PUT /admin/lokasi`, `GET /admin/laporan`, dan
`GET /admin/laporan/harian` **tidak ada di daftar ini** karena sudah selesai.

---

## 2. Urutan kerja

Kerjakan berurutan:

1. Riwayat magang (`GET /saya/absen`), memakai `App\Support\Harian` yang sudah
   dipakai laporan harian.
2. Izin & cuti: migration/model, endpoint magang, endpoint admin.
3. Sambungkan izin ke `App\Support\Harian`, lalu jalankan ulang tes laporan.
4. Tulis shift.
5. CRUD hari libur.
6. Hardening dan audit viewer.
7. Regression test seluruh Fase 1 + Fase 2.

Laporan tidak perlu ditulis ulang. Yang perlu dijaga: setiap perubahan pada
`App\Support\Harian` harus tetap membuat tes laporan lulus.

---

## 3. Detail pekerjaan

### 3.1. Riwayat magang — `GET /saya/absen`

- Kirim **seluruh hari dalam bulan**, termasuk Sabtu, Minggu, dan tanggal merah.
- Status yang dikenal: `tepat`, `telat`, `izin`, `cuti`, `sakit`, `alpha`,
  `libur`, `belum`.
- Prioritas status:
  `libur > tepat/telat > izin/cuti/sakit > belum > alpha`.
- `hari_kerja` dihitung sejak `masuk_kerja` magang, bukan sebulan penuh.
- `telat_menit` dibaca dari baris absen, jangan dihitung ulang dari shift.
- `mode`, `lintang`, `bujur`, `akurasi`, `jarak_m`, `lokasi_meragukan`, dan
  `lokasi_teks` ikut dikirim.
- Untuk `mode: "luar"`, `lokasi` diisi `"Dinas luar"` dan `lokasi_kantor` berisi
  nama titik kantor.
- Baris lama tanpa foto boleh `foto: null`.
- Urutkan **menaik** menurut tanggal.

Endpoint ini **wajib memakai `App\Support\Harian::susun()`** yang sudah dipakai
`GET /admin/laporan/harian`. Jangan membuat perhitungan kedua.

Yang masih perlu ditambahkan di controller:

- Route `GET /saya/absen` dengan middleware `auth.token`.
- Validasi `bulan` (`YYYY-MM`, `422` kalau salah).
- Ambil pengguna dari `$request->attributes->get('pengguna')`.
- Balas `bulan`, `hari_kerja`, `ringkasan`, dan `data` sesuai kontrak.

### 3.2. Izin & cuti

#### Skema tabel `izin`

Tabel ini belum ada dan perlu migration baru:

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | bigint | primary key |
| `pengguna_id` | bigint | FK ke `pengguna` |
| `jenis` | varchar(10) | `cuti`, `izin`, atau `sakit` |
| `mulai` | date | tanggal awal |
| `selesai` | date | tidak boleh sebelum `mulai` |
| `alasan` | varchar(255) | minimal 4 karakter |
| `status` | varchar(20) | `menunggu`, `disetujui`, `ditolak` |
| `catatan_admin` | varchar(255) | boleh null |
| `diputuskan_oleh` | bigint | FK ke `pengguna`, boleh null |
| `diputuskan_at` | timestamp | boleh null |
| `created_at`, `updated_at` | timestamp | |

Indeks yang disarankan: `(pengguna_id, status)`, `(status, mulai)`.

Jangan menyimpan salinan nama/NIP untuk ditampilkan. Nama dan divisi diambil
dari tabel `pengguna` saat response dibuat, supaya perbaikan ejaan langsung
terlihat.

#### Aturan kuota

- Hanya `cuti` yang memotong jatah. `izin` dan `sakit` tidak.
- Jatah dihitung dalam **hari kerja**, bukan hari kalender.
- Sabtu, Minggu, dan tanggal di `/admin/hari-libur` tidak dihitung.
- Pengajuan `menunggu` ikut dihitung sebagai pemakaian.
- Bentuk kuota selalu:
  `{ jatah, terpakai, menunggu, sisa }`, dengan
  `sisa = jatah - terpakai - menunggu`.

#### `GET /saya/izin`

- Kirim seluruh pengajuan milik pengguna yang sedang masuk.
- Urutkan terbaru di atas.
- Sertakan `kuota`.
- `catatan_admin` wajib ikut, termasuk saat ditolak.

#### `POST /saya/izin`

Periksa di server:

- `jenis` hanya `cuti`, `izin`, atau `sakit`.
- `mulai` dan `selesai` berformat `YYYY-MM-DD`.
- `selesai >= mulai`.
- `selesai >= hari ini`; pengajuan yang seluruhnya sudah lewat ditolak.
- `alasan` minimal 4 karakter.
- Rentang harus memuat minimal satu hari kerja.
- Tidak boleh ada absen pada hari kerja di rentang itu (`409`).
- Tidak boleh tumpang tindih dengan pengajuan lain, **termasuk yang masih
  `menunggu`** (`409`).
- Kalau `jenis = cuti`, jatah harus cukup. Pesan harus menyebut sisa dan jumlah
  hari yang diajukan.

Balas `201` dengan baris baru dan `hari_kerja`.

#### `GET /admin/izin?status=...`

- `status`: `menunggu`, `disetujui`, `ditolak`, atau `semua`.
- Tanpa parameter, anggap `menunggu`.
- Kirim `jumlah` untuk **seluruh status**, bukan hanya yang tersaring.
- Urutkan `diajukan` menurun.
- Nama dan divisi diambil dari tabel pengguna lewat join.
- `hari_kerja` dihitung server.

#### Setujui / tolak

- `404` kalau id tidak ada.
- `409` kalau pengajuan sudah diputuskan.
- `422` kalau tolak tanpa `catatan` minimal 4 karakter.
- Saat menyetujui, periksa ulang:
  - `terpakai + semua_menunggu <= jatah`,
  - tidak ada pengajuan lain yang sudah disetujui dan tumpang tindih,
  - rentang masih memuat hari kerja.
- Isi `diputuskan_at`, `diputuskan_oleh`, dan `catatan_admin`.
- Catat keputusan ke `audit`.

#### Sambungkan izin ke laporan

Setelah tabel `izin` ada, ubah **`App\Support\Harian::susun()`** — bukan
controller laporan:

- Baca pengajuan `disetujui` yang mencakup tanggal di bulan itu.
- Isi `status` menjadi `izin`, `cuti`, atau `sakit` hanya kalau hari itu tidak
  punya absen masuk.
- Isi `keterangan_izin` dan `alasan_izin`.
- Jangan mengubah prioritas: `libur > absen > izin/cuti/sakit > belum > alpha`.
- `GET /admin/laporan` tetap mengirim `izin`, `cuti`, dan `sakit` terpisah.
- Kuota cuti hanya dihitung dari hari yang benar-benar berstatus `cuti`, bukan
  dari semua pengajuan yang disetujui.
- Tambahkan tes laporan untuk hari izin dan pastikan tes lama tetap lulus.

### 3.3. Tulis shift

`POST /admin/shift`, `PUT /admin/shift/{id}`, `DELETE /admin/shift/{id}`.

Validasi:

- `nama` wajib dan unik.
- `masuk` dan `pulang` berformat `HH:MM` 24 jam.
- **Jangan menolak `pulang` yang lebih kecil dari `masuk`.** Shift malam
  22.00–06.00 tetap sah.
- `toleransi_menit` antara 0 dan 120.
- `aktif` boleh datang sebagai teks `"true"` / `"false"`.

`DELETE` hanya boleh kalau:

- bukan shift terakhir,
- tidak ada magang yang memakai `shift_id` itu,
- tidak ada baris absen yang memakai `shift_id` itu.

Kalau salah satu terpenuhi, balas `409` dengan pesan yang menyebut jumlah
pemakainya. Untuk shift lama yang sudah dipakai, gunakan `PUT { "aktif": false }`.

### 3.4. CRUD hari libur

`GET`, `POST`, `PUT`, `DELETE /admin/hari-libur`.

- `GET` diurutkan naik menurut tanggal.
- `tanggal` wajib `YYYY-MM-DD` dan unik.
- `keterangan` wajib.
- Sabtu dan Minggu tidak perlu didaftarkan; keduanya libur dengan sendirinya.
- Menambah atau menghapus hari libur langsung mengubah dashboard dan laporan:
  tanggal itu tidak lagi dihitung sebagai hari kerja.

### 3.5. Hardening dan audit

Sudah ada:

- Signed URL foto berumur 10 menit.
- Cache Nominatim dan lock agar tidak membanjiri layanan.
- Penanda `lokasi_meragukan` untuk akurasi GPS di atas 50 m.
- Batas akurasi GPS 150 m untuk absen dinas luar.
- Rate limit login dan kiosk.
- Audit log untuk perubahan penting.

Sisa yang perlu dipertimbangkan:

- **Audit viewer admin.** Belum ada endpoint di `KONTRAK-API.md`. Kalau jadi
  dikerjakan, tambahkan dulu kontraknya, baru kode.
- **Allowlist IP kantor** sebagai lapisan tambahan, bukan pengganti `kiosk_id`.
- **Monitoring**: log error, ukuran database, masa berlaku token, dan kapasitas
  foto.
- **Deteksi anomali** yang lebih luas: PIN salah berulang, perpindahan mustahil,
  dan absen luar dengan akurasi kasar.
- **Backup** database dan folder foto privat.

---

## 4. Definisi selesai Fase 2

Fase 2 boleh disebut selesai kalau semua ini lulus:

- [ ] `GET /saya/absen` mengirim seluruh hari dalam bulan, status benar, dan
      `telat_menit` dibaca dari baris absen.
- [ ] `GET /saya/absen` memakai `App\Support\Harian` yang sama dengan
      `GET /admin/laporan/harian`.
- [ ] `GET /saya/izin` mengirim riwayat pengajuan dan kuota yang bisa dijumlahkan.
- [ ] `POST /saya/izin` menolak tanggal lewat, rentang tanpa hari kerja,
      tumpang tindih, absen yang sudah ada, dan cuti yang melebihi jatah.
- [ ] `GET /admin/izin` mengirim jumlah seluruh status, bukan hanya yang tersaring.
- [ ] Setujui/tolak menolak pengajuan yang sudah diputuskan dan mencatat audit.
- [ ] Izin/cuti/sakit dari tabel `izin` muncul di riwayat dan laporan.
- [ ] `POST/PUT/DELETE /admin/shift` berjalan, termasuk tiga penolakan hapus.
- [ ] CRUD hari libur langsung memengaruhi dashboard dan laporan.
- [ ] Tes laporan yang sudah ada tetap lulus setelah izin disambungkan.
- [ ] Tidak ada PIN/token mentah di database, log, atau response.
- [ ] `php artisan test` lulus seluruh tes Fase 1 + Fase 2.
- [ ] Dokumentasi endpoint di `backend/README.md` diperbarui.

---

## 5. Yang sengaja belum dikerjakan

Daftar ini penting supaya tidak ada yang mengira fitur berikut "terlupa":

- Ganti PIN sendiri oleh magang.
- Lupa PIN lewat email/WhatsApp.
- Edit atau hapus absen manual dari layar admin.
- Absen lewat HP pribadi tanpa perangkat kiosk terdaftar.
- Absen multi-cabang dalam satu perangkat.
- Notifikasi, pengingat, atau integrasi kalender.
- Aplikasi Android/iOS native.
- Realtime dashboard (websocket).
- Microservices, queue worker terpisah, atau object storage eksternal.
- Fitur di luar `KONTRAK-API.md`.

Kalau salah satu ingin dikerjakan, buat keputusan produk dulu, lalu perbarui
kontrak. Jangan menambah endpoint diam-diam.

---

## 6. Mulai dari mana

1. Kerjakan route dan controller `GET /saya/absen` memakai
   `App\Support\Harian::susun()`.
2. Tambahkan tes riwayat, termasuk hari libur, telat, dinas luar, dan `alpha`.
3. Buat migration dan model `izin`.
4. Kerjakan `GET/POST /saya/izin`.
5. Kerjakan `GET /admin/izin` dan setujui/tolak.
6. Sambungkan izin ke `App\Support\Harian`, lalu jalankan tes riwayat + laporan.
7. Kerjakan tulis shift.
8. Kerjakan CRUD hari libur.
9. Tambahkan tes untuk setiap bagian.
10. Jalankan seluruh tes, lalu perbarui dokumentasi.

Kalau ada yang tidak cocok antara dokumen ini dan `KONTRAK-API.md`, **kontrak
yang menang**. Kalau kontraknya sendiri terasa kurang, ubah kontrak dulu,
jelaskan alasannya, baru ubah kode — jangan diam-diam membuat bentuk response
sendiri.
