# PRD — Aplikasi Absen Magang

| | |
|---|---|
| Versi | 1.0 |
| Tanggal | 28 Oktober 2026 |
| Status | Frontend selesai; backend Fase 2 berjalan; belum siap produksi |
| Acuan | `KONTRAK-API.md`, `PANDUAN-BACKEND-V2.md`, kode di `src/` dan `backend/` |

## 1. Ringkasan

Aplikasi web absensi untuk anak magang berbasis **kiosk**. Magang mencatat
kehadiran di PC kiosk memakai NIP + PIN, selfie, dan lokasi. Admin memantau
kehadiran harian, mengelola data master, memutuskan pengajuan izin/cuti, dan
mengunduh rekap bulanan.

Ada dua peran pengguna, `admin` dan `magang`, plus satu pintu publik untuk
perangkat kiosk. Kiosk sengaja tidak memakai sesi admin: PC dipakai bergantian,
dan token admin yang tertinggal di `localStorage` jauh lebih berbahaya daripada
kiosk terbuka. Pembatasan kiosk dilakukan di server lewat identitas perangkat,
PIN, dan rate limit.

## 2. Latar belakang

- Absensi manual membuat rekap bulanan lambat dan rawan salah jumlah.
- Kehadiran perlu bukti waktu, lokasi, dan foto, bukan hanya centang di kertas.
- Jatah cuti harus dihitung dalam hari kerja dan mengurangi pengajuan yang masih
  menunggu, supaya sisa cuti bisa dipercaya.
- Admin perlu satu layar untuk melihat siapa yang sudah masuk, terlambat, belum
  masuk, dan sedang izin.
- Data absen dan foto bersifat pribadi; akses serta penyimpanannya harus diatur,
  bukan sekadar ditempel di folder publik.

## 3. Tujuan produk

| ID | Tujuan |
|---|---|
| G1 | Mengganti absensi manual dengan satu sumber data kehadiran yang bisa diaudit. |
| G2 | Memberi bukti selfie dan lokasi pada setiap absen tanpa memperlambat antrean kiosk. |
| G3 | Memangkas waktu admin membuat rekap bulanan dan memeriksa keterlambatan. |
| G4 | Membuat pengajuan izin/cuti dan keputusannya tercatat, dengan sisa jatah yang bisa dihitung ulang. |
| G5 | Menjaga PIN, token, dan foto tetap privat, termasuk di PC kiosk yang dipakai bersama. |

## 4. Di luar lingkup

Daftar ini sengaja tidak dikerjakan. Menambahkannya berarti keputusan produk
baru dan perubahan kontrak API lebih dulu.

- Ganti PIN sendiri oleh magang, atau lupa PIN lewat email/WhatsApp.
- Edit atau hapus absen manual dari layar admin.
- Absen lewat HP pribadi tanpa perangkat kiosk terdaftar.
- Satu perangkat kiosk melayani banyak cabang sekaligus.
- Notifikasi, pengingat, atau integrasi kalender.
- Aplikasi Android/iOS native.
- Dashboard realtime berbasis websocket.
- Microservices, queue worker terpisah, atau object storage eksternal.
- Fitur di luar `KONTRAK-API.md`.

## 5. Pengguna dan peran

| Peran | Kebutuhan utama | Akses |
|---|---|---|
| **Admin** | Melihat kondisi harian, mengelola data master, memutuskan izin, membuat rekap. | Seluruh menu admin. |
| **Magang** | Melihat riwayat absen sendiri dan mengajukan izin/cuti. | Riwayat Absen, Izin & Cuti. |
| **Kiosk** | Mencatat absen masuk/pulang tanpa login. | Rute `#/absen` bersifat publik; tidak membuat sesi pengguna. |

Admin tidak memiliki layar profil sendiri. Magang juga tidak: seluruh kolom
profilnya diatur admin. Sesi yang tersimpan disegarkan lewat
`GET /saya/profil` setiap aplikasi dibuka.

## 6. Alur utama

1. **Masuk admin** — NIP + PIN di `#/masuk`; berhasil diarahkan ke Beranda.
2. **Absen di kiosk** — buka `#/absen`; lokasi mengikuti perangkat (atau
   `#/absen?lokasi=<id>` saat perangkat pertama terikat), lalu masukkan NIP +
   PIN, pilih `kantor` atau `luar`, ambil selfie, dan kirim. Server yang
   menentukan ini absen masuk atau pulang.
