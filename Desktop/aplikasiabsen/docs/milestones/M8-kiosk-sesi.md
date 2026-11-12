# M8 — Kiosk: sesi & layar penuh

| | |
|---|---|
| Status | **Selesai (frontend)** |
| Lingkup | Frontend |
| Diperbarui | 12 November 2026 |
| Berkas utama | `src/main.js`, `src/kerangka.js`, `src/views/absen.js` |

## Tujuan

Menutup jalan kembali dari layar kiosk ke dashboard admin pada perangkat yang
sama, dan membuat kiosk terasa seperti perangkat tersendiri. Menu Kiosk Absen
membuka tab baru, mengakhiri sesi lebih dulu, dan mengembalikan tab dashboard
ke halaman masuk. Tab kiosk meminta layar penuh otomatis, dengan tombol
cadangan di header.

Batas milestone: tidak mengubah alur absen, bentuk kontrak API, atau cara
perangkat kiosk didaftarkan. Kunci fisik perangkat (mode kiosk browser/OS)
tetap di luar kode.

## Pekerjaan yang selesai

- [x] Menu Kiosk Absen membuka `#/absen` di tab baru. Sesi diakhiri sebelum tab
      lahir supaya tab kiosk tidak mewarisi token — `src/kerangka.js`.
- [x] Tab dashboard diarahkan ke `#/masuk`; kalau popup diblokir, kiosk dibuka
      di tab yang sama dengan sesi yang sudah bersih — `src/kerangka.js`.
- [x] Router tetap mengakhiri sesi sebelum memasang `#/absen` sebagai jaring
      pengaman untuk alamat yang dibuka langsung — `src/main.js`.
- [x] Tautan Kembali di layar kiosk dihapus — `src/views/absen.js`.
- [x] Import `pengguna` yang tidak terpakai dibersihkan dari `absen.js`.
- [x] Kiosk meminta layar penuh saat dipasang, menyediakan tombol cadangan di
      header, dan keluar dari layar penuh saat layar ditinggalkan —
      `src/views/absen.js`.
- [x] Dokumentasi M2, README, dan `KONTRAK-API.md` diperbarui.

## Verifikasi

```bash
npm test
npm run build
```

- Login admin → klik menu Kiosk Absen → tab baru membuka `#/absen`, tab lama
  pindah ke `#/masuk`, dan `localStorage.getItem('absen-sesi')` harus `null`.
- Tombol Back browser di tab lama → tetap di `#/masuk`, bukan dashboard.
- Ketik `#/beranda` di address bar → harus dialihkan ke `#/masuk`.
- Buka `#/absen` tanpa sesi → kiosk tetap tampil dan alur absen berjalan.
- Tombol layar penuh tampil di header; permintaan otomatis dan klik tombol
  belum bisa diverifikasi di Chromium headless (Fullscreen API ditolak).
- Hasil: lulus di Chromium (mode tiruan) — klik menu membuka tab baru `#/absen`
  tanpa sesi, tab lama berakhir di `#/masuk`, tidak ada tautan Kembali, Back
  dan `#/beranda` berakhir di `#/masuk`, dan kiosk tanpa sesi tetap
  menampilkan formulir absen. Layar penuh perlu diuji di browser biasa atau
  mode kiosk OS.

## Berikutnya

1. Uji bersama perangkat kiosk nyata pada butir M6 yang tersisa.
2. Putuskan apakah dashboard juga perlu kunci otomatis setelah diam; itu
   keputusan produk terpisah.
3. Tambahkan listener `storage` untuk tab dashboard lain yang tidak ikut
   membuka kiosk.
4. Pakai mode kiosk browser/OS bila layar penuh harus dijamin tanpa gestur.

## Kriteria penerimaan

- [x] Membuka kiosk dari dashboard tidak meninggalkan sesi admin di perangkat.
- [x] Menu Kiosk Absen membuka tab baru dan tab dashboard kembali ke login.
- [x] Tidak ada tautan atau tombol di layar kiosk yang menuju dashboard.
- [x] Back dan `#/beranda` setelah kiosk berakhir di halaman masuk.
- [x] Kiosk mencoba layar penuh otomatis dan tetap punya tombol cadangan.
- [x] Kiosk tetap bisa dibuka tanpa sesi dan alur absen tidak berubah.

## Risiko dan catatan

- Admin harus masuk ulang setelah memakai kiosk. Ini disengaja: biaya ketik PIN
  sama dengan gerbang PIN, tetapi sesinya benar-benar dicabut.
- Popup blocker bisa menolak tab baru. Kiosk lalu dibuka di tab yang sama;
  sesinya sudah dibersihkan sebelum itu.
- Layar penuh otomatis tidak dijamin: peramban mensyaratkan gestur pengguna,
  dan tab baru tidak mewarisi gestur itu. Tombol di header adalah jalan
  cadangannya; mode kiosk browser/OS tetap cara paling kuat.
- Kalau `POST /keluar` gagal karena jaringan, salinan lokal tetap dihapus;
  token di server tetap sah sampai kedaluwarsa (maksimal 12 jam).
- Tab dashboard lain yang sudah memuat data masih menampilkannya sampai
  request berikutnya, walaupun tokennya sudah dicabut.
- Mode tiruan DEV membaca token setelah `await`, jadi sesi tiruan di memori
  tidak dicabut. Hanya berpengaruh di development.

## Referensi

- `KONTRAK-API.md` — bagian Autentikasi dan `POST /keluar`.
- [M2 — Kiosk absen](M2-kiosk-absen.md) — alur kiosk.
- `src/main.js`, `src/kerangka.js`, `src/views/absen.js`, `src/api.js`
