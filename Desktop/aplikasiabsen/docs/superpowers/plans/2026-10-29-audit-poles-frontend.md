# Audit & Poles Frontend — Implementation Plan

> **Status: rencana saja.** Belum ada kode aplikasi yang diubah. Jangan mulai
> implementasi sebelum pemilik aplikasi menyetujui rencana ini.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) atau
> `superpowers:executing-plans` untuk mengeksekusi rencana ini. Langkah memakai
> kotak centang (`- [ ]`) untuk pelacakan.

**Goal:** Menaikkan kualitas seluruh layar frontend Aplikasi Absen — keterbacaan,
aksesibilitas, responsivitas, kejelasan keadaan, dan rasa antarmuka — tanpa
mengubah alur bisnis, kontrak API, atau identitas visual yang sudah dipakai.

**Architecture:** Pekerjaan dibagi menjadi tiga lapis. Lapis pertama adalah
fondasi bersama: token permukaan, sistem kontrol, fokus, keadaan memuat/kosong/
galat, dan notifikasi. Lapis kedua memperbaiki shell navigasi serta layar kiosk
dan login yang paling berisiko. Lapis ketiga merapikan tabel, layar data, dan
detail audit/anomali. Setiap perubahan diterapkan lewat komponen bersama lebih
dulu, lalu layar pemakainya, supaya perbaikan tidak menjadi tambalan per layar.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 8, Tailwind CSS 4, Vitest 5,
Motion 14, Laravel/PHP di backend (tidak diubah pada rencana ini).

**Spec dan bukti audit:**

- `KONTRAK-API.md` — bentuk data yang dipakai layar. Rencana ini tidak mengubah
  kontrak.
- `docs/PRD.md`, `docs/milestones/M2-kiosk-absen.md`,
  `docs/milestones/M3-dashboard-data-master.md`,
  `docs/milestones/M4-izin-riwayat-laporan.md` — perilaku yang sudah disepakati.
- Audit baca kode seluruh `src/views/*.js`, `src/kerangka.js`, `src/ui.js`,
  `src/tabel.js`, `src/animasi.js`, `src/style.css`, `index.html`, serta
  tangkapan layar desktop/mobile pada 29 Oktober 2026.
- Tangkapan layar audit bersifat sementara dan **tidak** ikut di-commit.

## Global Constraints

- Akar aplikasi: `D:\Work\Aplikasi-Absen\Desktop\aplikasiabsen`. Frontend di
  akar, backend di `backend/`.
- Semua dokumen repo ditulis dalam bahasa Indonesia.
- Jangan mengubah backend, `KONTRAK-API.md`, `AGENTS.md`, atau konfigurasi rilis
  pada rencana ini. Semua temuan bisa diselesaikan di frontend dengan data yang
  sudah tersedia.
- Jangan menulis PIN mentah, token, `pin_hash`, atau isi foto ke respons, log,
  audit, dokumentasi, atau keluaran perintah. Pengujian memakai akun demo dan
  tidak menampilkan PIN di terminal.
- Jangan menjalankan `migrate:fresh`, `db:wipe`, atau `DROP` pada database
  pengembangan. Rencana ini tidak memerlukan perintah database.
- Jangan `git commit` atau `git push` kecuali diminta secara eksplisit. Satu task
  yang sudah lulus verifikasi boleh menjadi satu commit hanya setelah ada
  persetujuan.
- Semua animasi harus tetap berfungsi saat `prefers-reduced-motion: reduce`.
  Timer, listener, dan animasi wajib dibersihkan saat layar dilepas.
- Perubahan yang terlihat pengguna wajib diuji di browser dengan backend asli
  (`VITE_USE_MOCK=false`) pada ukuran 360, 768, 1024, dan 1440 px. Tes unit
  bukan bukti tampilan berjalan.
- Helper murni baru (kontras, keadaan, pemformatan) ditulis dengan tes lebih
  dulu; perubahan DOM dan interaksi diverifikasi di browser.
- Pertahankan identitas visual yang ada: latar gradasi, permukaan kaca, aksen
  indigo `#5856d6`, sudut membulat, ikon SVG, dan tipografi sistem. Rencana ini
  tidak mengganti bahasa tampilan menjadi dashboard gelap.

## 1. Ringkasan audit

### Yang sudah baik dan harus dipertahankan

- Struktur shell dan menu diturunkan dari satu sumber (`src/menu.js`), sehingga
  rute dan navigasi tidak mudah melenceng.
- Kiosk sudah punya alur yang lengkap: identitas perangkat, PIN, kamera,
  hitung mundur, idempotensi, pesan galat, dan pengumuman `aria-live`.
- Pemisahan logika murni (`src/laporan-csv.js`, `src/csv.js`, `src/lokasi.js`)
  memudahkan pengujian tanpa DOM.
- Konfirmasi tindakan berbahaya, fokus awal dialog, penanganan sesi kedaluwarsa,
  dan skip-link sudah menjadi kebiasaan yang benar.
- Bahasa tulis layar konsisten, manusiawi, dan tidak menuduh (misalnya “Tanpa
  kabar” alih-alih “Alpa”).
- Animasi yang ada sudah menghormati `prefers-reduced-motion` dan dibersihkan
  pada sebagian besar layar.

### Temuan paling berisiko

| Tingkat | Temuan | Dampak |
|---|---|---|
| P0 | Permukaan kaca 62% membuat teks sekunder gagal kontras di atas orb teal; `text-faint` dan sebagian lencana juga di bawah 4,5:1. | NIP, status, tautan Peta, dan pesan GPS sulit dibaca, terutama di kiosk dan layar kelas rendah. |
| P0 | Fokus keyboard nyaris tidak terlihat: `KELAS_ISIAN` menghapus outline dan hanya memakai cincin ungu 15%; radio mode kiosk tidak punya gaya fokus. | Pengguna keyboard/switch kehilangan posisi; gagal WCAG 2.4.7. |
| P0 | Kiosk tidak muat di 360×640; CTA bisa jatuh di bawah lipatan; tidak ada Batal saat kamera/hitung mundur; galat kamera menutup sendiri dalam 7 detik dan membuang NIP/PIN. | Antrean kiosk tersendat dan absen yang gagal sulit diulang. |
| P0 | Navigasi mobile berupa deret pil horizontal yang terpotong (“Rekap &…”), tanpa penanda masih ada menu lain. | Menu dan tindakan penting tidak ditemukan di HP/tablet. |
| P0 | Tabel `min-w-[42rem]` memaksa scroll horizontal; kolom aksi/status berada di ujung yang tidak terlihat; wrapper tidak bisa difokus keyboard. | Data dan tombol tidak terjangkau di 360–1024 px. |
| P0 | Persetujuan izin bisa menampilkan respons tab lama setelah admin pindah tab; tombol Setujui/Tolak berisiko mengenai baris yang salah. | Keputusan admin bisa salah orang. |
| P1 | Kolom “Terlambat” di rekap menulis `${telat_menit} m`, bukan “menit”. | Angka 15 menit terbaca sebagai 15 meter. |
| P1 | Loading masih teks statis; galat tanpa tombol coba lagi; keadaan kosong tidak seragam; sukses CRUD senyap. | Pengguna tidak tahu apakah data masih dimuat, kosong, atau gagal. |
| P1 | Login tidak menormalkan NIP, mengosongkan PIN saat galat jaringan, dan menahan satu klik dialog sukses. | Login gagal tanpa alasan yang jelas dan alurnya terasa lambat. |
| P1 | Rincian audit ditampilkan sebagai JSON mentah; tingkat anomali hanya dibedakan warna. | Sulit dibaca dan melanggar prinsip “jangan andalkan warna saja”. |
| P2 | Motion belum konsisten; stagger 50 baris bisa berjalan beberapa detik; Motion ikut chunk awal; Google Fonts dimuat dari jaringan luar. | Animasi terasa lambat dan kiosk bergantung pada koneksi internet. |

