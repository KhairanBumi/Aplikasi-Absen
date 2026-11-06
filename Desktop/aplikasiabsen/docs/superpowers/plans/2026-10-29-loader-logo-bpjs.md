# Pemuat Berlogo BPJS — Rencana

Tanggal: 2026-10-29
Status: dieksekusi 2026-10-29 (fase boot)

## Ringkasan

Rekomendasi: **satu splash boot yang singkat** dengan animasi logo BPJS
**dirangkai** dari tiga potong mark (daun hijau, busur kuning, busur biru),
lalu logo mengambang pelan selama aplikasi masih menyiapkan sesi dan rute
pertama. Setelah siap, splash memudar dan halaman masuk/beranda muncul.
Animasi ini hanya untuk **cold boot**, bukan setiap pindah menu.

Alasannya:

- Saat ini `index.html` hanya berisi `#akar`; CSS dan latar baru dipasang
  setelah `main.js` dievaluasi, sesi disegarkan, dan modul rute diimpor.
  Di jaringan lambat pengguna melihat layar kosong lebih dulu.
- Splash harus tampil **sebelum JS aplikasi** berjalan. Karena itu animasinya
  CSS murni dan markup-nya ditulis di `index.html`; jangan bergantung pada
  Motion atau modul rute.
- Logo yang dirangkai lebih khas daripada spinner generik, dan tetap memakai
  aset logo resmi — bukan menggambar ulang bentuk mark.
- Loader yang dipakai untuk menutupi **setiap** navigasi akan terasa lambat.
  Setelah boot, rute sudah di-cache oleh dynamic import; cukup fade halaman
  yang ada. Bila suatu saat rute terasa lambat, indikator garis tipis di atas
  lebih tepat daripada splash penuh.

## Prinsip yang dipakai

Diambil dari UI/UX Pro Max dan kondisi aplikasi:

- **Feedback >300 ms.** Boot yang benar-benar membutuhkan waktu harus punya
  indikator; jangan biarkan layar kosong.
- **Jangan menambah waktu.** Loader mengisi waktu tunggu, bukan menciptakan
  waktu tunggu baru. Tidak ada penundaan buatan yang panjang.
- **Animasi tak terbatas hanya untuk status loading.** Setelah selesai, semua
  animasi berhenti dan elemen splash dilepas dari DOM.
- **Reduced motion.** Saat `prefers-reduced-motion: reduce`, tampilkan logo
  statis + teks; tanpa lempar, tanpa rangkai, tanpa kilau.
- **1–2 elemen bergerak.** Rangkai logo + satu garis progres; hindari spinner,
  denyut, dan kilau yang semuanya berjalan bersamaan.
- **Transform/opacity saja.** Tidak menganimasikan width/height/filter mahal.
- **Brand asset resmi.** Gunakan potongan dari `public/bpjs-mark.png`; jangan
  mendistorsi proporsi atau mewarnai ulang logo.

## Yang akan dilihat pengguna

### Fase cold boot

| Waktu | Yang terjadi |
|---|---|
| 0 ms | Splash langsung terlihat: latar gradasi lembut yang menyerupai latar aplikasi, mark BPJS di tengah, teks “Menyiapkan aplikasi…”. |
| 0–620 ms | Tiga potongan mark masuk: daun hijau dari kiri, busur kuning dari atas, busur biru dari kanan. Masing-masing bergeser ±10 px, berputar sedikit, opacity 0→1, dengan jeda 60 ms. |
| 620–900 ms | Potongan menyatu. Mark penuh menggantikan potongan (crossfade) agar tidak ada celah 1 px. Garis tri-warna tipis mulai bergerak pelan di bawah logo. |
| Selama menunggu | Mark mengambang ±3 px (2,8 detik, ease-in-out). Teks tetap. Tidak ada angka persen palsu. |
| Siap | Mark membesar 1→1,03, seluruh splash memudar 220 ms, lalu dilepas dari DOM. Fokus tidak dipindahkan oleh splash. |

Jika aplikasi siap sebelum 450 ms, splash tetap ditahan sampai 450 ms supaya
tidak berkedip. Jika butuh lebih lama, splash tetap tampil sampai siap; tidak
ada batas maksimum yang memotong proses.

### Setelah boot

- Pindah menu: tidak ada splash. Tetap memakai fade halaman yang sudah ada.
- Fase opsional berikutnya: garis progres tipis di atas hanya muncul bila
  impor rute melewati 180 ms, supaya klik menu tidak terasa “tidak merespons”
  di jaringan lambat.
- Fase opsional lain: ganti teks “Memuat…” di dalam kartu dengan skeleton
  dan mark kecil yang bernapas. Ini lebih baik daripada splash penuh untuk
  data tabel.

