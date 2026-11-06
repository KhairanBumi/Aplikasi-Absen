# M3 — Dashboard & Data Master

| | |
|---|---|
| Status | **Selesai (frontend)** |
| Lingkup | Frontend; sebagian backend |
| Diperbarui | 28 Oktober 2026 |
| Berkas utama | `src/views/beranda.js`, `src/views/magang.js`, `src/views/lokasi.js`, `src/views/shift.js`, `src/views/hari-libur.js` |

## Tujuan

Memberi admin satu tempat untuk melihat kondisi kehadiran hari itu dan mengelola
data yang dipakai kiosk serta laporan: anak magang, lokasi kantor, shift kerja,
dan hari libur.

Batas milestone: layar dan alurnya selesai. Penulisan shift dan seluruh CRUD
hari libur belum tersedia di backend; itu pekerjaan [M5](M5-integrasi-backend.md).

## Pekerjaan yang selesai

### Beranda

- [x] Ringkasan harian: total, sudah masuk, belum masuk, izin, dan terlambat.
- [x] Navigasi tanggal mundur/maju sampai hari ini, dengan label "Hari ini",
      "Kemarin", dan seterusnya.
- [x] Penanda hari libur dan keterangannya.
- [x] Daftar yang terlambat beserta menit keterlambatan.
- [x] Daftar yang belum masuk dan aktivitas terbaru (enam catatan terakhir).
- [x] Rincian lokasi, akurasi, jarak, tautan peta, dan foto lewat URL bertanda
      tangan.
- [x] Tombol muat ulang dan penanda mode tiruan saat development.

### Akun (menu Anak Magang)

- [x] Daftar semua akun beserta status aktif/nonaktif.
- [x] Pencarian di browser berdasarkan nama, NIP, NIK, atau divisi.
- [x] Tambah dan ubah data, termasuk lokasi, shift, tanggal masuk kerja, jatah
      cuti, dan peran (magang/admin).
- [x] Aktifkan/nonaktifkan akun tanpa menghapus riwayat.
- [x] PIN hanya bisa diisi baru; PIN lama tidak pernah ditampilkan.
- [x] Pilihan divisi dibangun dari daftar yang dikirim server.
- [x] Admin tidak bisa menonaktifkan akunnya sendiri.

### Lokasi kantor

- [x] Daftar lokasi, tambah, dan ubah.
- [x] Aktif/nonaktif; lokasi nonaktif tidak bisa dipakai di kiosk.
- [x] Tidak ada hapus, karena baris absen merujuk lokasi.

### Shift kerja

- [x] Daftar shift, tambah, ubah, dan hapus.
- [x] Aktif/nonaktif, jam masuk/pulang, dan toleransi keterlambatan.
- [x] Shift malam (pulang lebih kecil dari masuk) tidak ditolak oleh formulir.
- [x] Konfirmasi hapus dan pesan penolakan dari server.
- [x] Penjelasan bahwa mengubah toleransi hanya berlaku untuk absen berikutnya.

### Hari libur

- [x] Daftar hari libur, pencarian, tambah, ubah, dan hapus.
- [x] Formulir tanggal dan keterangan wajib; pesan penolakan server ditampilkan.
- [x] Sabtu dan Minggu libur dengan sendirinya; tidak perlu didaftarkan.

### Pola bersama

- [x] Empat layar memakai pola yang sama: kartu daftar, pencarian di browser,
      dialog formulir, dan konfirmasi terpisah untuk tindakan berbahaya.
- [x] Seluruh rute hanya untuk admin; magang dialihkan ke halaman pertamanya.

## Verifikasi

- Rute: `#/beranda`, `#/magang`, `#/lokasi`, `#/shift`, `#/hari-libur`.
- Mode tiruan di `src/mock.js` menyediakan seluruh operasi tulis, jadi alur
  frontend bisa dicoba tanpa backend.
- Backend yang sudah tersedia: `GET /admin/dashboard`,
  `GET/POST/PUT /admin/magang`, `GET/POST/PUT /admin/lokasi`, dan
  `GET /admin/shift`.
- `npm run build` lulus saat pembaruan dokumentasi ini.

## Berikutnya

1. Selesaikan `POST/PUT/DELETE /admin/shift` di backend
   ([M5](M5-integrasi-backend.md)).
2. Selesaikan `GET/POST/PUT/DELETE /admin/hari-libur` di backend.
3. Setelah endpoint asli ada, ulangi pengujian layar dengan
   `VITE_USE_MOCK=false`.
4. Kalau jumlah magang menjadi ratusan, tambahkan pencarian/pagination server;
   saat ini penyaringan sengaja di browser.

## Kriteria penerimaan

- [x] Beranda menampilkan ringkasan, keterlambatan, yang belum masuk, dan
      aktivitas terbaru untuk tanggal yang dipilih.
- [x] Data akun dapat dicari, ditambah, diubah, dan dinonaktifkan tanpa
      kehilangan riwayat.
- [x] PIN tidak pernah tampil di layar atau response data master.
- [x] Lokasi dapat ditambah/diubah dan dinonaktifkan, tanpa hapus.
- [x] Shift dapat dikelola, termasuk penolakan hapus yang berasal dari server.
- [x] Hari libur dapat dikelola; keunikan tanggal menjadi tanggung jawab server.
- [x] Seluruh layar hanya bisa dibuka admin.
- [ ] Operasi tulis shift dan hari libur berjalan di backend asli
      (pekerjaan M5, bukan kekurangan layar).

## Risiko dan catatan

- Tanpa backend tulis shift/hari libur, layar ini hanya berfungsi di mode
  tiruan. Jangan menandai integrasi selesai sebelum endpoint asli diuji.
- Pencarian di browser cukup untuk puluhan data. Jangan menambah pagination
  setengah jadi; kalau perlu, kerjakan di backend sekaligus.
- Toleransi shift tidak boleh mengubah `telat_menit` yang sudah tersimpan.
  Perilaku ini sudah menjadi aturan di laporan.
- Menghapus shift harus ditolak server kalau masih dipakai atau merupakan shift
  terakhir; UI hanya menampilkan pesan penolakan.

## Referensi

- `KONTRAK-API.md` — bagian data master dan dashboard.
- `PANDUAN-BACKEND-V2.md` — sisa tulis shift dan CRUD hari libur.
- `src/views/beranda.js`, `src/views/magang.js`, `src/views/lokasi.js`,
  `src/views/shift.js`, `src/views/hari-libur.js`
- `src/mock.js` — perilaku tiruan data master.
- `backend/routes/api.php`, `backend/app/Http/Controllers/AdminDataController.php`,
  `backend/app/Http/Controllers/AdminMagangController.php`
