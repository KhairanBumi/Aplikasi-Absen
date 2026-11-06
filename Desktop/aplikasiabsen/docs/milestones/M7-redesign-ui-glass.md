# M7 — Redesign UI: gradasi Feral & hybrid glass

| | |
|---|---|
| Status | **Selesai (frontend)** |
| Lingkup | Frontend |
| Diperbarui | 29 Oktober 2026 (revisi kedua: kartu isi jadi kaca penuh, header diselaraskan) |
| Berkas utama | `src/style.css`, `src/kerangka.js`, `src/tabel.js`, `src/ui.js`, `src/animasi.js`, `src/latar.js`, `src/views/beranda.js`, `src/views/masuk.js`, `src/views/absen.js`, `src/views/magang.js`, `src/views/laporan.js`, `src/views/izin.js`, `src/views/izin-masuk.js`, `src/views/anomali.js`, `src/views/audit.js`, `src/views/hari-libur.js`, `src/views/lokasi.js`, `src/views/riwayat.js`, `src/views/segera.js`, `src/views/shift.js` |

## Tujuan

Mengembalikan gradasi Feral sebagai latar yang benar-benar terlihat, lalu
membagi permukaan menjadi tangga material: satu bahan kaca yang sama untuk
chrome, kartu ringkasan, dan kartu isi section, dengan opasitas yang
bertingkat mengikuti seberapa padat isinya. Tujuannya agar aplikasi tidak
lagi terasa putih rata tanpa mengorbankan keterbacaan tabel, angka, dan teks
kecil.

Revisi kedua menjawab catatan pemilik: navigasi sudah memakai kaca, tetapi
isi section masih berupa fill putih, jadi dua material berbeda berhadapan di
satu layar. Kartu isi section kini memakai bahan kaca yang sama, dan tepi
bilah atas diselaraskan dengan tepi kartu agar keduanya terbaca sebagai satu
kolom.

Batas milestone: tidak mengubah backend, `gradient.json`, splash loader,
branding, copy faktual, alur bisnis, atau data. Tidak ada dependency baru.

## Pekerjaan yang selesai

- [x] Token material di `src/style.css`: `kaca` 0.62 + blur 24, `kaca-lembut`
      0.70 + blur 18, `kaca-kartu` 0.72 tanpa blur, `kaca-tebal` 0.92 +
      blur 36, plus fallback `@supports not (backdrop-filter)`.
- [x] Revisi kedua: `kaca-kartu` diubah dari frost fill putih ke panel kaca
      tembus cahaya 0.72, jadi gradasi Feral ikut mewarnai isi section
      seperti yang terjadi pada navigasi. Tanpa `backdrop-filter` — kartu ini
      membungkus tabel besar, dan wallpaper sudah diblur 64px di `latar.js`,
      sehingga yang perlu tembus hanya warnanya.
- [x] Revisi kedua: `kaca-lembut` diturunkan dari 0.80 ke 0.70 supaya kartu
      ringkasan ikut terasa seperti kaca dan bukan panel pekat.
- [x] Revisi kedua: `muted` diganti menjadi `ink/70` di seluruh aplikasi lewat
      override `--color-muted` pada permukaan kaca dan pada `area-kaca`
      (kerangka aplikasi). Nilai `muted` lama hanya menyisakan sekitar 3:1 di
      atas orb teal.
- [x] Revisi kedua: tepi bilah atas diselaraskan dengan tepi kartu. Bilah
      sekarang memakai pola yang sama dengan kolom isi — padding luar
      `px-3 sm:px-6` dan `max-w-6xl` di dalam — dan padding dalam
      `px-4 sm:px-6` mengikuti padding kartu.
- [x] Revisi kedua: warna aksen di teks kecil disapu ke shade yang lolos
      kontras di atas kaca — `emerald/amber/rose/sky` ke `-800`, `text-merek`
      ke `text-merek-gelap` — di 15 berkas.
- [x] Revisi kedua: permukaan di dalam kartu memakai cucian netral `bg-ink/4`
      (hover baris tabel, kartu harian di ponsel, status kosong) karena putih
      transparan di atas kartu yang sudah nyaris putih tidak terlihat.
- [x] Penyebab gradasi tidak terlihat diperbaiki: body dibuat transparan lewat
      aturan tak berlayer `html body`, karena `<style>` pemuat di `index.html`
      memberi body latar opak yang menutup kanvas ber-`z-index: -1`. Warna
      cadangan tetap ada di `html` dan `#pemuat-awal`.