3. **Izin/cuti** — magang membuka Izin & Cuti, melihat sisa jatah, mengajukan
   rentang tanggal dan alasan. Admin membuka Persetujuan Izin, menyetujui atau
   menolak dengan catatan.
4. **Rekap** — admin membuka Rekap & Laporan, memilih bulan, melihat ringkasan
   dan rincian per orang, lalu mengunduh CSV bila perlu.
5. **Keluar** — tombol Keluar memanggil `POST /keluar`, menghapus token di
   server, lalu membersihkan sesi lokal.

## 7. Kebutuhan fungsional

### 7.1 Autentikasi dan sesi

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| AUTH-01 | Masuk memakai NIP + PIN. | PIN tidak pernah dikembalikan API; pesan gagal tidak membedakan NIP salah dan PIN salah; percobaan dibatasi server. |
| AUTH-02 | Sesi bertahan setelah halaman dimuat ulang dan divalidasi ulang saat aplikasi dibuka. | `GET /saya/profil` dipanggil sekali saat mulai; `401`/akun nonaktif menghapus sesi; kegagalan jaringan tidak mengeluarkan pengguna. |
| AUTH-03 | Menu dan rute mengikuti peran. | Admin melihat menu admin; magang hanya melihat Riwayat dan Izin; rute milik peran lain mengalihkan ke halaman pertama peran tersebut. |
| AUTH-04 | Keluar mencabut token dan membersihkan sesi lokal. | `POST /keluar` dipanggil; token lama ditolak; `localStorage` tidak menyisakan sesi. |
| AUTH-05 | Kiosk dapat dibuka tanpa sesi. | `#/absen` tidak membutuhkan login dan tidak membuat sesi baru. |

### 7.2 Kiosk absen

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| KIOSK-01 | Kiosk memakai identitas perangkat yang terdaftar. | ID perangkat dibuat sekali dan disimpan di `localStorage`; server menolak perangkat asing. |
| KIOSK-02 | Absen memakai NIP + PIN dan mengirim mode `kantor` atau `luar`. | Server menentukan jenis absen (masuk/pulang) dan menolak absen ketiga pada hari yang sama. |
| KIOSK-03 | Lokasi mengikuti perangkat atau URL saat pendaftaran. | `GET /kiosk/lokasi` mengirim lokasi aktif; `#/absen?lokasi=<id>` menentukan lokasi saat perangkat pertama terikat; setelah itu URL tidak memindahkan kiosk; lokasi nonaktif ditolak. |
| KIOSK-04 | Mode `luar` wajib membawa koordinat dan akurasi yang memadai. | Tanpa GPS tidak boleh dikirim; akurasi di atas 150 m ditolak; akurasi di atas 50 m ditandai meragukan. |
| KIOSK-05 | Selfie diambil otomatis setelah hitung mundur. | Tidak ada pratinjau atau ambil ulang sebelum kirim; hasil foto tampil di layar konfirmasi. Izin kamera yang gagal diberi pesan yang bisa ditindaklanjuti. |
| KIOSK-06 | Kiosk kembali siap untuk orang berikutnya. | Layar hasil bertahan 7 detik; kolom dikosongkan setelah 45 detik tanpa ketikan; kamera dan timer dibersihkan saat layar ditinggalkan. |
| KIOSK-07 | Kiosk terbaca dari jarak berdiri. | Kolom dan tombol besar, jam berjalan, fokus otomatis ke NIP, dan pesan galat jelas. |

### 7.3 Dashboard admin

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| DASH-01 | Ringkasan harian: total, sudah masuk, belum masuk, izin, terlambat. | Angka berasal dari satu panggilan `GET /admin/dashboard`. |
| DASH-02 | Navigasi tanggal dan penanda hari libur. | Bisa mundur ke tanggal sebelumnya; tidak bisa melewati hari ini; hari libur diberi keterangan. |
| DASH-03 | Daftar terlambat, belum masuk, dan aktivitas terbaru. | Terlambat menampilkan menit keterlambatan; aktivitas menampilkan enam catatan terakhir pada tanggal itu. |
| DASH-04 | Rincian lokasi dan foto. | Koordinat, akurasi, jarak, dan tautan peta tersedia; foto diambil lewat URL bertanda tangan. |