## 2. Arah desain yang disepakati

### 2.1 Permukaan dan kontras

Gradasi latar bisa menempatkan orb teal `#008899` di belakang kartu mana pun.
Kaca 62% di atas orb itu hanya menghasilkan kontras `muted` sekitar 3,1:1.
Karena itu permukaan dibagi menjadi empat:

| Utility | Nilai | Dipakai untuk | Aturan teks |
|---|---|---|---|
| `kaca` | putih 92% + blur 24px | sidebar, header, chrome yang tetap terlihat kaca | `muted` boleh; tetap verifikasi |
| `kaca-kartu` | putih 92%, **tanpa** `backdrop-filter` | semua `KARTU`, kartu kiosk, kartu login | `muted` boleh |
| `kaca-tebal` | putih 94% + blur 40px | dialog dan sheet | `muted` boleh |
| `kaca-tipis` | putih 62% + blur 24px | hanya pil/ikon dekoratif | wajib `text-ink`; jangan `text-muted` |

`KARTU` di `src/tabel.js:13` berubah dari `kaca` menjadi `kaca-kartu`.
Kartu kiosk (`src/views/absen.js:429`), kartu hasil (`:823`), kartu login
(`src/views/masuk.js:53`), dan layar `segera.js:20` juga memakai `kaca-kartu`.
Pil lokasi/kembali kiosk dan pil merek memakai `kaca-tipis` dengan `text-ink`.

Kartu konten sengaja tidak memakai `backdrop-filter`: secara visual hasilnya
hampir sama karena opasitasnya sudah 92%, tetapi biaya compositing turun
signifikan di PC kiosk. Efek kaca tetap hidup di sidebar, header, dan dialog.

Teks yang berada langsung di atas gradasi (bukan di atas permukaan) harus diberi
pil/permukaan. Contoh saat ini: merek dan tanggal di header kiosk, tanggal di
bawah jam, footer kiosk, serta teks “Aplikasi Absen” di layar masuk. Teks 12–14
px langsung di atas orb teal tidak bisa mencapai 4,5:1 walau memakai `ink`.

Palet status dibuat konsisten:

- aman: `emerald-700`
- peringatan: `amber-800` (bukan `amber-700` di atas lencana)
- bahaya: `rose-700`
- netral: `muted`
- `text-faint` hanya untuk garis/ikon dekoratif. NIK di
  `src/views/magang.js:75` berubah menjadi `text-muted`.

**Kriteria terima:** skrip kontras membuktikan `muted` ≥ 4,5:1 di atas
`kaca-kartu` untuk keempat stop gradasi, `ink/70` ≥ 4,5:1 di atas `kaca`, dan
`amber-800` ≥ 4,5:1 di atas lencana amber.

### 2.2 Tipografi, spasi, dan radius

- Ukuran badan tetap 16 px; teks tabel 14 px; teks bantu minimal 12 px.
- Angka KPI, jam, dan kolom numerik memakai `tabular-nums` (sudah ada).
- Jarak mengikuti kelipatan 4/8 px. Padding kartu menjadi `p-5 sm:p-6` agar
  layar 360 px tidak boros ruang.
- Tambahkan token radius: `--radius-kartu: 1.75rem`,
  `--radius-dialog: 1.5rem`, `--radius-pil: 9999px`. Ganti 11 nilai hardcoded
  `rounded-[1.75rem]`/`rounded-[1.5rem]`.
- `color-scheme: light` dideklarasikan di `index.html`/CSS agar auto-dark
  Android tidak membalik kaca dan kanvas.

### 2.3 Kontrol, fokus, dan sentuhan

- Satu pabrik tombol di `src/ui.js`: varian `utama`, `halus`, `bahaya`,
  `baris`; ukuran `md` (min 44 px) dan `sm` (min 44 px pada layar sentuh).
  Hapus enam definisi terpisah di `ui.js`, `tabel.js`, `masuk.js`, `absen.js`,
  dan `segera.js`.
- Semua tombol punya `focus-visible:ring-2 focus-visible:ring-merek
  focus-visible:ring-offset-2`, status `disabled:opacity-50`, dan
  `disabled:cursor-not-allowed`.
- Kolom isian memakai `focus:ring-2 focus:ring-merek` (bukan `ring-merek/15`).
  Kolom tanggal audit/anomali memakai kelas yang sama, bukan `outline-none`
  tanpa cincin.
- Label radio kiosk memakai `has-[:focus-visible]:ring-2
  has-[:focus-visible]:ring-merek` dan `has-[:focus-visible]:ring-offset-2`.
- Target sentuh minimum 44×44 px: tombol bulan, aksi baris tabel, Keluar, tautan
  GPS “Ambil lokasi”/“Coba lagi”, dan tombol tutup toast.
- Tombol ikon tanpa teks wajib punya `aria-label`; tombol berulang di tabel
  wajib menyebut konteks, misalnya “Ubah data Budi”, bukan hanya “Ubah”.

### 2.4 Navigasi responsif

- Di bawah `lg`, deret pil horizontal dihapus. Header menampilkan satu tombol
  **Menu** (ikon + `aria-label`, `aria-expanded`, `aria-controls`) yang membuka
  sheet navigasi dari kiri memakai `<dialog>`.
- Sheet memuat grup menu yang sama dengan sidebar, item setinggi minimal 44 px,
  status aktif, kartu pengguna, dan tombol Keluar. Fokus ditangani browser;
  sheet ditutup saat item dipilih, Esc, atau klik backdrop.
- Header tetap menampilkan judul halaman. Tombol Keluar selalu punya nama
  aksesibel, termasuk saat teksnya disembunyikan di layar sempit.
- Sidebar desktop, skip-link, dan `aria-current="page"` dipertahankan.

### 2.5 Keadaan memuat, kosong, dan galat

