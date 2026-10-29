# M4 — Izin, Riwayat, Rekap & Laporan

| | |
|---|---|
| Status | **Selesai (frontend)** |
| Lingkup | Frontend; backend menyusul |
| Diperbarui | 28 Oktober 2026 |
| Berkas utama | `src/views/riwayat.js`, `src/views/izin.js`, `src/views/izin-masuk.js`, `src/views/laporan.js` |

## Tujuan

Melengkapi alur di luar absen harian: magang dapat melihat riwayat sendiri dan
mengajukan izin/cuti; admin dapat memutuskan pengajuan dan membuat rekap bulanan
yang bisa diunduh.

Batas milestone: seluruh layar selesai. `GET /saya/absen`, seluruh endpoint izin,
dan integrasi izin ke laporan belum ada di backend; itu pekerjaan
[M5](M5-integrasi-backend.md).

## Pekerjaan yang selesai

### Riwayat absen (magang)

- [x] Satu bulan penuh, satu baris per hari, termasuk Sabtu, Minggu, dan hari
      libur.
- [x] Urutan tanggal menaik dan lencana status yang konsisten.
- [x] Ringkasan hadir, terlambat, izin/cuti, dan tanpa catatan.
- [x] Navigasi bulan; tidak bisa mundur sebelum `masuk_kerja` atau maju melewati
      bulan berjalan.
- [x] Data diambil dari `GET /saya/absen?bulan=YYYY-MM`.

### Izin & cuti (magang)

- [x] Kartu jatah cuti dengan `jatah`, `terpakai`, `menunggu`, dan `sisa`.
- [x] Bar pemakaian dan daftar pengajuan sendiri, terbaru di atas.
- [x] Formulir pengajuan `cuti`, `izin`, atau `sakit` dengan rentang tanggal dan
      alasan.
- [x] Hanya `cuti` yang memotong jatah; `izin` dan `sakit` tidak.
- [x] Pesan galat dari server ditampilkan, termasuk sisa jatah dan bentrok.
- [x] Catatan admin ikut tampil, termasuk saat pengajuan ditolak.

### Persetujuan izin (admin)

- [x] Tab Menunggu, Disetujui, Ditolak, dan Semua.
- [x] Jumlah per status berasal dari server, bukan dihitung dari daftar yang
      sedang tersaring.
- [x] Nama, NIP, divisi, jenis, tanggal, hari kerja, alasan, dan status tampil
      dalam satu tabel.
- [x] Setujui dengan konfirmasi; tolak wajib memakai catatan.
- [x] Setelah keputusan, daftar dan jumlah dimuat ulang.
- [x] Pesan penolakan server ditampilkan apa adanya.

### Rekap & laporan (admin)

- [x] Pemilih bulan maksimal 24 bulan ke belakang.
- [x] Ringkasan kehadiran, keterlambatan, izin/cuti, dan tanpa catatan.
- [x] Tabel per magang: hadir, terlambat, menit terlambat, izin/cuti/sakit,
      alpha, dinas luar, dan luar akurasi kasar.
- [x] Baris nonaktif yang dikirim server ditandai "(nonaktif)" dan tidak
      disembunyikan.
- [x] Rincian harian satu magang memakai bentuk data yang sama dengan riwayat.
- [x] Rincian lokasi, akurasi, jarak, tautan peta, dan foto.
- [x] Ekspor CSV di browser: pemisah titik koma, BOM UTF-8, dan sel yang diawali
      `=`, `+`, `-`, atau `@` diamankan agar tidak dieksekusi sebagai rumus.
- [x] Nama berkas `rekap-absen-YYYY-MM.csv`.

## Verifikasi

- Rute: `#/riwayat`, `#/izin`, `#/izin-masuk`, `#/laporan`.
- Mode tiruan menyediakan data dan aturan izin, sehingga alur bisa dicoba tanpa
  backend.
- Backend yang sudah tersedia: `GET /admin/laporan` dan
  `GET /admin/laporan/harian`; tes ada di
  `backend/tests/Feature/AdminLaporanTest.php`.
- `npm run build` lulus saat pembaruan dokumentasi ini.

## Berikutnya

1. Implementasikan `GET /saya/absen` memakai `App\Support\Harian::susun()`.
2. Implementasikan tabel `izin`, `GET/POST /saya/izin`, lalu endpoint admin.
3. Sambungkan izin yang disetujui ke `App\Support\Harian` dan jalankan ulang
   tes laporan.
4. Setelah backend siap, uji ulang layar dengan `VITE_USE_MOCK=false`,
   terutama status prioritas, kuota, dan CSV dari data asli.

## Kriteria penerimaan

- [x] Riwayat menampilkan seluruh hari dalam bulan dan ringkasan yang bisa
      dijumlahkan.
- [x] Magang dapat mengajukan izin/cuti dan melihat sisa jatah serta catatan
      admin.
- [x] Admin dapat menyetujui/menolak dengan alasan penolakan wajib.
- [x] Rekap bulanan dan rincian harian tampil dalam satu layar tanpa kehilangan
      bulan yang sedang dibuka.
- [x] CSV dapat diunduh dan aman dibuka di Excel.
- [x] Lokasi dan foto ditampilkan sebagai perkiraan, bukan tuduhan otomatis.
- [ ] Seluruh endpoint riwayat dan izin tersedia di backend (pekerjaan M5).

## Risiko dan catatan

- Sampai backend izin selesai, kolom `izin`, `cuti`, dan `sakit` di laporan
  backend bernilai `0`. Ini bukan bug tampilan; datanya memang belum ada.
- Perhitungan alpha dan hari kerja adalah tanggung jawab server. Frontend hanya
  menampilkan `ringkasan` dan `hari_kerja` yang dikirim.
- CSV dibuat di browser. Kalau nanti ada ekspor PDF, itu kebutuhan baru dan
  harus masuk kontrak lebih dulu.
- Mode tiruan meniru aturan bisnis, tetapi tetap bisa berbeda dari backend asli.
  Pengujian dengan data nyata wajib sebelum rilis.

## Referensi

- `KONTRAK-API.md` — bagian izin & cuti, riwayat absen, rekap & laporan, ekspor
  CSV.
- `PANDUAN-BACKEND-V2.md` — urutan pekerjaan riwayat dan izin.
- `src/views/riwayat.js`, `src/views/izin.js`, `src/views/izin-masuk.js`,
  `src/views/laporan.js`
- `src/mock.js` — aturan tiruan izin, riwayat, dan laporan.
- `backend/app/Support/Harian.php`,
  `backend/app/Http/Controllers/AdminLaporanController.php`,
  `backend/tests/Feature/AdminLaporanTest.php`