## Pilihan desain yang dipertimbangkan

| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **A. Logo mengambang** — mark statis, naik-turun pelan, halo lembut | Paling sederhana, 1 aset, risiko rendah | Terasa generik; tidak banyak bercerita |
| **B. Logo dirangkai** — tiga potong mark masuk lalu menyatu, lanjut mengambang | Khas, memakai logo asli, tetap tenang setelah selesai | Perlu menyiapkan 3 potongan aset; perlu crossfade ke mark penuh |
| **C. Logo kilau** — lockup penuh dengan sapuan cahaya | Paling cepat dibuat | Kurang “hidup”; kilau mudah terlihat murahan |

**Dipilih B**, dengan A sebagai fallback reduced-motion. C tidak dipakai.

## Spesifikasi visual

- Latar splash: gradasi CSS statis yang mendekati Feral — hijau pucat di kiri
  atas, biru/teal di kanan atas, kuning lembut di kanan bawah, dasar
  `#ebf6f7`. Saat splash memudar, gradasi canvas asli sudah berada di
  belakangnya sehingga transisinya tidak “melompat”.
- Mark: 92 px di ponsel, 112 px di desktop. Tanpa kartu atau kotak putih;
  kedalaman dibuat dengan halo radial lembut di belakang mark (bukan
  background fill), sesuai arah visual logo yang sekarang.
- Warna aksen diambil dari logo: hijau `#3AB34A`, kuning `#D8D92B`,
  biru `#0B78BB` (verifikasi ulang dari aset saat implementasi).
- Teks: “Menyiapkan aplikasi…” 13–14 px, warna `muted`, di bawah logo.
- Garis progres: 144 × 3 px, gradien tiga warna, dengan sapuan terang yang
  bergerak; bukan progress bar palsu.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (sama dengan `--ease-apple`);
  durasi potongan 560–620 ms, jeda 60 ms, exit 220 ms.

## Arsitektur teknis

### Aset

1. Buat tiga potongan dari mark yang sudah ada, dengan kanvas 128×128 dan
   posisi yang sama:
   - `public/pemuat/daun.png` (hijau)
   - `public/pemuat/kuning.png` (busur kuning)
   - `public/pemuat/biru.png` (busur biru)
2. Siapkan juga `public/bpjs-mark.png` sebagai lapisan final.
3. Pisahkan berdasarkan warna dengan mempertahankan alpha; jangan memotong
   bentuk dengan kotak, agar tepi anti-alias tetap halus.
4. Preload keempat gambar di `<head>` agar splash tidak menampilkan logo
   kosong saat koneksi lambat.

### Markup dan CSS awal

- Tambahkan `#pemuat-awal` di `index.html`, sebelum `#akar`.
- Tulis CSS splash secara **inline di `index.html`** (sekitar 2–3 KB). Ini
  penting: CSS aplikasi baru dimuat lewat `main.js`, jadi splash tidak boleh
  menunggu berkas itu.
- Markup memuat tiga `<img>` potongan, satu `<img>` mark penuh (opacity 0),
  teks status, dan `<noscript>`.
- `role="status"`, `aria-live="polite"`, `aria-label="Memuat aplikasi"` pada
  wadah teks; gambar logo `alt=""` karena teks sudah menjelaskan status.

### JavaScript

Buat `src/pemuat.js`:

- `selesaikanPemuat()` — idempotent. Menandai splash selesai, menunggu
  durasi exit, lalu menghapus elemen dan menghentikan timer. Mengembalikan
  Promise agar bisa di-await bila perlu.
- `pemuatTampil()` / status untuk testing.
- Timer untuk memunculkan petunjuk “Koneksi lambat…” setelah ±10 detik.
- Jika JavaScript gagal total, `<noscript>` memberi pesan yang jelas.

Integrasi di `src/main.js`:

- Panggil `selesaikanPemuat()` setelah rute pertama selesai dipasang dan
  `animasiHalaman()` dijalankan.
- Bungkus pemanggilan rute pertama dengan `try/finally` agar kegagalan impor
  tidak meninggalkan splash selamanya. Untuk kegagalan, tampilkan pesan +
  tombol “Muat ulang” di splash (bukan spinner tanpa akhir).
- Splash tidak boleh mengubah fokus; setelah hilang, alur fokus yang sudah
  ada (skip link lalu isi utama) tetap berlaku.

### Opsional fase berikutnya

- `src/pemuat-rute.js` atau bagian kecil di `main.js`: garis tri-warna di
  atas, mulai hanya jika impor rute >180 ms; batalkan jika pengguna pindah
  rute lagi.