- [x] Hero beranda memakai gradient indigo→teal `#5856d6 → #4644b8 → #006e7d`
      dengan orb pale yellow dan bamboo; orb fuchsia dihapus. Tanggal kecil di
      area teal memakai putih penuh.
- [x] Navigasi tanggal dan `kartuAngka` memakai `kaca-lembut`; daftar
      Terlambat/Belum absen/Aktivitas tetap `KARTU`.
- [x] Sidebar, header, menu seluler, login, kiosk, chip lokasi, dan dialog
      memakai material kaca yang disesuaikan; menu seluler dan dialog memakai
      `kaca-tebal`.
- [x] Dialog diberi jarak 1rem dari tepi viewport pada layar sempit.
- [x] Teks sekunder di atas kaca memakai `text-ink/70`; badge netral memakai
      `text-ink/70`; NIK `text-faint` diganti `text-muted`; nilai KPI memakai
      shade 800 yang lolos kontras.
- [x] `src/animasi.js` ikut menganimasikan `.kaca-lembut`; navigasi tanggal
      beranda memakai `[data-kartu]` agar animasi tidak null.
- [x] `src/latar.js` memakai `blur(64px) saturate(1.12)`; stop, orb, grain, dan
      `gradient.json` tidak diubah.
- [x] Tidak ada `will-change` permanen dan tidak ada animasi infinite baru.

## Verifikasi

Perintah:

```bash
npm test
npm run build
```

Hasil: **24 tes lulus** (4 berkas) dan build produksi lulus, termasuk
`scripts/periksa-build.mjs` yang menolak akun demo/kode mode tiruan.

Browser: Chromium nyata melalui Playwright MCP.

- `#/masuk` — dev server mode backend asli (`VITE_USE_MOCK=false`) dan
  production preview; tidak memakai sesi.
- `#/beranda`, `#/magang`, `#/laporan`, `#/audit`, `#/absen` — dev server mode
  tiruan (`VITE_USE_MOCK=true`, port terpisah) karena kredensial backend asli
  tidak tersedia. Data isi (lima magang, absen, izin) adalah data tiruan;
  rendering, CSS, dan browser-nya nyata.
- Dialog konfirmasi keluar dan menu seluler ikut dicoba pada 390 px.
- Viewport: 360×780, 390×844, 768×900, 1440×900, 1920×1000.
- Tidak ada overflow horizontal halaman (`document.documentElement.scrollWidth
  <= innerWidth`) di kelima viewport. Tabel Laporan di 768 px memakai wilayah
  gulir horizontal yang sudah ada (`role="region"`, `tabindex="0"`); halaman
  tetap tidak melebar.
- Console dan page error pada `#/beranda` mode tiruan: 0.
- Reduced motion: `matchMedia` true, `document.getAnimations()` = 0 animasi
  berjalan, tidak ada elemen reveal yang tertinggal transparan, splash sudah
  dilepas.
- Production preview (`vite preview` atas hasil `npm run build`): `body`
  tetap transparan, `kaca` terhitung `rgba(255,255,255,0.62)` +
  `blur(24px) saturate(1.8)`, dan override `--color-muted` ikut terbawa ke
  CSS hasil build.

### Keselarasan tepi bilah atas dan kartu isi

Diukur dari `getBoundingClientRect()` pada viewport 360, 390, 768, 1440, dan
1920 px. Nilai `x` adalah tepi kiri, `r` tepi kanan.

| Viewport | Bilah atas | Kolom isi | Kartu isi | Teks judul ↔ teks kartu |
|---|---|---|---|---|
| 360 | 12 → 338 | 12 → 338 | 12 → 338 | geser, tombol menu |
| 390 | 12 → 368 | 12 → 368 | 12 → 368 | geser, tombol menu |
| 768 | 24 → 734 | 24 → 734 | 24 → 734 | geser, tombol menu |
| 1440 | 296 → 1406 | 296 → 1406 | 296 → 1406 | 321 ↔ 321 |
| 1920 | 515 → 1667 | 515 → 1667 | 515 → 1667 | sama |

Tepi panelnya identik di semua lebar. Pada lebar di bawah 1024 px judul bilah
masih bergeser ke kanan karena tombol menu ada di sebelahnya — itu perilaku
tombol, bukan ketidaksejajaran panel.