Buat `src/keadaan.js` (baru) berisi:

- `skeleton({ jenis, baris })` — skeleton kartu/tabel/daftar dengan
  `aria-busy="true"` dan teks “Memuat…” khusus pembaca layar.
- `kosong({ judul, pesan, aksi })` — ikon netral, judul, penjelasan, dan CTA
  opsional.
- `galat({ pesan, ulang })` — `role="alert"`, pesan, dan tombol “Coba lagi”
  dengan `data-ulang`.
- `toast({ jenis, pesan })` — wilayah `aria-live` global, muncul 3–4 detik,
  bisa ditutup, tidak mencuri fokus. Sukses memakai `role="status"`; galat
  memakai `role="alert"`.

Aturan penerapan:

- Setiap pemuatan data menampilkan skeleton yang bentuknya mendekati isi akhir.
- Galat tidak menghapus filter/pemilih bulan yang sudah ada; pengguna harus
  bisa memilih bulan/tanggal lain atau menekan “Coba lagi”.
- Keadaan kosong menjelaskan langkah berikutnya, bukan hanya “Belum ada data”.
- Sukses CRUD dan keputusan izin memakai toast, bukan dialog yang menahan klik.
- Dialog konfirmasi/galat tetap memakai `<dialog>` karena keputusannya blocking.

### 2.6 Motion dan performa

- Durasi mikrointeraksi 150–300 ms; transisi halaman maksimal 340 ms.
- Stagger daftar dibatasi maksimal 8–10 elemen atau total 300 ms; baris
  sisanya langsung tampil. Saat ini 50 baris audit bisa memudar lebih dari 3
  detik.
- `animasiHalaman` menghentikan kontrol sebelumnya **sebelum** guard
  `prefers-reduced-motion`.
- Animasi kiosk (`pop`, `coretJalur`) dilacak oleh `panggung()` dan dihentikan
  saat kembali ke layar awal.
- Motion diimpor dinamis dari `main.js` agar tidak masuk chunk awal.
- Spinner yang dibekukan oleh aturan reduced-motion diganti teks status statis;
  jangan menampilkan spinner yang tampak rusak.
- Hapus tautan Google Fonts di `index.html`; pakai tumpukan font sistem yang
  sudah menjadi pilihan pertama. Ini menghilangkan ketergantungan jaringan dan
  pergeseran metrik di kiosk.
- Avatar diberi `width`/`height` eksplisit dan `decoding="async"` untuk
  mengurangi CLS.
- Ukur ulang waktu muat dan scroll setelah perubahan; jika kanvas latar masih
  berat di perangkat rendah, turunkan resolusi maksimum kanvas sebelum
  mengubah desain.

## 3. Temuan per layar

| Layar | Temuan utama | Tindakan |
|---|---|---|
| **Masuk** `src/views/masuk.js` | NIP tidak di-uppercase; PIN dikosongkan saat galat jaringan; dialog sukses menahan navigasi; tidak ada show/hide PIN; `autocomplete=off`. | Normalisasi NIP, pertahankan PIN saat jaringan gagal, ganti dialog sukses dengan toast, tambah tombol tampil/sembunyikan PIN, `current-password`. |
| **Kiosk** `src/views/absen.js` | Paragraf kebijakan 5 baris; CTA bisa di bawah lipatan 360×640; radio tanpa fokus terlihat; tidak ada Batal saat kamera; galat kamera auto-tutup dan membuang kredensial; teks status GPS 12 px terlalu rapat. | Layout dua kolom di layar lebar, ringkas bantuan GPS ke `<details>`, perbesar status dan tombol, Batal/retry kamera, galat tidak auto-tutup, pertahankan NIP/PIN untuk retry. |
| **Beranda** `src/views/beranda.js` | Loading mengganti seluruh dashboard dengan teks; galat tanpa tombol retry; handler `[data-ulang]` tidak pernah ada; centang hijau untuk “belum ada anak magang”; navigasi hari hanya panah; KPI 4 kolom baru di `xl`. | Skeleton, retry, tombol “Hari ini” + date picker, ikon netral, KPI `lg:grid-cols-4`, batasi daftar panjang dengan “Tampilkan semua”. |
| **Anak Magang** `src/views/magang.js` | Pencarian tanpa label; formulir 11 kolom dengan Simpan di dasar; PIN bebas teks; shift/lokasi terpilih otomatis tanpa placeholder; sukses senyap; `text-faint` untuk NIK. | Label/aria, validasi PIN 4–6 digit, placeholder shift/lokasi, footer dialog sticky, toast sukses, `text-muted`, aksi baris kontekstual. |
| **Lokasi Kantor** `src/views/lokasi.js` | Lintang/bujur diketik manual; `min/max` tidak ditegakkan; status nonaktif lewat dropdown tanpa konfirmasi. | Validasi angka di klien, konfirmasi perubahan status, opsi “Pakai lokasi saat ini” (P2), toast, kartu mobile. |
| **Shift Kerja** `src/views/shift.js` | “Hapus” tetap tampil saat shift dipakai dan pasti ditolak server. | Sembunyikan/nonaktifkan Hapus bila `jumlah_magang > 0`; arahkan ke Nonaktifkan; toast. |
| **Hari Libur** `src/views/hari-libur.js` | Pencarian tanpa label; tabel 3 kolom tetap dipaksa 672 px; input satu per satu. | Label/aria, tabel responsif, tambah rentang tanggal (P2), toast. |
| **Izin & Cuti** `src/views/izin.js` | Bar kuota tanpa role/aria; saat galat angka tetap 0 dan bar 0%; tanggal “Mulai” tanpa `min`; “Menunggu” tidak terlihat di bar. | `role="progressbar"`, state galat `—`, validasi rentang tanggal, bar bertumpuk (terpakai/menunggu), toast. |
| **Persetujuan Izin** `src/views/izin-masuk.js` | Respons tab lama bisa menimpa tab baru; tab tanpa role/aria; aksi di ujung tabel; sukses senyap. | Token permintaan, ARIA tabs + panah keyboard, kartu mobile, toast, aria-label kontekstual. |
| **Riwayat Absen** `src/views/riwayat.js` | KPI bulan lama tetap tampil saat ganti bulan; tabel 6 kolom memaksa scroll; bulan tidak tersimpan di URL. | Kosongkan KPI + skeleton, kartu harian di mobile, simpan bulan di hash (P2). |
| **Rekap & Laporan** `src/views/laporan.js` | `${telat_menit} m` salah satuan; agregat izin hanya tooltip; galat rincian menghapus seluruh layar; tabel 8 kolom; tidak ada pencarian untuk 50 magang. | “menit”, pecahan izin/cuti/sakit, galat menyisakan header + Kembali, pencarian klien, kartu mobile, toast unduh. |
| **Log Audit** `src/views/audit.js` | Rincian JSON mentah; aksi mentah; filter aksi bebas tanpa bantuan; paginasi tidak mengembalikan fokus/scroll; `dari > sampai` tidak dicek. | Humanisasi aksi, rincian kunci-nilai, datalist aksi, validasi tanggal, retry, fokus/scroll setelah halaman berubah, kartu mobile. |
| **Anomali** `src/views/anomali.js` | Tingkat hanya warna; tidak ada teks “Tinggi/Sedang/Rendah”; filter hanya tanggal; tanpa retry. | Kolom tingkat dengan teks + ikon, filter jenis/tingkat, retry, jumlah hasil. |
| **Segera** `src/views/segera.js` | Label “Kembali ke beranda” tetapi magang diarahkan ke riwayat; permukaan `kaca`. | Label “Kembali ke halaman awal”, `kaca-kartu`. |