### 7.4 Data master

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| MASTER-01 | Akun magang/admin: daftar, cari, tambah, ubah, aktif/nonaktif, reset PIN. | Pencarian di browser; PIN hanya bisa diisi baru, tidak pernah ditampilkan; tidak ada hapus; divisi berasal dari daftar server; admin tidak bisa menurunkan peran sendiri. |
| MASTER-02 | Lokasi kantor: daftar, tambah, ubah, aktif/nonaktif. | Tidak ada hapus; lokasi nonaktif tidak bisa dipakai di kiosk. |
| MASTER-03 | Shift kerja: daftar, tambah, ubah, hapus, aktif/nonaktif. | Shift malam sah; hapus ditolak kalau shift terakhir atau masih dipakai magang/baris absen. |
| MASTER-04 | Hari libur: daftar, cari, tambah, ubah, hapus. | Tanggal unik; Sabtu/Minggu tidak perlu didaftarkan; perubahan langsung memengaruhi hari kerja. |
| MASTER-05 | Seluruh endpoint data master hanya untuk admin dan `PUT` bersifat menambal. | Selain admin mendapat `403`; kolom yang tidak dikirim tidak berubah. |

### 7.5 Izin dan cuti

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| IZIN-01 | Magang melihat jatah, terpakai, menunggu, dan sisa cuti. | `sisa = jatah - terpakai - menunggu`; hanya `cuti` yang memotong jatah. |
| IZIN-02 | Magang mengajukan `cuti`, `izin`, atau `sakit`. | Rentang tanggal valid, alasan minimal 4 karakter, memuat minimal satu hari kerja, tidak tumpang tindih, tidak bentrok absen, dan tidak seluruhnya lewat. |
| IZIN-03 | Admin melihat pengajuan per status beserta jumlah semua status. | Tab Menunggu/Disetujui/Ditolak/Semua; jumlah dihitung server; nama dan divisi diambil dari tabel pengguna. |
| IZIN-04 | Admin menyetujui atau menolak. | Penolakan wajib catatan; persetujuan memeriksa ulang jatah dan tumpang tindih; keputusan dicatat di audit. |
| IZIN-05 | Izin yang disetujui muncul di riwayat dan laporan. | Status harian menjadi `izin`/`cuti`/`sakit` hanya kalau tidak ada absen masuk; prioritas status tidak berubah. |

### 7.6 Riwayat magang

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| RIWAYAT-01 | Riwayat menampilkan seluruh hari dalam satu bulan. | Sabtu, Minggu, dan hari libur tetap tampil; urutan tanggal menaik; bentuk baris sama dengan rincian laporan admin. |
| RIWAYAT-02 | Ringkasan bulanan: hadir, terlambat, izin/cuti, tanpa catatan. | `telat_menit` dibaca dari baris absen, bukan dihitung ulang dari shift saat ini. |
| RIWAYAT-03 | Navigasi bulan dibatasi masa kerja. | Tidak bisa mundur sebelum `masuk_kerja`; tidak bisa maju melewati bulan berjalan. |

### 7.7 Rekap dan laporan

| ID | Kebutuhan | Kriteria terima |
|---|---|---|
| LAPORAN-01 | Rekap bulanan semua magang. | Hadir, terlambat, menit terlambat, izin/cuti/sakit (data terpisah; layar merangkumnya dengan rincian), alpha, dinas luar, dan luar akurasi kasar. |
| LAPORAN-02 | Rincian harian satu magang. | Bentuk data sama persis dengan `GET /saya/absen`. |
| LAPORAN-03 | Ekspor CSV di browser. | Pemisah titik koma, BOM UTF-8, sel yang diawali `=`, `+`, `-`, atau `@` diamankan dari eksekusi rumus. |
| LAPORAN-04 | Rincian lokasi dan foto pada layar. | Koordinat, akurasi, jarak, tautan peta, dan foto bertanda tangan; tidak ada tuduhan otomatis dari GPS. |
| LAPORAN-05 | Pemilih bulan. | Maksimal 24 bulan ke belakang; data tetap berasal dari server. |

## 8. Aturan bisnis