Sebelum revisi ini, di 768 px tepi bilah meleset 8 px dari kartu (16 px vs
24 px), dan di 1920 px bilah melebar sampai tepi kolom sementara kartu
terpusat di `max-w-6xl`.

### Kontras terukur dari piksel tangkapan layar

Nilai di bawah dihitung dari warna latar aktual hasil render, bukan asumsi
putih. Cara ukurnya: seluruh glif teks dibuat transparan supaya tangkapan
layar hanya menampilkan permukaannya, lalu piksel di lokasi teks disampel
(median 7×7). Teks `ink/70` = `rgb(29 29 31 / 0.7)`.

Kasus terburuk per bahan, diambil dari piksel paling gelap di dalam panel:

| Bahan | Latar terburuk | `ink` | `ink/70` | `merek-gelap` | `emerald-800` | `amber-800` | `rose-800` | `sky-800` |
|---|---|---|---|---|---|---|---|---|
| `kaca` 0.62 (chrome) | `157,216,229` | 10.73 | 4.97 | 4.82 | 4.85 | 4.52 | 5.05 | 4.79 |
| `kaca-lembut` 0.70 | `182,233,234` | 12.69 | 5.42 | 5.70 | 5.74 | 5.34 | 5.97 | 5.66 |
| `kaca-kartu` 0.72 | `195,225,227` | 12.18 | 5.30 | 5.47 | 5.51 | 5.13 | 5.73 | 5.44 |

Contoh per elemen yang diukur langsung di layar:

| Elemen | Latar terukur | Rasio |
|---|---|---|
| Judul kartu 18px, `ink` | `216,239,226` | 13.92:1 |
| Jumlah baris 14px, `ink/70` | `218,240,228` | 5.70:1 |
| Kepala tabel 12px, `ink/70` | `223,242,232` | 5.77:1 |
| Nama sel 14px, `ink` | `229,244,237` | 14.82:1 |
| Sel sekunder 12px, `ink/70` | `249,252,251` | 6.11:1 |
| Inisial avatar 12px, `merek-gelap` | `211,225,233` / `233,236,247` | 5.65 / 6.41:1 |
| Lencana "Aktif" 12px, `emerald-800` | `169,224,218` | 5.21:1 |
| Tombol "Ubah" 14px, `merek-gelap` | `188,226,230` | 5.45:1 |
| Tombol "Nonaktifkan" 14px, `amber-800` | `195,228,231` | 5.26:1 |
| Tombol "Hapus" 14px, `rose-800` | `197,230,232` | 5.98:1 |
| KPI label 14px, `ink/70` | `240,251,243` | 6.04:1 |
| KPI angka 30px, `amber-800` / `sky-800` / `rose-800` | `242,250,241` / `216,242,234` / `194,236,231` | 6.66 / 6.37 / 6.20:1 |
| Navigasi tanggal 12px, `ink/70` | `199,238,238` | 5.59:1 |
| Hero sapaan 14px, `white/90` | `84,89,196` | 5.07:1 |
| Hero nama 30px, `white` | `81,88,190` | 6.02:1 |
| Hero jam 36px, `white` | `79,108,157` | 5.30:1 |
| Hero tanggal 12px, `white` | `66,115,146` | 5.12:1 |

Semua nilai di atas >= 4.5:1 (>= 3:1 untuk teks besar). Yang paling mepet
adalah `amber-800` di atas chrome 0.62 (4.52:1) — kalau opasitas `kaca`
diturunkan lagi, shade aksen harus turun ke -900.

## Berikutnya

1. Verifikasi layar admin dengan backend asli dan kredensial pemilik. Milestone
   ini hanya memverifikasi tampilan; data admin memakai mode tiruan.
2. Perbaiki bug mode tiruan di `src/mock.js`: `rekapBulan()` memanggil
   `namaLokasi()` yang hanya didefinisikan di dalam `riwayatBulan()`. Bug ini
   baru muncul saat ada baris magang dan tidak diubah pada milestone ini.
3. Putuskan apakah tabel Laporan di 768 px perlu memakai kartu (bukan wilayah
   gulir horizontal). Saat ini perilaku itu sudah ada sebelum M7.