## 4. Rencana implementasi

### Task 1: Token permukaan, kontras, dan skrip verifikasi

**Files:**
- Modify: `src/style.css`, `src/tabel.js`, `src/views/absen.js`,
  `src/views/masuk.js`, `src/views/segera.js`, `src/views/magang.js`,
  `src/views/beranda.js`, `src/views/izin-masuk.js`, `index.html`,
  `package.json`
- Create: `scripts/periksa-kontras.mjs`

**Steps:**

- [ ] Tambahkan utility `kaca-kartu` (putih 92%, tanpa backdrop-filter) dan
  `kaca-tipis` (putih 62%); ubah `kaca` menjadi 92% dan `kaca-tebal` menjadi
  94%. Pertahankan border, inset highlight, dan shadow yang sudah ada.
  Perbarui komentar kontras di `style.css` agar tidak lagi mengklaim 62% aman.
- [ ] Ganti `KARTU` menjadi `kaca-kartu rounded-kartu p-5 sm:p-6`. Ganti kartu
  kiosk, hasil kiosk, login, dan `segera` ke `kaca-kartu`. Ganti pil lokasi/
  kembali kiosk ke `kaca-tipis`. Perbarui `beranda.js:159` yang memakai
  `.closest('.kaca')` menjadi `.closest('.kaca-kartu')` agar animasi kartu
  tanggal tidak diam-diam berhenti.
- [ ] Tambahkan token `--radius-kartu`, `--radius-dialog`, `--radius-pil`,
  `--color-peringatan`, `--color-bahaya`, `--color-aman`; ganti nilai radius
  hardcoded pada layar yang disentuh task ini.
- [ ] Ubah `WARNA_ABSEN.telat`, `WARNA_PENGAJUAN.menunggu`, dan semua teks
  peringatan di atas latar amber menjadi `text-amber-800`/token peringatan.
  Ubah NIK `text-faint` menjadi `text-muted`; ubah KPI libur `text-faint`
  menjadi `text-muted`.
- [ ] Ganti angka pada tab aktif `izin-masuk.js:118` dari `text-white/70`
  menjadi `text-white`/`text-white/90`; teks putih 70% di atas `bg-merek` hanya
  sekitar 3,6:1.
- [ ] Beri permukaan pada teks yang berada langsung di atas gradasi: merek dan
  tanggal kiosk, footer kiosk, header login. Gunakan pil `kaca-tipis` atau
  `bg-white/70` dengan teks `text-ink`.
- [ ] Tambahkan `color-scheme: light` di `index.html` atau `:root`.
- [ ] Buat `scripts/periksa-kontras.mjs` tanpa dependensi baru. Skrip membaca
  stop dari `gradient.json` dan menguji pasangan: `muted`/`kaca-kartu`,
  `ink/70`/`kaca`, `white`/`merek`, `amber-800`/lencana amber,
  `emerald-700`/lencana emerald, `rose-700`/lencana rose. Gagal dengan exit
  code 1 bila ada pasangan di bawah ambang.
- [ ] Tambahkan `"periksa:kontras": "node scripts/periksa-kontras.mjs"` ke
  `package.json`.

**Acceptance:**

- `npm run periksa:kontras` lulus.
- Tidak ada `text-muted` di atas `kaca-tipis` atau gradasi mentah.
- Kartu konten tidak memakai `backdrop-filter`; sidebar/header/dialog tetap
  memakai blur.
- Tangkapan layar 360/768/1024/1440 tidak menunjukkan teks sekunder yang pudar
  di atas orb teal.

### Task 2: Sistem tombol, fokus, dan dialog

**Files:**
- Modify: `src/ui.js`, `src/tabel.js`, `src/kerangka.js`,
  `src/views/absen.js`, `src/views/masuk.js`, `src/views/segera.js`,
  `src/views/audit.js`, `src/views/anomali.js`
- Test: `src/tabel.test.js` (tambahan), `src/ui.test.js` (baru, bila diperlukan)

**Steps:**

- [ ] Buat `tombol(varian, { ukuran, kelas })` di `ui.js` dengan kelas utuh
  (bukan dirakit dari potongan) agar Tailwind tetap memindai. Varian:
  `utama`, `halus`, `bahaya`, `baris`; semua minimal 44 px.
- [ ] Ganti `KELAS_TOMBOL` di `ui.js`, `TOMBOL_UTAMA`/`TOMBOL_HALUS`/
  `TOMBOL_BARIS` di `tabel.js`, `KELAS_TOMBOL` di `masuk.js`/`absen.js`, dan
  tombol di `segera.js` dengan pabrik tersebut.
- [ ] Ubah `KELAS_ISIAN`: `focus:border-merek focus:ring-2 focus:ring-merek`;
  hapus `focus:ring-merek/15`. Buat `KELAS_FILTER` yang dapat dipakai ulang
  oleh audit/anomali dan ganti `KELAS_TANGGAL` di kedua layar.
- [ ] Tambahkan gaya fokus pada label radio kiosk dan pada pembungkus tabel
  yang bisa digulir (`tabindex="0"`, `role="region"`, `aria-label`).
- [ ] Tambahkan `aria-label="Keluar"` pada tombol keluar di `kerangka.js`
  (teks tetap disembunyikan di layar sempit).
- [ ] Beri `aria-labelledby` dan `aria-describedby` pada dialog di `ui.js`.
  `beritahu` menerima `jenis` (`berhasil`, `galat`, `info`) dan memakai ikon
  yang sesuai; kegagalan tidak boleh memakai centang hijau.
- [ ] Simpan elemen pemicu sebelum dialog dibuka; pulihkan fokus saat dialog
  ditutup bila elemen masih terhubung. Untuk aksi yang menggambar ulang tabel,
  layar memindahkan fokus ke baris yang sama atau ke judul daftar.
- [ ] Tambahkan `aria-label`/teks tersembunyi pada kotak cari di
  `kepalaDaftar` dan pada tombol aksi baris yang berulang.