- Komponen `pemuatInline()` untuk mengganti teks “Memuat…” di kartu dengan
  mark kecil + skeleton baris. Tidak termasuk dalam fase boot.

## Aksesibilitas dan performa

- Tidak ada focus trap; splash bukan dialog.
- Status diumumkan sekali; animasi berulang tidak menghasilkan pengumuman.
- `prefers-reduced-motion`: logo langsung dalam keadaan utuh, tanpa float,
  tanpa sapuan garis; teks tetap.
- Semua animasi memakai transform/opacity; tidak ada layout shift.
- Splash dihapus dari DOM setelah selesai; timer dan animasi berhenti.
- Tidak menambah dependensi; CSS murni untuk boot, bukan Motion.
- Uji dengan JavaScript dimatikan: pesan `<noscript>` tetap terbaca.
- Kontras teks status terhadap latar minimal 4.5:1.
- Uji di 360, 390, 768, 1024, 1440 px, plus mode reduced motion.

## Langkah implementasi

1. Siapkan dan verifikasi tiga potongan mark + preload.
2. Tulis splash CSS inline dan markup di `index.html`.
3. Buat `src/pemuat.js` dengan API selesai/timer/noscript.
4. Hubungkan ke `src/main.js` setelah mount rute pertama.
5. Uji cold boot dengan cache kosong dan network throttle.
6. Uji reduced motion, JS mati, dan kegagalan impor rute.
7. (Opsional, setelah disetujui) garis progres rute + pemuat inline data.
8. Jalankan `npm test` dan `npm run build`; periksa tidak ada aset demo di
   build produksi.

## Kriteria selesai

- Tidak ada layar kosong sebelum aplikasi siap.
- Splash muncul <100 ms setelah HTML pertama, termasuk di dev dan production.
- Total splash tidak menambah waktu tunggu lebih dari 450 ms pada cold boot.
- Logo akhir identik dengan `bpjs-mark.png` (tidak ada garis sambung).
- Tidak ada animasi tersisa setelah splash dilepas.
- Reduced motion menampilkan versi statis yang tetap jelas.
- Tidak ada error console, layout shift, atau horizontal scroll.
- `npm test` dan `npm run build` lulus.

## Risiko dan keputusan

- **Garis sambung antar-potongan.** Diatasi dengan crossfade ke mark penuh
  setelah rangkaian selesai.
- **Splash berkedip pada koneksi sangat cepat.** Diatasi dengan minimum
  tampil 450 ms; ini satu-satunya penundaan buatan dan hanya saat cold boot.
- **Logo terlalu kecil / tenggelam di gradasi.** Halo radial dan ukuran
  92–112 px; tidak memakai kartu putih.
- **Route import gagal.** Splash harus punya keadaan gagal dengan tombol
  muat ulang, bukan menunggu selamanya.
- **Fase 2 memperluas scope.** Rekomendasi: eksekusi fase boot dulu, lihat
  rasanya, baru putuskan garis rute/skeleton data.

## Catatan implementasi

- Potongan mark dibuat dari `public/bpjs-mark.png` berdasarkan hue (hijau
  90–180°, kuning 25–90°, biru 180–280°) tanpa mengubah alpha. Sembilan piksel
  hitam alpha-1 dari ekspor lama sengaja tidak disertakan.
- Atas permintaan pemilik, ritme akhirnya dibuat sekitar 2,75 detik: potongan
  mark masuk horizontal pada 20–700 ms, crossfade ke mark penuh 700–960 ms,
  wordmark resmi muncul dari kanan pada 1.000–1.500 ms sambil mendorong mark
  ke kiri, lalu label cabang `Karimunjawa` muncul dari bawah pada
  1.550–2.000 ms dan mengangkat seluruh lockup sedikit. Lockup ditahan
  500 ms sebelum splash memudar 250 ms. Wordmark memakai crop dari lockup
  resmi `public/bpjs-logo.png` di `public/pemuat/kata.png`.
- Inter dipindahkan dari stylesheet render-blocking di `index.html` ke
  `src/main.js`. Splash bisa tampil lebih dulu, sedangkan font sistem dipakai
  sampai Inter siap.
- `inert` pada `#akar` sempat dicoba tetapi dilepas: layar masuk memasang
  fokus awal ke kolom NIP, dan `inert` membuat fokus itu gagal.
- Verifikasi: 24 tes frontend lulus, build produksi lulus, preview produksi
  memuat keempat aset, reduced motion menampilkan logo statis, tanpa JavaScript
  menampilkan pesan `noscript`, kegagalan impor rute menampilkan tombol muat
  ulang, dan tidak ada overflow horizontal pada 360–1440 px.