| Aturan | Ketentuan |
|---|---|
| Status harian | `tepat`, `telat`, `izin`, `cuti`, `sakit`, `alpha`, `libur`, `belum`. |
| Prioritas status | `libur` > `tepat`/`telat` > `izin`/`cuti`/`sakit` > `belum` > `alpha`. Absen masuk mengalahkan izin pada hari yang sama. |
| Alpha | Hari kerja tanpa absen masuk dan tanpa izin/cuti/sakit yang disetujui. |
| Hari kerja | Senin–Jumat, dikurangi tanggal di hari libur. Sabtu dan Minggu libur dengan sendirinya. |
| Jatah cuti | Dihitung dalam hari kerja; hanya `cuti` yang memotong; pengajuan `menunggu` ikut dihitung. |
| Keterlambatan | Dihitung sekali saat absen dan disimpan di baris absen. Mengubah shift tidak mengubah catatan lama. |
| Magang nonaktif | Tetap muncul di laporan bulan yang memiliki catatannya, ditandai nonaktif. |
| Akun admin | Tidak muncul di dashboard/laporan kecuali punya catatan pada periode itu. |
| Hapus data | Magang dan lokasi tidak dihapus, hanya dinonaktifkan. Hari libur selalu boleh dihapus. Shift hanya boleh dihapus kalau tidak dipakai dan bukan shift terakhir. |
| Waktu | Semua tanggal dan jam memakai `Asia/Jakarta`. Server pemilik waktu absen, bukan jam perangkat. |
| Foto | Disimpan privat; akses lewat signed URL berumur 10 menit; foto dihapus setelah 180 hari, baris absen tetap ada. |
| Ekspor | CSV disusun di browser; backend tidak menyediakan endpoint ekspor. |

## 9. Kebutuhan non-fungsional

### 9.1 Keamanan dan privasi

- HTTPS wajib; kamera dan geolocation browser hanya berjalan di secure
  context.
- PIN disimpan sebagai hash Argon2id dan tidak pernah dikembalikan API, ditulis
  ke audit, atau disimpan di `localStorage`.
- Token bearer 32 byte acak, disimpan server sebagai SHA-256, berlaku 12 jam,
  dan dicabut saat keluar.
- Rate limit login dan kiosk: 5 percobaan gagal per NIP + IP per 60 detik;
  kiosk juga dibatasi per `kiosk_id`.
- Foto hanya di disk privat, disajikan lewat signed URL 10 menit dengan validasi
  prefix path.
- Header CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, dan
  HSTS dipasang di server.
- Build produksi tidak boleh membawa mode tiruan, akun demo, atau kunci mock.
  `npm run build` memeriksa `dist`.
- Audit log mencatat perubahan penting. PIN, token, dan foto tidak boleh masuk
  log.
- Foto selfie disimpan 180 hari, baris absen 5 tahun, dan audit 2 tahun.
  Kebijakan lengkap ada di `docs/KEBIJAKAN-PRODUKSI.md`.

### 9.2 Waktu

- Zona waktu tunggal `Asia/Jakarta`; UI memformat `YYYY-MM-DD` dan jam lokal.
- Dashboard, laporan, dan perhitungan hari kerja memakai tanggal kantor, bukan
  tanggal perangkat.
- Server menetapkan waktu absen; jam kiosk hanya tampilan.
- Server produksi wajib memakai NTP.

### 9.3 Kinerja dan skala

- Sasaran awal: puluhan magang (sekitar 50) per bulan, bukan ribuan.
- Daftar magang, lokasi, shift, dan hari libur dikirim tanpa pagination;
  penyaringan nama dilakukan di browser.
- Laporan bulanan dihitung saat permintaan; belum perlu cache.
- Layar dimuat secara lazy; muat awal hanya membawa kerangka, bukan semua view.
- Target respons: absen selesai < 3 detik di jaringan kantor (di luar waktu
  ambil foto); laporan 50 orang < 2 detik.
- Kalau jumlah magang menjadi ratusan, pagination dan cache laporan ditambahkan
  di backend lebih dulu, bukan di layar.

### 9.4 Aksesibilitas dan responsif

- Setiap input punya label; galat ditampilkan dengan `role="alert"`.
- Navigasi keyboard dan `:focus-visible` tersedia; dialog mengembalikan fokus.
- Animasi mengikuti `prefers-reduced-motion`.
- Kiosk dapat dipakai di layar sentuh maupun keyboard.
- Tampilan admin responsif dari ponsel sampai desktop; tabel lebar boleh
  menggulir horizontal.
- Kontras teks dan status harus tetap terbaca, termasuk lencana status.

### 9.5 Kompatibilitas dan operasional