- [ ] Di `segera.js`, ubah label “Kembali ke beranda” menjadi “Kembali ke
  halaman awal” karena magang diarahkan ke `#/riwayat`.

**Acceptance:**

- Tab dari awal halaman menampilkan cincin fokus 2 px yang jelas pada setiap
  kontrol: input, select, radio kiosk, tombol, dan tabel yang bisa digulir.
- Tidak ada tombol ikon tanpa nama aksesibel.
- Dialog diumumkan dengan judul; fokus kembali ke pemicu setelah ditutup.
- `npm test` dan `npm run build` lulus.

### Task 3: Komponen keadaan dan toast

**Files:**
- Create: `src/keadaan.js`, `src/keadaan.test.js`
- Modify: `src/tabel.js`, `src/ui.js`, `src/views/*.js` (bertahap),
  `src/main.js`

**Steps:**

- [ ] Implementasikan `skeleton`, `kosong`, `galat`, dan `toast` sesuai bagian
  2.5. Tidak memakai dependensi baru; animasi memakai CSS/Tailwind.
- [ ] Ganti `pesanGalat` di `tabel.js` dengan komponen `galat` yang mendukung
  tombol “Coba lagi” dan `role="alert"`.
- [ ] Ubah `tabel()` agar keadaan kosong memakai `kosong()`, bukan satu baris
  `<td>`; dukung CTA opsional yang dapat dipasang layar.
- [ ] Tambahkan satu wadah toast global yang dibuat saat pertama dibutuhkan,
  dengan `aria-live="polite"` untuk sukses dan `role="alert"` untuk galat.
- [ ] Terapkan toast pada: sukses tambah/ubah/nonaktifkan magang, simpan lokasi/
  shift/hari libur, setujui/tolak izin, unduh CSV, dan login berhasil.
- [ ] Ganti teks “Memuat…” di setiap layar dengan skeleton yang sesuai; hapus
  teks yang tidak punya `aria-busy`/`role="status"`.
- [ ] Pastikan setiap handler `[data-ulang]` benar-benar terpasang. Hapus
  handler mati di `beranda.js:385` atau ubah markup galat agar memakai tombol
  tersebut.

**Acceptance:**

- Semua layar memiliki tiga keadaan yang bisa dibedakan: memuat, kosong, galat.
- Galat menyisakan filter/pemilih bulan dan menyediakan “Coba lagi”.
- Sukses CRUD tidak lagi berupa reload senyap.
- `src/keadaan.test.js` menguji HTML skeleton (ada `aria-busy`), galat (ada
  `data-ulang`), dan kosong (ada CTA).
- Pembaca layar menerima pengumuman status tanpa fokus berpindah paksa.

### Task 4: Shell dan navigasi mobile

**Files:**
- Modify: `src/kerangka.js`, `src/style.css`, `src/menu.js` (bila perlu label)

**Steps:**

- [ ] Hapus deret nav horizontal di header (`kerangka.js:137-140`). Tambahkan
  tombol Menu di header dengan ikon, `aria-label`, `aria-expanded`, dan
  `aria-controls`.
- [ ] Tambahkan `<dialog data-menu>` berisi panel kiri dengan grup menu yang
  sama seperti sidebar, item minimal 44 px, status aktif, kartu pengguna, dan
  tombol Keluar. Gunakan `showModal()`; tutup saat item dipilih, Esc, atau klik
  backdrop.
- [ ] Tambahkan animasi masuk 180–220 ms yang dimatikan saat reduced motion.
- [ ] Pastikan fokus pertama berada di item aktif atau tombol tutup; setelah
  dialog ditutup, fokus kembali ke tombol Menu.
- [ ] Pertahankan sidebar desktop, skip-link, `aria-current`, dan judul header.
- [ ] Tambahkan `aria-label` pada tombol Keluar dan pastikan target sentuh
  header minimal 44 px.

**Acceptance:**

- Di 360/768 px seluruh menu terlihat tanpa teks terpotong; item aktif jelas.
- Menu bisa dibuka/ditutup dengan keyboard dan screen reader.
- Tidak ada scroll horizontal pada header.
- Desktop 1024/1440 px tidak berubah perilakunya.

### Task 5: Kiosk — muat, fokus, dan pemulihan

**Files:**
- Modify: `src/views/absen.js`, `src/kamera.js` (bila perlu),
  `src/lokasi.js` (hanya pesan), `src/style.css`

**Steps:**

- [ ] Ubah layout kiosk: pada ≥1024 px tampilkan dua kolom (jam/identitas di
  kiri, formulir di kanan); pada 360 px kecilkan jam menjadi `text-5xl`,
  kurangi padding vertikal, dan pastikan tombol “Absen Sekarang” terlihat
  tanpa scroll.
- [ ] Ringkas paragraf kebijakan GPS menjadi satu kalimat + `<details>`
  “Kenapa lokasi dicatat?”. Status GPS memakai teks 14 px, ikon, dan tombol
  pil “Ambil lokasi”/“Coba lagi” setinggi 44 px; checkbox fallback juga 44 px.
- [ ] Tambahkan fokus terlihat pada label radio mode. Pastikan label radio
  tetap bisa diaktifkan dengan keyboard dan status terpilih terbaca.
- [ ] Tambahkan tombol **Batal** di layar kamera dan saat hitung mundur.
  Batal menghentikan semua track kamera, membatalkan timer, kembali ke
  formulir, mempertahankan NIP, dan mengosongkan PIN.
- [ ] Simpan kredensial di memori selama alur kamera. Jika kamera gagal, tampilkan
  “Coba lagi” yang memakai NIP/PIN/mode yang sama dan “Mulai ulang” yang
  membersihkan semuanya. Jangan membuang kredensial hanya karena kamera gagal.
- [ ] Ubah `tampilkanHasil` agar galat dan kegagalan kamera **tidak** auto-tutup.
  Sukses boleh auto-tutup; sediakan tombol “Selesai”. Hasil galat harus punya
  aksi retry/ulang yang jelas.
- [ ] Tambahkan pengumuman `aria-live` untuk hitung mundur dan perubahan langkah.
- [ ] Lacak animasi `pop`/`coretJalur` dengan `panggung()` dan hentikan saat
  `kembaliKeAwal()`/unmount.

**Acceptance:**

- Pada 360×640, 768×1024, dan 1024×768, formulir dan CTA terlihat tanpa scroll
  awal; tidak ada teks yang bertumpuk.
- Kamera bisa dibatalkan kapan pun; lampu kamera mati setelah Batal.
- Kegagalan kamera dapat diulang tanpa mengetik ulang NIP/PIN.
- Kegagalan GPS di mode luar tetap menampilkan checkbox fallback dan tidak
  memaksa menunggu 12 detik berulang.
- Alur sukses dengan backend asli tetap mencatat absen seperti sebelumnya.

### Task 6: Login

**Files:**
- Modify: `src/views/masuk.js`, `src/ui.js` (toast)

