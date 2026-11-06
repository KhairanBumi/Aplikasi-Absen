# M1 — Fondasi Frontend & Autentikasi

| | |
|---|---|
| Status | **Selesai** |
| Lingkup | Frontend |
| Diperbarui | 28 Oktober 2026 |
| Berkas utama | `src/main.js`, `src/menu.js`, `src/api.js`, `src/kerangka.js`, `src/ui.js`, `src/tabel.js`, `src/style.css` |

## Tujuan

Menyiapkan kerangka aplikasi yang dipakai seluruh layar: satu router, satu
daftar menu, satu lapisan API, satu sistem tampilan, dan satu cara menangani
sesi. Setelah milestone ini, menambah layar berarti menambah view dan satu baris
menu, bukan menyalin kerangka baru.

Batas milestone: belum ada fitur absen, data master, izin, atau laporan. Yang
dibangun hanya fondasi dan pintu masuk.

## Pekerjaan yang selesai

- [x] Proyek Vite 8 + Tailwind 4 dengan struktur `src/views/`, `src/style.css`,
      dan `vite.config.js`.
- [x] Router hash di `src/main.js`: pemuatan view secara lazy, rute tidak dikenal
      dialihkan, dan view lama dibersihkan sebelum view baru dipasang.
- [x] Hak akses diturunkan dari `src/menu.js`: menu admin/magang, rute publik
      kiosk, dan pengalihan ke halaman pertama sesuai peran.
- [x] Halaman masuk NIP + PIN di `src/views/masuk.js`, tanpa email dan tanpa kata
      sandi.
- [x] Sesi disimpan di `localStorage` dan disegarkan lewat `GET /saya/profil`
      setiap aplikasi dibuka. `401`, `403` akun nonaktif, dan `sesi_habis`
      menghapus sesi; kegagalan jaringan tidak.
- [x] Tombol Keluar di `src/kerangka.js`: memanggil `POST /keluar`, lalu
      membersihkan sesi lokal.
- [x] Lapisan API tunggal di `src/api.js`: `get/post/put/del`, token bearer,
      pemetaan pesan galat, dan penanganan `401` yang tidak mengeluarkan petugas
      dari kiosk saat PIN salah.
- [x] Mode tiruan hanya aktif di development (`MODE_TIRUAN`), dengan seed di
      `src/data-tiruan.js` dan perilaku endpoint di `src/mock.js`.
- [x] Kerangka admin: sidebar, bilah atas, menu responsif, dan tombol keluar.
- [x] Komponen bersama: dialog formulir, konfirmasi, toast, tabel, kartu angka,
      lencana status, format tanggal/jam, dan pesan galat.
- [x] Gaya dasar: fokus keyboard terlihat, animasi mengikuti
      `prefers-reduced-motion`, latar dan kaca konsisten.
- [x] Header keamanan di `public/_headers` (CSP, frame, referrer, permissions).
- [x] Pemeriksaan build `scripts/periksa-build.mjs`: menolak akun demo atau kunci
      mock yang tersisa di `dist`.
- [x] Proxy development `/api` ke `http://127.0.0.1:8000` di `vite.config.js`.

## Verifikasi

- `npm run build` menjalankan Vite dan pemeriksaan build; lulus saat pembaruan
  dokumentasi ini.
- Rute `#/masuk` dapat dibuka tanpa sesi; rute admin/magang mengikuti daftar di
  `src/menu.js`.
- Sesi diuji lewat alur kode: `segarkanSesi()` mempertahankan sesi saat jaringan
  gagal, tetapi menghapusnya saat token ditolak.
- `dist` tidak boleh memuat `MODE_TIRUAN` aktif, akun demo, atau kunci mock.

## Berikutnya

1. Tidak ada pekerjaan fondasi yang tersisa.
2. Integrasi endpoint asli dilanjutkan di [M5](M5-integrasi-backend.md).
3. Tes otomatis dan CI ditambahkan di [M6](M6-hardening-rilis.md).

## Kriteria penerimaan

- [x] Seluruh rute yang terdaftar di menu punya view atau layar "sedang
      disiapkan".
- [x] Menu dan rute mengikuti peran; kiosk dapat dibuka tanpa sesi.
- [x] Masuk, keluar, dan penyegaran sesi berjalan lewat satu lapisan API.
- [x] Tidak ada `fetch` langsung di view.
- [x] Mode tiruan tidak mungkin aktif di build produksi.
- [x] Header keamanan tersedia untuk hosting statis.
- [x] Build produksi lulus.

## Risiko dan catatan

- Token disimpan di `localStorage`. Ini keputusan sadar untuk SPA tanpa backend
  cookie; risikonya dikurangi dengan masa berlaku 12 jam, pencabutan saat keluar,
  dan CSP. Kalau suatu saat ada XSS, token bisa terbaca.
- Belum ada tes frontend otomatis. Build check hanya menjaga artifact, bukan
  perilaku layar.
- Router memakai hash, jadi deep link tidak memerlukan konfigurasi rewrite di
  server. Jangan diganti ke history API tanpa menambah fallback server.

## Referensi

- `KONTRAK-API.md` — bagian autentikasi, format response, dan header keamanan.
- `src/main.js`, `src/menu.js`, `src/api.js`, `src/kerangka.js`
- `src/ui.js`, `src/tabel.js`, `src/style.css`
- `public/_headers`, `scripts/periksa-build.mjs`, `vite.config.js`