- Browser modern (Chromium, Firefox, Safari) dengan ES modules, `fetch`,
  `crypto`, kamera, dan geolocation.
- Kamera wajib HTTPS atau `localhost`.
- Deployment: `dist` statis di Nginx, `/api` diteruskan ke Laravel, foto di disk
  privat.
- Backend: Laravel 13 / PHP 8.3+, MariaDB 10.11 di produksi, SQLite untuk lokal,
  Redis opsional.
- Belum ada CI otomatis atau tes frontend; pengujian masih manual dan lewat
  `npm run build`.

## 10. Arsitektur dan dependensi

### 10.1 Alur data

```text
View (src/views/*.js)
  -> src/api.js  (satu-satunya pintu fetch)
     -> mode tiruan (DEV saja)  -> src/mock.js -> src/data-tiruan.js
     -> backend asli            -> /api/*      -> Laravel
```

Semua view memakai `api.get/post/put/del`. Tidak ada `fetch` langsung di view.
Saat development, proxy Vite meneruskan `/api` ke `http://127.0.0.1:8000`.

### 10.2 Peta berkas penting

| Berkas | Peran |
|---|---|
| `src/main.js` | Router hash, pemuatan lazy, penjagaan peran, penyegaran sesi. |
| `src/menu.js` | Satu sumber daftar menu, rute, dan hak akses. |
| `src/api.js` | Fetch, token, penanganan `401`, sesi, ID perangkat, mode tiruan. |
| `src/mock.js` | Tiruan seluruh endpoint dan aturan bisnis; hanya hidup di DEV. |
| `src/data-tiruan.js` | Seed data demo; data pengguna/absen/izin sengaja kosong. |
| `src/views/` | Satu berkas per layar. |
| `src/kerangka.js` | Sidebar, bilah atas, tombol keluar. |
| `src/ui.js`, `src/tabel.js` | Dialog, toast, format tanggal, tabel, lencana, kartu. |
| `src/kamera.js`, `src/lokasi.js` | Kamera selfie dan GPS. |
| `public/_headers` | CSP dan header keamanan untuk hosting statis. |
| `scripts/periksa-build.mjs` | Menolak sisa mode tiruan/akun demo di `dist`. |
| `backend/` | Laravel: API, tes, migrasi, deployment. |

### 10.3 Konfigurasi

| Variabel | Fungsi |
|---|---|
| `VITE_USE_MOCK` | `false` mematikan mode tiruan di development. Build produksi selalu memakai backend asli. |
| `VITE_API_BASE` | Alamat dasar API; default `/api`. |
| `ADMIN_NIP`, `ADMIN_PIN` | Hanya untuk seeder backend; tidak boleh dianggap kredensial produksi. |

## 11. Status implementasi

Legenda: **Selesai** berarti ada dan sudah dipakai; **Belum** berarti belum ada
di sisi tersebut; **n/a** berarti memang tidak diperlukan.

| Modul | Endpoint | Frontend | Backend |
|---|---|---|---|
| Sesi | `POST /masuk` | Selesai | Selesai |
| Sesi | `POST /keluar` | Selesai | Selesai |
| Sesi | `GET /saya/profil` | Selesai | Selesai |
| Dashboard | `GET /admin/dashboard` | Selesai | Selesai |
| Data master | `GET/POST /admin/magang`, `PUT /admin/magang/{id}` | Selesai | Selesai |
| Data master | `GET/POST /admin/lokasi`, `PUT /admin/lokasi/{id}` | Selesai | Selesai |
| Data master | `GET /admin/shift` | Selesai | Selesai |
| Data master | `POST/PUT/DELETE /admin/shift` | Selesai | **Belum** |
| Data master | `GET/POST/PUT/DELETE /admin/hari-libur` | Selesai | **Belum** |
| Kiosk | `GET /kiosk/lokasi` | Selesai | Selesai |
| Kiosk | `POST /kiosk/absen` | Selesai | Selesai |
| Foto | `GET /foto/{kode}` (signed URL) | Selesai | Selesai |
| Riwayat | `GET /saya/absen` | Selesai | **Belum** |
| Izin | `GET/POST /saya/izin` | Selesai | **Belum** |
| Izin | `GET /admin/izin` | Selesai | **Belum** |
| Izin | `POST /admin/izin/{id}/setujui`, `.../tolak` | Selesai | **Belum** |
| Laporan | `GET /admin/laporan` | Selesai | Selesai; kolom izin/cuti/sakit masih `0` sampai integrasi |
| Laporan | `GET /admin/laporan/harian` | Selesai | Selesai |
| Laporan | Ekspor CSV | Selesai | n/a |