**Steps:**

- [ ] Normalisasi NIP menjadi huruf besar saat mengetik dan sebelum dikirim.
- [ ] Tambahkan tombol tampil/sembunyikan PIN dengan `aria-label` dan
  `aria-pressed`; target 44 px.
- [ ] Ubah `autocomplete` PIN menjadi `current-password`.
- [ ] Kosongkan PIN hanya saat galat kredensial (401/422); pertahankan PIN saat
  galat jaringan agar pengguna bisa mencoba lagi.
- [ ] Ganti dialog sukses yang menahan klik dengan toast setelah navigasi ke
  halaman pertama. Pastikan fokus akhir berada di judul/isi halaman tujuan.
- [ ] Kecilkan jam di layar 360 px bila diperlukan agar kartu dan CTA masuk
  dalam viewport.
- [ ] Tambahkan teks bantuan “4–6 angka” yang persisten, bukan hanya
  placeholder.

**Acceptance:**

- NIP “mgg001” berhasil masuk seperti “MGG001”.
- PIN tidak hilang saat server mati; pesan galat tetap muncul.
- Tidak ada klik tambahan setelah login berhasil.
- Show/hide PIN dapat dioperasikan dengan keyboard dan tidak membocorkan PIN
  ke log.

### Task 7: Tabel responsif, Laporan, dan Riwayat

**Files:**
- Modify: `src/tabel.js`, `src/style.css`, `src/views/laporan.js`,
  `src/views/riwayat.js`
- Test: `src/tabel.test.js`, `src/laporan-csv.test.js` (regresi)

**Steps:**

- [ ] Tambahkan mode responsif pada `tabel()`: wrapper `role="region"`,
  `tabindex="0"`, `aria-label`, dan kelas `tabel-responsif`. Di bawah 768 px,
  tabel berubah menjadi kartu bertumpuk dengan label `data-label` per sel.
  `thead` disembunyikan secara visual dengan pola `sr-only`, bukan
  `display:none`, agar semantik tabel dan nama kolom tetap terbaca pembaca
  layar. `caption` tetap ada.
- [ ] Untuk tabel dengan kolom banyak, sediakan renderer kartu khusus:
  - Laporan: kartu per magang berisi nama, NIP, shift, hadir, telat, izin,
    alpha, dan tombol “Lihat rincian”.
  - Riwayat: kartu per hari berisi tanggal, status, masuk/pulang, terlambat,
    dan lokasi ringkas.
- [ ] Perbaiki `laporan.js:152`: `${u.telat_menit} m` menjadi
  `${u.telat_menit} menit`.
- [ ] Tampilkan pecahan izin/cuti/sakit sebagai teks kecil atau `aria-label`,
  bukan hanya `title` tooltip.
- [ ] Tambahkan pencarian di rekap (nama/NIP/divisi) yang menyaring baris tanpa
  kehilangan fokus; perbarui jumlah yang terlihat.
- [ ] Saat galat rincian, pertahankan header, tombol “Kembali ke rekap”, dan
  pemilih bulan; sertakan “Coba lagi”.
- [ ] Saat ganti bulan di Riwayat, kosongkan KPI dan tampilkan skeleton sampai
  data baru datang.
- [ ] Samakan grid KPI menjadi `sm:grid-cols-2 lg:grid-cols-4` di semua layar.
- [ ] Simpan bulan aktif di query hash (`#/laporan?bulan=YYYY-MM`,
  `#/riwayat?bulan=YYYY-MM`) agar refresh tidak kembali ke bulan berjalan.

**Acceptance:**

- Di 360 px tidak ada scroll horizontal untuk Laporan/Riwayat; semua aksi
  terlihat.
- Angka telat di rekap berbunyi “menit”.
- Pindah bulan tidak menampilkan KPI bulan sebelumnya.
- Galat rincian tidak membuat admin kehilangan jalan kembali.
- `npm test` lulus, termasuk tes CSV yang sudah ada.

### Task 8: Beranda

**Files:**
- Modify: `src/views/beranda.js`

**Steps:**

- [ ] Ganti teks “Memuat data kehadiran…” dengan skeleton kartu KPI dan daftar.
- [ ] Tambahkan tombol “Hari ini” di samping panah tanggal dan date picker
  untuk melompat ke tanggal tertentu; batasi tanggal masa depan.
- [ ] Tambahkan “Coba lagi” pada galat dan pastikan handler `[data-ulang]`
  terpasang. Hapus handler mati di `:385`.
- [ ] Ganti ikon centang hijau pada keadaan “Belum ada anak magang” dengan ikon
  netral dan CTA ke `#/magang`.
- [ ] Batasi daftar “Terlambat”, “Belum absen”, dan “Aktivitas terbaru” menjadi
  5–6 baris dengan tombol “Tampilkan semua”/“Ringkas” agar dashboard tidak
  memanjang tanpa batas.
- [ ] Samakan grid KPI menjadi `lg:grid-cols-4`; kecilkan padding kartu di
  mobile.
- [ ] Pastikan angka KPI tetap dianimasikan hanya setelah data benar-benar
  tampil dan tidak berkedip saat pindah tanggal.

**Acceptance:**

- Loading menyerupai layout akhir, bukan area kosong.
- Admin bisa kembali ke hari ini atau memilih tanggal tanpa menekan panah
  berkali-kali.
- Keadaan kosong tidak memakai ikon sukses.
- Daftar panjang tidak membuat halaman sangat panjang di 360 px.

### Task 9: Data master

**Files:**
- Modify: `src/views/magang.js`, `src/views/lokasi.js`,
  `src/views/shift.js`, `src/views/hari-libur.js`, `src/ui.js`,
  `src/tabel.js`

**Steps:**

- [ ] Tambahkan validasi umum di `dialogFormulir`: hormati `min`, `max`,
  `step`, dan `pola`; tampilkan pesan di dekat kolom; jangan menutup dialog
  saat validasi gagal. Tambahkan callback `validasi` untuk aturan layar.
- [ ] Validasi PIN magang 4–6 digit di klien (sama dengan kiosk); NIP
  dinormalisasi uppercase; email memakai `type=email` yang sudah ada.
- [ ] Tambahkan placeholder “Pilih shift…”/“Pilih lokasi…” dan jadikan wajib;
  jangan memilih otomatis tanpa keputusan admin.
- [ ] Jadikan footer aksi dialog sticky di dasar saat isi panjang; pastikan
  tombol Simpan selalu terlihat.
- [ ] `magang.js`: ubah NIK `text-faint` menjadi `text-muted`; tambahkan
  aria-label kontekstual pada tombol Ubah/Nonaktifkan; toast setelah simpan/
  status berubah; fokus kembali ke baris yang diubah.
