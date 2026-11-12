# M8 — Sesi kiosk

| | |
|---|---|
| Status | **Selesai (frontend)** |
| Lingkup | Frontend |
| Diperbarui | 12 November 2026 |
| Berkas utama | `src/main.js`, `src/views/absen.js` |

## Tujuan

Menutup jalan kembali dari layar kiosk ke dashboard admin pada perangkat yang
sama. Sebelumnya kiosk dibuka dari sidebar dengan sesi admin yang masih hidup,
sehingga tautan Kembali, tombol Back browser, atau alamat `#/beranda` bisa
mendarat di dashboard. Sekarang router mengakhiri sesi sebelum layar kiosk
dipasang, jadi perangkat yang ditinggal tidak menyimpan token admin.

Batas milestone: tidak mengubah alur absen, bentuk kontrak API, atau cara
perangkat kiosk didaftarkan. Kunci fisik perangkat (mode kiosk browser/OS)
tetap di luar kode.

## Pekerjaan yang selesai

- [x] Router memanggil `POST /keluar` lalu menghapus sesi lokal sebelum
      memasang `#/absen` bila ada sesi aktif — `src/main.js`.
- [x] Tautan Kembali di layar kiosk dihapus — `src/views/absen.js`.
- [x] Import `pengguna` yang tidak terpakai dibersihkan dari `absen.js`.
- [x] Dokumentasi M2, README, dan `KONTRAK-API.md` diperbarui.

## Verifikasi

```bash
npm test
npm run build
```

- Login admin → buka `#/absen` → `localStorage.getItem('absen-sesi')` harus
  `null`.
- Tombol Back browser → harus mendarat di `#/masuk`, bukan dashboard.
- Ketik `#/beranda` di address bar → harus dialihkan ke `#/masuk`.
- Buka `#/absen` tanpa sesi → kiosk tetap tampil dan alur absen berjalan.
- Hasil: lulus di Chromium (mode tiruan) — sesi kosong setelah kiosk dibuka,
  tidak ada tautan Kembali, Back dan `#/beranda` berakhir di `#/masuk`, dan
  kiosk tanpa sesi tetap menampilkan formulir absen.

## Berikutnya

1. Uji bersama perangkat kiosk nyata pada butir M6 yang tersisa.
2. Putuskan apakah dashboard juga perlu kunci otomatis setelah diam; itu
   keputusan produk terpisah.
3. Tambahkan listener `storage` lintas tab bila dashboard dibiarkan terbuka di
   tab lain saat kiosk dipakai.

## Kriteria penerimaan

- [x] Membuka kiosk dari dashboard tidak meninggalkan sesi admin di perangkat.
- [x] Tidak ada tautan atau tombol di layar kiosk yang menuju dashboard.
- [x] Back dan `#/beranda` setelah kiosk berakhir di halaman masuk.
- [x] Kiosk tetap bisa dibuka tanpa sesi dan alur absen tidak berubah.

## Risiko dan catatan

- Admin harus masuk ulang setelah memakai kiosk. Ini disengaja: biaya ketik PIN
  sama dengan gerbang PIN, tetapi sesinya benar-benar dicabut.
- Kalau `POST /keluar` gagal karena jaringan, salinan lokal tetap dihapus;
  token di server baru tidak berlaku saat kedaluwarsa (maksimal 12 jam).
- Tab lain yang sudah memuat dashboard masih menampilkan data lama sampai
  request berikutnya, walaupun tokennya sudah dicabut.
- Mode tiruan DEV membaca token setelah `await`, jadi sesi tiruan di memori
  tidak dicabut. Hanya berpengaruh di development.

## Referensi

- `KONTRAK-API.md` — bagian Autentikasi dan `POST /keluar`.
- [M2 — Kiosk absen](M2-kiosk-absen.md) — alur kiosk.
- `src/main.js`, `src/views/absen.js`, `src/api.js`