Status per milestone dan rincian pekerjaan ada di `docs/milestones/`.

## 12. Risiko dan pertanyaan terbuka

| Risiko / pertanyaan | Dampak | Penanganan saat ini |
|---|---|---|
| Backend Fase 2 belum selesai. | Layar riwayat, izin, shift, dan hari libur gagal kalau mode tiruan dimatikan. | Kerjakan M5 sebelum rilis; mock hanya untuk development. |
| PIN 4–6 angka dipakai bersama di PC kiosk. | PIN bisa ditebak atau dipinjam orang lain. | Rate limit, device enrollment, selfie; IP kantor hanya penanda anomali sesuai kebijakan. |
| GPS bisa dipalsukan dan akurasi bergantung perangkat. | Bukti lokasi tidak absolut. | Batas 150 m, penanda `lokasi_meragukan`, jarak Haversine, dan foto; admin tetap menilai. |
| Foto dan data absen menumpuk. | Disk penuh; biaya backup naik. | Retensi foto 180 hari, audit 2 tahun; monitoring kapasitas dan backup di M6. |
| Belum ada tes frontend atau CI. | Regresi hanya ketahuan saat dicoba manual. | `npm run build` sebagai pagar minimum; tambahkan CI/uji E2E di M6. |
| Kontrak dan kode bisa melenceng. | Frontend dan backend menafsirkan response berbeda. | Kontrak adalah acuan; setiap perubahan bentuk response harus masuk kontrak lebih dulu. |
| `PANDUAN-PERBAIKAN.md` sebagian sudah usang. | Pekerjaan bisa diulang. | Beberapa item sudah selesai (mock DEV-only, `401`, CSP, sanitasi CSV, PIN tidak ditampilkan); audit ulang di M6. |

Pertanyaan yang sudah dijawab (lihat `docs/KEBIJAKAN-PRODUKSI.md`):

1. Kiosk boleh dipakai untuk dinas luar di lokasi mana pun. IP kantor hanya
   penanda anomali, bukan syarat absen.
2. Foto disimpan 180 hari, baris absen 5 tahun, audit 2 tahun. Akses foto hanya
   admin dan pemilik data.
3. Audit dibaca admin; tidak ada perubahan atau penghapusan lewat aplikasi.
4. Domain dan sertifikat HTTPS diisi saat pemasangan produksi; bukan keputusan
   kode.
5. Ekspor resmi hanya CSV. PDF dan tanda tangan tidak termasuk lingkup rilis.

Pertanyaan yang masih terbuka: nama domain produksi dan daftar kontak insiden.
Keduanya diisi di luar repo saat serah terima.

## 13. Metrik keberhasilan

Target berikut adalah usulan awal, bukan angka yang sudah terukur.

| Metrik | Target | Cara ukur |
|---|---|---|
| Kelengkapan absen | ≥ 95% hari kerja punya catatan masuk | Rekap bulanan: hadir + izin/cuti/sakit dibanding hari kerja. |
| Keberhasilan absen pertama | ≥ 95% percobaan valid berhasil tanpa bantuan admin | Log kiosk dan keluhan admin. |
| Waktu membuat rekap | < 5 menit per bulan | Waktu admin dari buka laporan sampai CSV terunduh. |
| Keputusan izin | ≤ 1 hari kerja | Selisih `diajukan` dan `diputuskan`. |
| Kebocoran PIN/foto | 0 insiden | Audit akses dan laporan insiden. |
| Error absen | < 1% dari percobaan valid | Log `POST /kiosk/absen`. |
| Waktu muat laporan | < 2 detik untuk 50 magang/bulan | Pengukuran di staging. |

## 14. Referensi

- `KONTRAK-API.md` — kontrak endpoint dan aturan response.
- `PANDUAN-BACKEND-V2.md` — sisa Fase 2 dan definisi selesai.
- `PANDUAN-PERBAIKAN.md` — catatan hardening; sebagian sudah usang.
- `backend/README.md` — endpoint backend yang tersedia dan catatan keamanan.
- `docs/README.md` — indeks dokumentasi dan arti status.