- [ ] `lokasi.js`: validasi lintang −90..90 dan bujur −180..180 di klien;
  konfirmasi saat mengubah status menjadi nonaktif; toast; opsi “Pakai lokasi
  saat ini” memakai `ambilLokasi()` (P2, jangan blokir task ini).
- [ ] `shift.js`: sembunyikan atau nonaktifkan Hapus bila `jumlah_magang > 0`;
  tampilkan alasan dan arahkan ke Nonaktifkan.
- [ ] `hari-libur.js`: label/aria pencarian; tabel responsif; toast; opsi
  rentang tanggal (P2).
- [ ] Tambahkan CTA “Tambah …” di keadaan kosong pertama kali, bukan hanya di
  kepala kartu.

**Acceptance:**

- Admin tidak bisa menyimpan PIN berisi huruf, koordinat di luar rentang, atau
  tanggal yang tidak valid.
- Shift yang masih dipakai tidak menampilkan tombol Hapus.
- Setiap simpan/ubah menampilkan umpan balik tanpa reload senyap.
- Formulir panjang tetap bisa disimpan di layar 360×640.

### Task 10: Izin dan Persetujuan Izin

**Files:**
- Modify: `src/views/izin.js`, `src/views/izin-masuk.js`, `src/ui.js`

**Steps:**

- [ ] `izin.js`: beri `role="progressbar"`, `aria-valuemin/max/now`, dan label
  pada bar kuota; tampilkan `—` (bukan 0) saat data gagal dimuat; jangan
  menggambar bar 0% seolah data valid.
- [ ] Tampilkan “Menunggu” pada bar sebagai segmen bergaris atau catatan visual
  yang jelas, sehingga kalimat “menunggu tetap dihitung” tercermin di layar.
- [ ] Validasi tanggal: `mulai` minimal hari ini, `selesai` minimal `mulai`;
  tampilkan pesan di dialog sebelum dikirim.
- [ ] Ganti dialog “Pengajuan terkirim” di `izin.js` dengan toast setelah
  daftar dimuat ulang; pertahankan pesan yang menjelaskan bahwa pengajuan
  menunggu keputusan.
- [ ] `izin-masuk.js`: gunakan token urutan permintaan. Hanya gambar respons
  jika `status` tab masih sama dengan saat permintaan dimulai. Ini mencegah
  respons tab lama menimpa tab baru.
- [ ] Ubah tab menjadi `role="tablist"`, `role="tab"`, `aria-selected`,
  `aria-controls`; dukung panah kiri/kanan dan Home/End.
- [ ] Tambahkan toast setelah setujui/tolak; fokus kembali ke tab/daftar yang
  aktif.
- [ ] Tambahkan aria-label kontekstual pada Setujui/Tolak (“Setujui izin Budi,
  22–24 Okt”).
- [ ] Gunakan kartu mobile dengan aksi di bagian atas kartu agar tidak berada di
  ujung scroll horizontal.

**Acceptance:**

- Berpindah tab cepat tidak pernah menampilkan tombol aksi untuk baris dari tab
  lain.
- Tab dapat dioperasikan dengan keyboard dan status aktif terbaca.
- Tanggal yang tidak valid ditolak sebelum request.
- Bar kuota tidak menyesatkan saat galat atau saat ada pengajuan menunggu.

### Task 11: Audit dan Anomali

**Files:**
- Modify: `src/views/audit.js`, `src/views/anomali.js`, `src/tabel.js`

**Steps:**

- [ ] Buat peta label aksi audit: `absen_masuk`, `absen_pulang`, `tambah_magang`,
  `ubah_magang`, `reset_pin`, `tambah_lokasi`, `ubah_lokasi`, `tambah_shift`,
  `ubah_shift`, `hapus_shift`, `tambah_hari_libur`, `ubah_hari_libur`,
  `hapus_hari_libur`, `setujui_izin`, `tolak_izin`. Fallback: ganti `_` dengan
  spasi dan kapitalkan.
- [ ] Ganti sel “Rincian” JSON mentah dengan ringkasan kunci-nilai yang ramah.
  Nilai panjang/nested memakai `<details>` “Lihat detail”; boolean menjadi
  “Ya/Tidak”; `akurasi`/`jarak_m` memakai satuan; `null` menjadi “—”.
- [ ] Tambahkan `datalist` aksi pada filter dan validasi `dari <= sampai`.
  Tampilkan pesan inline jika rentang terbalik; jangan memanggil API.
- [ ] Setelah paginasi, gulir/fokus ke judul tabel dan umumkan jumlah catatan
  lewat `aria-live`.
- [ ] Tambahkan “Coba lagi” pada galat audit/anomali.
- [ ] Anomali: pisahkan kolom “Tingkat” dan “Jenis”; tampilkan teks
  Tinggi/Sedang/Rendah beserta ikon, bukan hanya warna. Tambahkan filter jenis
  dan tingkat, serta jumlah hasil.
- [ ] Gunakan kartu mobile untuk kedua layar; detail audit dapat dibuka sebagai
  `<details>`/sheet tanpa kehilangan konteks.

**Acceptance:**

- Tidak ada JSON mentah di layar audit.
- Tingkat anomali terbaca tanpa melihat warna.
- Rentang tanggal terbalik tidak mengirim request.
- Paginasi tidak meninggalkan pengguna di bawah halaman.
- Semua aksi yang dikenal tampil dalam bahasa manusia.

### Task 12: Motion, performa, dan aset

**Files:**
- Modify: `src/animasi.js`, `src/main.js`, `src/style.css`, `index.html`,
  `src/views/beranda.js`, `src/views/audit.js`, `src/views/anomali.js`,
  `src/views/absen.js`

**Steps:**

- [ ] `animasiHalaman`: hentikan `kontrolHalaman` sebelum guard
  `kurangiGerak()`.
- [ ] `beruntun`: batasi jumlah elemen yang dianimasikan (maksimal 8–10) dan
  total delay; sisanya tampil langsung.
- [ ] Impor `animasi.js` secara dinamis di `main.js` setelah mount, atau
  pisahkan `animasiHalaman` ke chunk sendiri, sehingga Motion tidak masuk
  bundle awal.
- [ ] Lacak animasi kiosk dengan `panggung()` dan hentikan saat layar kembali
  ke awal/unmount.
- [ ] Ganti spinner yang dibekukan reduced-motion dengan teks status statis;
  pastikan `aria-busy` tetap ada.
- [ ] Hapus `<link>` Google Fonts di `index.html:9-16`; gunakan font sistem.
  Jika brand tetap membutuhkan Inter, host sendiri WOFF2 dan muat dengan
  `font-display: swap` (keputusan P2).
- [ ] Tambahkan `width`/`height` dan `decoding="async"` pada avatar; jangan
  memakai `loading="lazy"` untuk avatar di atas lipatan.
- [ ] Ukur ulang tinggi kanvas latar dan blur; jika perangkat rendah masih
  tersendat, turunkan resolusi maksimum kanvas sebelum mengubah warna.