4. Jika perangkat kiosk kelas bawah tersendat saat menggulir, turunkan blur
   `kaca-lembut` ke sekitar 14 px atau naikkan opasitasnya; jangan hapus efek
   kaca dan jangan menambah `will-change` permanen. Kartu isi section
   (`kaca-kartu`) tidak memakai blur sama sekali, jadi tidak ikut memengaruhi
   biaya gulir tabel.
5. Kalau nanti ada layar baru yang memakai bilah atas, pola kolomnya harus
   ikut: `px-3 sm:px-6` di luar, `max-w-6xl` di dalam, `px-4 sm:px-6` di
   dalam bilah. Setiap deviasi dari pola itu langsung terlihat sebagai tepi
   yang meleset.

## Kriteria penerimaan

- [x] Gradasi Feral terlihat di gutter, di balik kaca, dan pada layar tanpa
      kartu; layar tidak lagi terasa putih rata.
- [x] Kaca terasa di sidebar, header, login, kiosk, dialog, kartu ringkasan,
      dan kartu isi section — tidak ada lagi fill putih yang bertanding
      dengan navigasi di satu layar.
- [x] Tabel dan angka tetap tajam: kartu isi section tidak memakai
      `backdrop-filter`.
- [x] Teks kecil yang diukur lolos 4.5:1 pada latar aktual.
- [x] Tepi bilah atas, kolom isi, dan kartu isi sejajar di 360, 390, 768,
      1440, dan 1920 px; teks di dalam bilah segaris dengan teks di dalam
      kartu.
- [x] Tidak ada perubahan fungsi, data, copy, loader, atau branding.
- [x] `npm test` dan `npm run build` lulus.
- [x] Tidak ada commit/push pada milestone ini.
- [ ] Verifikasi layar admin dengan backend asli (di luar cakupan visual M7;
      lihat Berikutnya).

## Risiko dan catatan

- `html body { background-color: transparent }` **wajib tetap di luar
  `@layer`**. Aturan `body` di `<style>` pemuat tidak berlayer; kalau aturan ini
  dipindah ke layer, kanvas Feral kembali tertutup seluruhnya.
- `kaca` 0.62 hanya aman untuk teks sekunder `ink/70`. Jangan mengganti kembali
  ke `muted` di atas kaca; muted jatuh ke sekitar 3.0:1 di atas orb teal.
- Override `--color-muted` pada permukaan kaca dan `area-kaca` **wajib ikut**
  kalau opasitas bahan diturunkan. Kalau tidak, teks sekunder di dalam
  kerangka aplikasi kembali ke `#6e6e73` dan jatuh di bawah 4.5:1 di atas orb
  teal.
- `kaca-kartu` 0.72 dipilih karena gradasinya masih tembus, sementara `ink/70`
  di atas orb paling gelap tetap 5.3:1. Di bawah 0.7 teks sekunder turun lagi
  ke bawah 4.5:1; di atas 0.8 gradasi menghilang lagi dan kartu kembali
  terlihat seperti kertas.
- Latar lencana ikut menentukan kontras. Isian seperti `bg-emerald-500/12`
  mengubah latar yang diukur, jadi kontras lencana harus diukur per lencana,
  bukan per kartu.
- Anggaran blur: chrome + maksimal sekitar lima kartu ringkasan per layar.
  Tabel besar tidak boleh memakai `backdrop-filter`.
- Bug `namaLokasi` di mode tiruan adalah temuan terpisah, bukan bagian M7 dan
  tidak diperbaiki di sini. Untuk verifikasi Laporan, identifier itu diisi
  sementara di runtime browser; berkas `src/mock.js` tidak diubah.
- Splash loader dan aset BPJS tidak disentuh. Body transparan tidak
  mempengaruhinya karena `#pemuat-awal` punya latar sendiri.

## Referensi

- `docs/README.md` — indeks dokumentasi dan status milestone.
- `docs/superpowers/plans/2026-10-29-audit-poles-frontend.md` — arah desain
  permukaan dan kontras yang menjadi dasar pekerjaan ini.
- `src/style.css` — token material, override `--color-muted`, dan aturan body
  transparan.
- `src/tabel.js` — `KARTU`, `KARTU_RINGKASAN`, `kartuAngka`, dan warna lencana.
- `src/views/beranda.js`, `src/views/masuk.js`, `src/views/absen.js` —
  penerapan hero, login, dan kiosk.
- `src/kerangka.js` — pola kolom bilah atas dan `area-kaca`.
- `src/ui.js`, `src/animasi.js`, `src/latar.js`, `gradient.json`.