**Acceptance:**

- Dengan reduced motion, tidak ada animasi yang tersisa dan tidak ada spinner
  statis yang membingungkan.
- Bundle awal tidak lagi memuat Motion; cek dengan `npm run build` dan analisis
  ukuran chunk.
- Daftar 50 baris tidak memudar lebih dari ~300 ms.
- Kiosk tidak meminta font dari internet.

### Task 13: Verifikasi akhir dan dokumentasi hasil

**Files:**
- Modify: `docs/superpowers/plans/2026-10-29-audit-poles-frontend.md`
  (centang hasil), `docs/README.md` hanya bila status milestone berubah
- Test: seluruh tes frontend, skrip kontras, build, dan uji browser

**Steps:**

- [ ] Jalankan `npm test`, `npm run periksa:kontras`, dan `npm run build`.
- [ ] Jalankan backend dengan `VITE_USE_MOCK=false`; uji login admin/magang,
  kiosk, dan seluruh rute pada 360×640, 390×844, 768×1024, 1024×768,
  1440×900.
- [ ] Uji keadaan: data kosong, server mati, jaringan lambat, 50+ baris,
  teks panjang, `dari > sampai`, dan respons tab yang datang terlambat.
- [ ] Uji keyboard: Tab dari awal, skip-link, menu mobile, dialog, radio kiosk,
  tabel yang bisa digulir, dan paginasi.
- [ ] Uji `prefers-reduced-motion: reduce` di DevTools.
- [ ] Uji kamera ditolak, kamera tidak ditemukan, GPS ditolak, GPS tanpa
  layanan, dan GPS sukses.
- [ ] Catat bukti (perintah, rute, viewport) di bagian hasil rencana. Jangan
  menulis PIN, token, atau data pribadi ke dokumen.
- [ ] Perbarui `docs/README.md` hanya jika ada milestone yang benar-benar
  berubah status.
- [ ] Pastikan tidak ada lagi `rounded-[1.75rem]`/`rounded-[1.5rem]` yang
  tersisa di `src/` dan tidak ada teks sekunder yang memakai `text-faint`.

**Acceptance:**

- Semua perintah verifikasi lulus.
- Tidak ada regresi pada 22 tes frontend yang sudah ada (atau jumlah terbaru).
- Tidak ada scroll horizontal yang tidak disengaja pada 360 px.
- Tidak ada tombol utama yang tidak terlihat tanpa scroll pada kiosk 360×640.
- Bukti uji browser dicatat dan dapat diulang.

## 5. Urutan pengerjaan dan dependensi

1. Task 1–3 (fondasi) harus selesai lebih dulu; task layar memakai komponen
   dan token dari sini.
2. Task 4 (shell) dapat dikerjakan paralel dengan Task 5 setelah Task 2.
3. Task 5 (kiosk) dan Task 10 (persetujuan izin) adalah P0; jangan menunda ke
   akhir.
4. Task 6–11 mengikuti Task 3 karena memakai `skeleton`, `galat`, dan `toast`.
5. Task 12 (motion/performa) dikerjakan setelah layar stabil agar pengukuran
   tidak terpengaruh perubahan layout.
6. Task 13 terakhir; satu task = satu commit hanya setelah disetujui.

## 6. Matriks verifikasi

| Area | 360×640 | 768×1024 | 1024×768 | 1440×900 | Keyboard | Reduced motion |
|---|---|---|---|---|---|---|
| Masuk | wajib | wajib | wajib | wajib | wajib | wajib |
| Kiosk | wajib | wajib | wajib | wajib | wajib | wajib |
| Beranda | wajib | wajib | wajib | wajib | wajib | wajib |
| Data master (4 layar) | wajib | wajib | wajib | wajib | wajib | opsional |
| Izin & Persetujuan | wajib | wajib | wajib | wajib | wajib | opsional |
| Riwayat & Laporan | wajib | wajib | wajib | wajib | wajib | opsional |
| Audit & Anomali | wajib | wajib | wajib | wajib | wajib | opsional |

**Uji manual wajib:**

- Login admin dan magang dengan backend asli.
- Kiosk: sukses, PIN salah, kamera ditolak, GPS gagal, mode luar tanpa
  koordinat, dan kirim ulang setelah jaringan putus.
- Tabel: 50+ baris, pencarian, paginasi, dan teks panjang.
- Dialog: Esc, klik backdrop, validasi gagal, dan fokus kembali.
- Menu mobile: buka/tutup, pilih item, dan tombol Keluar.

**Di luar cakupan yang bisa diuji otomatis:** kamera/GPS fisik, Safari iOS,
pembaca layar nyata, dan perangkat kiosk kelas rendah. Catat sebagai uji
manual, bukan klaim otomatis.

## 7. Risiko dan keputusan

| Risiko | Mitigasi |
|---|---|
| Permukaan 92% membuat efek kaca berkurang. | Kaca tetap di chrome/dialog; kartu memakai permukaan pekat demi kontras dan performa. Verifikasi visual di semua viewport sebelum mengunci. |
| Pabrik tombol dan state baru menambah perubahan besar. | Terapkan bertahap per layar; jangan mengubah alur data. Setiap task harus lulus tes dan build. |
| Kartu mobile menggandakan markup tabel. | Gunakan `tabel()` dengan renderer kartu opsional agar data dan keadaan kosong tetap satu sumber. |
| Motion dinamis mempersulit pemuatan awal. | Impor setelah mount; sediakan fallback tanpa animasi. |
| Perbaikan kontras mengubah tampilan yang sudah disetujui. | Simpan tangkapan layar sebelum/sesudah; minta persetujuan pemilik sebelum commit visual besar. |
| Uji kiosk membutuhkan kamera/GPS asli. | Uji otomatis memakai simulasi; uji perangkat nyata dicatat terpisah dan tidak diklaim lulus bila belum dilakukan. |

## 8. Definition of done

- Seluruh layar di `src/menu.js` dan `src/views/*.js` tercakup; tidak ada rute
  yang terlewat.
- Tidak ada teks sekunder yang gagal 4,5:1 pada permukaan yang dipakai.
- Semua kontrol interaktif memiliki fokus terlihat dan target sentuh memadai.
- Navigasi mobile tidak terpotong dan seluruh menu dapat dijangkau.
- Kiosk dapat dibatalkan, diulang, dan tidak kehilangan kredensial saat kamera
  gagal.
- Tabel dapat dibaca di 360 px tanpa scroll horizontal yang tidak disengaja.
- Setiap layar punya keadaan memuat, kosong, galat, dan sukses yang jelas.
- Tidak ada JSON mentah di layar audit dan tidak ada status yang hanya
  dibedakan warna.
- `npm test`, `npm run periksa:kontras`, dan `npm run build` lulus.
- Bukti uji browser dicatat; keterbatasan perangkat nyata disebutkan.
