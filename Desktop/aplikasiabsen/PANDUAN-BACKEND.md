# Panduan Backend — Aplikasi Absen

Hai. Ini panduan buat kamu yang mengerjakan sisi server.

Aku sudah selesai mengerjakan frontend-nya: **sembilan layar, semuanya sudah
jalan** di mode data tiruan. Jadi kamu tidak perlu menebak-nebak tampilannya
seperti apa — kamu bisa menjalankannya sendiri hari ini, sebelum menulis satu
baris backend pun. Tidak ada layar yang menunggu, dan tidak ada endpoint di
kontrak yang belum dipakai.

Berkas ini isinya **alur aplikasinya dan urutan pengerjaan yang aku sarankan**.
Bentuk persis permintaan dan balasan tiap endpoint ada di **`KONTRAK-API.md`** —
aku tidak menyalinnya ke sini supaya tidak ada dua versi yang bisa saling
bertentangan.

**Isi berkas ini:**

| Bagian | Untuk apa |
|---|---|
| [1. Pembagian kerja](#1-pembagian-kerja) | siapa mengerjakan apa, dan di mana frontend dan backend bertemu |
| [2. Menjalankan frontend](#2-menjalankan-frontend) | cara menjalankannya hari ini, tanpa backend |
| [3. Alur aplikasi](#3-alur-aplikasi) | sembilan layarnya, satu per satu, beserta endpoint yang dipakai |
| [4. Urutan pengerjaan](#4-urutan-pengerjaan-yang-aku-sarankan) | urutan yang aku sarankan, dari yang paling menentukan |
| [5. Hal yang paling sering bikin gagal](#5-hal-yang-paling-sering-bikin-gagal) | baca ini walaupun cuma satu bagian yang kamu baca |
| [6. Menguji tanpa menunggu frontend](#6-menguji-tanpa-menunggu-frontend) | perintah `curl` siap tempel, dan yang **seharusnya** gagal |
| [7. Cara tahu sudah tersambung](#7-cara-tahu-frontend-sudah-tersambung) | sebelas langkah periksa dari browser |
| [8. Yang tidak perlu kamu kerjakan](#8-yang-tidak-perlu-kamu-kerjakan) | supaya tidak mengerjakan yang sudah beres |

Kalau waktumu terbatas: **bagian 1, 3, dan 5**. Bagian 5 yang paling menghemat
waktu — hampir semua isinya adalah kesalahan yang sudah hampir aku lakukan
sendiri.

---

## 1. Pembagian kerja

| Bagian | Siapa | Status |
|---|---|---|
| HTML, CSS (Tailwind), JavaScript | aku | **selesai** — sembilan layar, semuanya sudah jalan di mode tiruan |
| Database, REST API, server | kamu | belum |
| HTTPS & domain | kamu | belum — **ini yang paling menentukan** |

Frontend dan backend cuma bertemu di **satu tempat**: `src/api.js`. Tidak ada
`fetch` di berkas lain. Kalau bentuk data di backendmu berbeda dari yang aku
tulis, yang perlu diubah cuma berkas itu, bukan seluruh aplikasi.

Kalau kamu punya cara yang lebih baik untuk sesuatu, bilang saja. Aku menulis
kontraknya dari sisi tampilan, bukan dari sisi database — kamu yang lebih tahu
apa yang masuk akal di sana.

---

## 2. Menjalankan frontend

```bash
npm install
npm run dev          # http://localhost:5173
```

Sekarang aplikasinya berjalan di **mode tiruan**: semua permintaan API dijawab
oleh `src/mock.js`, bukan oleh server. Tidak ada server yang perlu hidup.

Akun untuk mencoba:

| Peran | NIP | PIN |
|---|---|---|
| Admin | `ADM001` | `1111` |

**Masuk memakai NIP + PIN**, bukan email dan kata sandi. PIN-nya sama persis
dengan yang dipakai absen di kiosk — satu rahasia untuk dua pintu, dan tidak ada
kata sandi yang perlu dikarang setiap kali membuat akun.

**Hanya akun admin yang ada di sana, dan itu disengaja.** Mode tiruan dulu
membawa 50 akun karangan lengkap dengan ribuan baris absen dan ratusan pengajuan
izin; semuanya sudah dihapus. Aplikasinya untuk **anak magang**, dan anak magang
belum punya riwayat apa pun — jadi daftar yang kosong di awal adalah keadaan yang
benar, bukan data yang gagal dimuat.

Akibatnya satu hal yang mengubah urutan kerjamu: **tidak ada akun magang untuk
menguji sampai kamu membuatnya sendiri.** Buat satu lewat
`POST /admin/magang` (atau lewat layar **Data Master → Anak Magang** di
aplikasinya), lalu catat NIP dan PIN yang kamu isi — itu yang dipakai di kiosk.

### Mode tiruan menyimpan isinya di browser

Isi mode tiruan ditulis ke `localStorage` dengan kunci **`absen-tiruan-1`**:
akun, lokasi, shift, hari libur, absen, dan izin. Ini disengaja — sejak daftarnya
kosong, satu-satunya isi aplikasi adalah yang kamu ketik sendiri, dan kalau
semuanya hilang setiap kali halaman dimuat ulang, mengisi daftar itu tidak ada
gunanya.

Dua batas yang dipasang sengaja:

- **Foto absen tidak ikut disimpan.** Satu foto sekitar 60 KB setelah base64,
  sedangkan `localStorage` hanya muat sekitar 5 MB; beberapa ratus absen saja
  sudah memenuhinya, dan begitu penuh seluruh isian berikutnya ikut gagal
  tersimpan. Yang bertahan adalah jam, tanggal, dan statusnya.
- **Riwayat dipotong di 120 hari terakhir**, supaya isinya tidak tumbuh tanpa
  batas.

Kalau ingin mulai dari nol, hapus kunci itu di DevTools → Application → Local
Storage. Data bawaannya kembali seperti semula: satu admin, dua lokasi, satu
shift, empat hari libur. Salinan yang tersimpan **mengalahkan**
`src/data-tiruan.js` — mengubah isi berkas itu tidak menyentuh browser yang
sudah pernah menyimpan, jadi hapus kuncinya dulu kalau ingin melihat bawaan
yang baru. Catatan ini **hanya berlaku di mode tiruan**; begitu
`VITE_USE_MOCK=false`, `localStorage` cuma menyimpan token sesi.

### Menyambung ke backendmu

Buat berkas `.env` di akar proyek:

```env
VITE_USE_MOCK=false
VITE_API_BASE=/api
```

Lalu jalankan server backend di `http://127.0.0.1:8000`. Vite sudah
mem-proxy `/api` ke sana (lihat `vite.config.js`), jadi **kamu tidak perlu
mengurus CORS selama development** — dan alamatnya sama persis dengan
production, jadi tidak ada kejutan saat naik.

### Bacalah `src/mock.js`

Itu bukan sekadar data palsu. Di situ ada **contoh yang sudah jalan** untuk
setiap endpoint: bentuk balasan, kode status, dan pesan galat dalam Bahasa
Indonesia. Kalau bingung sebuah endpoint harus menjawab apa, tiru saja berkas
itu — termasuk cara ia menolak permintaan yang salah.

---

## 3. Alur aplikasi

Ada **dua pintu masuk** yang tidak berhubungan satu sama lain. Ini disengaja.

```
                    ┌─────────────────────┐
   Magang absen → │  #/absen  (kiosk)   │  tanpa login, layar penuh
                    └─────────────────────┘

                    ┌─────────────────────┐
   Admin & magang │  #/masuk  → #/beranda│  pakai NIP + PIN
   lihat data    →  └─────────────────────┘
```

Setelah masuk, yang terlihat berbeda menurut peran:

| Rute | Layar | Admin | Magang |
|---|---|:---:|:---:|
| `#/absen` | Kiosk absen | — | — (tanpa login, PC kantor) |
| `#/masuk` | Masuk | ✓ | ✓ |
| `#/beranda` | Beranda | ✓ | — |
| `#/magang` · `#/lokasi` · `#/shift` · `#/hari-libur` | Data master | ✓ | — |
| `#/izin-masuk` | Persetujuan izin | ✓ | — |
| `#/laporan` | Rekap & laporan | ✓ | — |
| `#/izin` | Izin & cuti | — | ✓ |
| `#/riwayat` | Riwayat absen | — | ✓ |

**Menu kiosk sengaja tidak ada di sidebar magang** — lihat bagian 3.9.
**Magang juga tidak punya beranda dan tidak punya halaman profil:** setelah
masuk dia langsung mendarat di Riwayat Absen. Alamat yang bukan hak perannya
akan dilempar ke halaman pertama perannya sendiri — admin ke beranda, magang ke
riwayat — tapi itu hanya tampilan: penjagaan yang sebenarnya tetap di server.

### 3.1 Kiosk absen — `#/absen`

Ini layar yang dihadapi magang setiap pagi. **Tanpa login**, dan itu keputusan
yang sengaja: kalau PC kiosk harus login admin dulu, token admin akan tersimpan
di `localStorage` PC yang dipakai bergantian. Itu jauh lebih berbahaya daripada
kiosk terbuka. Sebagai gantinya, **`POST /kiosk/absen` wajib kamu batasi di sisi
server** (poin 5 di bagian paling bawah).

Urutannya:

| Langkah | Yang terjadi | API |
|---|---|---|
| 1 | Layar dibuka, jam besar berjalan, nama lokasi muncul di sudut | `GET /kiosk/lokasi` |
| 2 | Magang memilih **di perusahaan** atau **di luar**, lalu mengetik NIP dan PIN 4–6 angka | — |
| 3 | Kamera menyala, wajahnya tampil, hitung mundur 3 detik | — |
| 4 | Foto diambil otomatis, dikirim bersama NIP dan PIN | `POST /kiosk/absen` |
| 5 | Layar menampilkan "Absen masuk tercatat" + nama + jam + fotonya | — |
| 6 | Setelah 7 detik kembali sendiri ke layar awal | — |

Hal-hal yang perlu kamu tahu tentang alur ini:

- **Magang tidak memilih masuk atau pulang.** Servernya yang menentukan,
  berdasarkan catatan hari itu. Tidak ada tombol untuk disalahgunakan, dan
  tidak ada magang yang salah menekan "pulang" jam tujuh pagi.
- **Yang dia pilih cuma tempatnya: "di perusahaan" atau "di luar".** Pilihannya
  dikirim sebagai `mode` dan disimpan di baris absen. Fotonya tetap wajib di
  dua-duanya — "di luar" bukan izin untuk absen tanpa bukti.
- **Memilih "di luar" membuat layar meminta lokasi.** Browser meminta izinnya
  saat tombol itu ditekan — bukan saat halaman dibuka, supaya yang muncul bukan
  permintaan untuk orang yang cuma lewat. Koordinatnya dikunci sebelum absen
  boleh dikirim: `lintang`, `bujur`, dan `akurasi` ikut terkirim, dan backend
  menolak `422` kalau `mode: "luar"` datang tanpa koordinat. Kalau izinnya
  ditolak, layar menyebut sebabnya dan menyediakan tombol "Coba lagi"; magang
  masih bisa memilih "di perusahaan" untuk melanjutkan.
- **Lokasi kantornya tetap dari alamat halaman**, bukan dari GPS: PC kiosk tidak
  berpindah, jadi `#/absen?lokasi=2` diatur sekali saat pemasangan. **Satu PC
  kiosk = satu alamat tetap.** Kamu tinggal minta admin menyimpan alamat itu
  sebagai bookmark di PC-nya.
- **Kamera tidak mati kalau magang pergi begitu saja.** Kalau mereka menutup
  halaman atau pindah layar, kamera dimatikan otomatis. Aku sudah mengujinya.
- **Kalau jaringan putus**, layarnya bilang "Tidak bisa menghubungi server.
  Periksa jaringan kantor, lalu coba lagi." NIP yang sudah diketik tidak hilang,
  cuma PIN-nya yang perlu diulang.
- **Kalau PIN salah**, NIP tetap terisi dan kursor pindah ke kolom PIN. Yang
  perlu diulang cuma 4 angka, bukan semuanya — penting kalau ada antrean.
- **Pesan untuk PIN salah dan NIP salah harus sama persis.** Kalau backend
  membedakannya, orang bisa memetakan NIP magang satu per satu. Aku sudah
  menguji ini dari sisi tampilan; tolong jaga di sisimu.

> **Lokasi ini gratis, dan memang harus gratis.** Sumbernya `navigator.geolocation`
> bawaan browser: tanpa API key, tanpa tagihan, tanpa Google Maps. Syaratnya
> cuma satu, dan itu sudah jadi syarat kamera juga — HTTPS. Kalau nanti ingin
> menampilkan titiknya di peta, OpenStreetMap + Leaflet juga gratis; untuk
> sekarang frontend cukup menautkan koordinatnya ke openstreetmap.org.
>
> **Akurasinya jujur saja: di PC kiosk tidak bagus.** PC tidak punya GPS;
> browsernya menebak dari IP atau Wi-Fi dan bisa meleset ratusan meter sampai
> salah kota. Di HP hasilnya jauh lebih baik, biasanya belasan meter. Karena itu
> angkanya disimpan dan ditampilkan sebagai "± N m", bukan dipakai menghakimi.
> Kalau suatu hari kamu ingin menolak absen di luar kantor, itu keputusan
> bisnis — tapi jangan berdasarkan jarak dari koordinat PC kiosk.

### 3.2 Masuk — `#/masuk`

Verifikasi NIP + PIN ke `POST /masuk`, lalu token disimpan di `localStorage`.
Setelah berhasil, muncul dialog sambutan, baru berpindah ke beranda. Saat keluar,
ada konfirmasi dulu.

**PIN-nya sama dengan PIN kiosk.** Tidak ada kata sandi sama sekali — jadi
`POST /masuk` dan `POST /kiosk/absen` memeriksa rahasia yang sama, dan keduanya
butuh pembatasan percobaan yang sama ketatnya (5 gagal per NIP → `429` 60 detik).
PIN cuma 4 sampai 6 angka; tanpa pembatasan, seluruh akun bisa dibuka dengan
mencoba seribu kombinasi. Pesan gagalnya juga jangan membedakan NIP salah dari
PIN salah.

Token dikirim sebagai `Authorization: Bearer <token>` **kalau ada sesi**.

Endpoint kiosk harus jalan **baik ada header itu maupun tidak** — PC kiosk tidak
punya sesi, tapi admin yang sedang membuka layar kiosk dari komputernya punya.
Jangan jadikan header itu syarat di `/kiosk/lokasi` dan `/kiosk/absen`.

**Balasan `401` berarti sesi habis** — frontend mengembalikan pengguna ke
halaman masuk. Pakai `401` hanya untuk itu, jangan untuk hal lain.

### 3.3 Beranda — `#/beranda` (admin)

Dashboard kehadiran hari ini: empat kartu angka (sudah absen, belum absen, izin &
cuti, terlambat), daftar yang terlambat, daftar yang belum absen, dan enam
aktivitas terakhir. Ada tombol mundur/maju satu hari untuk melihat tanggal lain;
tanggal ke depan sengaja tidak bisa, jadi tombol majunya mati saat sudah di hari
ini. Tanggal yang jatuh di akhir pekan atau hari libur diberi spanduk sendiri,
dan "belum absen" tidak menuduh siapa pun.

| API | Untuk |
|---|---|
| `GET /admin/dashboard?tanggal=2026-10-19` | seluruh isi layar ini |

Ini panggilan pertama yang isinya benar-benar dihitung server. Sebelumnya
frontend hanya menampilkan apa yang sudah dikirim saat masuk.

**Anak magang tidak punya beranda.** Dulu ada — status hari ini plus rekap bulan
berjalan — dan `GET /saya/ringkasan` dibuat khusus untuknya. Layar itu sudah
dihapus: rekapnya sekarang ada di `#/riwayat` (bagian 3.7), dan endpoint itu
tidak perlu dibuat sama sekali.

### 3.4 Data master — `#/magang` · `#/lokasi` · `#/shift` · `#/hari-libur`

Empat layar di sidebar bagian **Data Master**. Semuanya hanya untuk admin, dan
semuanya memakai bentuk yang sama: satu tabel, satu kotak cari, satu tombol
tambah, dan sebuah formulir di dalam dialog.

| Layar | Isinya | Endpoint |
|---|---|---|
| Anak Magang | seluruh akun, cari berdasarkan nama/NIP/NIK/divisi | `GET·POST /admin/magang`, `PUT /admin/magang/{id}` |
| Lokasi Kantor | 2 lokasi + jumlah magang di masing-masing | `GET·POST /admin/lokasi`, `PUT /admin/lokasi/{id}` |
| Shift Kerja | satu shift: 08.00–17.00, Senin–Jumat | `GET·POST /admin/shift`, `PUT·DELETE /admin/shift/{id}` |
| Hari Libur | 4 tanggal, terurut | `GET·POST·PUT·DELETE /admin/hari-libur` |

Empat hal yang aku putuskan di sini dan sebaiknya kamu ikuti, karena kalau tidak
layarnya akan berperilaku aneh:

1. **`PUT` bersifat menambal.** Tombol Aktifkan/Nonaktifkan cuma mengirim
   `{ "aktif": false }`. Endpoint yang menuntut kiriman lengkap akan menolaknya,
   dan penonaktifannya tidak pernah benar-benar terjadi.
2. **Magang dan lokasi tidak punya `DELETE`.** Keduanya dirujuk oleh baris
   absen. Menutup lokasi atau memberhentikan orang berarti mengubah `aktif` jadi
   `false` — riwayatnya tetap utuh. Hari libur boleh dihapus kapan saja, dan
   shift boleh dihapus selama belum ada orang atau baris absen yang memakainya
   (`409` kalau dipaksa, dengan pesan yang menyebut jumlahnya).
3. **`pin` tidak pernah dikirim ke browser.** Layar ini hanya bisa mengisi yang
   baru, tidak pernah membaca yang lama. Kolomnya boleh dikosongkan, dan artinya
   "biarkan yang lama" — bukan "kosongkan".
4. **`divisi` adalah pilihan tetap, bukan teks bebas.** Isinya hanya tiga:
   `Pendataan`, `Perhitungan`, `Management Data` — huruf besar di awal, persis
   seperti itu. Formulir di layar membangun pilihannya dari daftar yang dikirim
   `GET /admin/magang`, jadi kalau kamu menambah divisi keempat, frontend tidak
   perlu diubah sama sekali. Tolak nilai di luar daftar dengan `422`.

Nomor 3 yang paling penting. Kalau `GET /admin/magang` ikut mengirim `pin`, PIN
itu tersimpan di `localStorage` PC admin — dan PIN itu sekarang sekaligus kunci
masuk akunnya, jadi satu kebocoran membuka dua pintu. PC kiosk dipakai
bergantian, dan PC admin pun bukan tempat yang aman. Simpan sebagai hash.

### 3.5 Persetujuan izin — `#/izin-masuk` (admin)

Tempat admin memutuskan pengajuan cuti, izin, dan sakit. Empat tab dengan jumlah
masing-masing (Menunggu · Disetujui · Ditolak · Semua), satu tabel, dan dua
tombol per baris: Setujui dan Tolak.

| API | Untuk |
|---|---|
| `GET /admin/izin?status=menunggu` | isi tabel + angka di tab |
| `POST /admin/izin/{id}/setujui` | tombol Setujui, didahului konfirmasi |
| `POST /admin/izin/{id}/tolak` | tombol Tolak, wajib mengisi alasan |

Yang paling perlu kamu perhatikan: **angka di tab datang dari server** (kunci
`jumlah`), bukan dihitung frontend dari daftar yang sedang tampil. Kalau kamu
mengirim `data` saja tanpa `jumlah`, tab yang tidak sedang dibuka akan selalu
menulis 0 dan terlihat seperti tidak ada pengajuan sama sekali.

**Menolak tanpa alasan harus ditolak server (`422`).** Alasan itu dibaca
magangnya di layar berikutnya. Penolakan tanpa alasan akan ditanyakan lewat
pesan pribadi, dan jawabannya tidak tercatat di mana pun.

### 3.6 Izin & cuti — `#/izin` (magang)

Sisa jatah cuti di atas (dengan bilah yang terisi), daftar pengajuan sendiri di
bawah, satu tombol Ajukan.

| API | Untuk |
|---|---|
| `GET /saya/izin` | daftar pengajuan + kuota |
| `POST /saya/izin` | mengirim pengajuan baru |

Baca bagian **Izin & cuti** di `KONTRAK-API.md` sebelum mengerjakan yang ini.
Tiga hal di sana yang paling gampang salah, dan ketiganya sudah hampir menjebak
aku sendiri saat menguji: jatah dihitung dalam **hari kerja** bukan hari
kalender, pengajuan yang masih **menunggu** tetap memotong jatah, dan hari yang
**sudah ada absennya** tidak boleh diajukan sebagai izin.

### 3.7 Riwayat absen — `#/riwayat` (magang)

Satu bulan penuh, satu baris per hari, dengan tombol mundur/maju bulan. Tombol
majunya mati di bulan berjalan, tombol mundurnya mati di bulan dia mulai kerja.

| API | Untuk |
|---|---|
| `GET /saya/absen?bulan=2026-10` | daftar hari + ringkasan bulan |

**Hari libur ikut dikirim, jangan disaring.** Sabtu, Minggu, dan tanggal merah
muncul dengan `status: "libur"` dan lencana abu-abu, bukan dihilangkan dari
daftar. Tanggal yang bolong membuat orang mengira ada catatan yang hilang, dan
pertanyaannya sampai ke admin.

Urutan prioritas statusnya ada di `KONTRAK-API.md`. Yang paling penting:
**absen menang atas izin**, supaya satu hari kerja tidak mungkin terhitung dua
kali sekaligus.

**Ini layar pertama anak magang, dan satu-satunya layar kehadirannya.** Setelah
masuk dia langsung mendarat di sini. Dulu ada beranda dan halaman profil
tersendiri; dua-duanya sudah dihapus, karena seluruh isi akun magang memang cuma
dua: melihat rekap absennya sendiri (layar ini) dan mengajukan izin (`#/izin`).

Akibat yang perlu kamu tahu: **akun magang benar-benar read-only.** Satu-satunya
endpoint tulis di bawah `/saya/` adalah `POST /saya/izin`. Tidak ada
`PUT /saya/pin` dan tidak ada `PUT /saya/sandi` — PIN disetel admin lewat
`POST /admin/magang` dan `PUT /admin/magang/{id}`, dan kalau magangnya lupa, admin
yang mereset.

> **Batas PIN harus 4–6 angka, dan harus sama di server, di formulir Data Master,
> dan di kiosk.** Versi pertama kiosk memotong isiannya di 4 angka, jadi PIN lima
> atau enam angka yang sudah diterima server tidak akan pernah bisa diketik —
> tanpa pesan apa pun, karena angkanya hanya tidak muncul. Sudah aku perbaiki;
> tolong jaga di sisimu supaya batasnya tetap sama.

### 3.8 Rekap & laporan — `#/laporan` (admin)

Rekap sebulan untuk semua magang, dan rincian harian satu orang. Tombol
"Lihat" di tiap baris membuka rinciannya di layar yang sama — admin yang
memeriksa satu nama hampir selalu ingin kembali ke daftarnya, dan halaman baru
kehilangan bulan yang sedang dibuka.

| API | Untuk |
|---|---|
| `GET /admin/laporan?bulan=2026-10` | rekap semua magang + ringkasan |
| `GET /admin/laporan/harian?bulan=&pengguna_id=` | rincian satu orang |

Bentuk `data` di `/admin/laporan/harian` **wajib sama persis** dengan
`GET /saya/absen`. Admin dan magang harus melihat hari yang sama dengan kolom
yang sama; kalau berbeda, salah satu dari mereka akan merasa ada yang
disembunyikan. Cara paling murah memastikan itu: satu fungsi yang dipakai dua
endpoint.

**Magang yang sudah dinonaktifkan tetap ikut kalau bulan itu dia punya
catatan.** Kalau tidak, orang yang berhenti tanggal 10 hilang dari rekap bulan
itu dan angkanya tidak bisa dicocokkan dengan absennya yang jelas ada. Tandai
dengan `aktif: false`.

**Ekspor CSV tidak butuh endpoint.** Berkasnya disusun di browser dari balasan
`GET /admin/laporan`. Tidak ada yang perlu kamu tambahkan.

### 3.9 Yang tidak ada di sidebar, dan itu disengaja

Magang **tidak** melihat menu "Kiosk Absen". Kiosk itu PC kantor yang
alamatnya dijadikan bookmark — bukan sesuatu yang dibuka dari HP. Menu magang
hanya dua: Riwayat Absen dan Izin & Cuti.

Kalau kamu menambahkan menu, satu hal yang perlu diketahui: daftar menu dan
daftar rute diturunkan dari satu sumber di `src/menu.js`, dan `peran: ['magang']`
berarti butir itu tidak dirender untuk admin. Orang yang mengetik alamat milik
peran lain akan dilempar ke halaman pertamanya sendiri — admin ke Beranda,
magang ke Riwayat Absen — tapi itu **penjagaan tampilan, bukan pengaman**.
Penjagaan yang sebenarnya tetap harus ada di server.

---

## 4. Urutan pengerjaan yang aku sarankan

Dari yang paling menentukan ke yang paling bisa ditunda. Jangan dibalik — poin 1
bukan pekerjaan teknis, tapi kalau dilewati, semua sisanya tidak ada gunanya.

1. **HTTPS dan cara aplikasinya diakses.**
   Ini penentu utama. Akses kamera di browser **hanya diizinkan lewat HTTPS atau
   `localhost`**. Kalau aplikasinya disajikan lewat `http://192.168.1.10`,
   browsernya memblokir kamera dan **tidak ada seorang pun yang bisa absen**.
   Ini tidak bisa aku perbaiki dari sisi frontend, sekeras apa pun aku mencoba.
   Pilihanmu: domain + sertifikat (Let's Encrypt gratis), atau Cloudflare Tunnel,
   atau apa pun yang membuat alamatnya berawalan `https://`.

2. **`POST /masuk` dan `POST /keluar`.**
   Paling cepat teruji: aku bisa langsung mencoba dari layar masuk hari itu juga.

3. **`GET /saya/profil`.** Bentuk balasannya harus **sama persis** dengan objek
   `pengguna` di `POST /masuk` — frontend memakai keduanya silih berganti, dan
   bentuk yang berbeda berarti ada kolom yang hilang setelah halaman dimuat
   ulang. Tidak perlu tambahan apa pun: `shift`, `lokasi`, dan `sisa_cuti` dulu
   ada di sini untuk layar Profil Saya, dan layar itu sudah dihapus.
   Tanpa endpoint ini aplikasi tetap jalan, tapi nama dan divisi yang tampil
   adalah salinan lama dari `localStorage`, jadi jangan jadikan penghalang kalau
   poin 2 sudah beres.

4. **Tabel magang**, termasuk kolom `nip` dan `pin`.
   PIN disimpan di tabel magang yang sudah ada, bukan tabel baru. **Jangan
   simpan PIN sebagai teks biasa** — di-hash. PIN ini sekarang satu-satunya
   rahasia yang dimiliki magang: dipakai untuk absen di kiosk sekaligus untuk
   masuk aplikasi, jadi satu kebocoran membuka dua pintu sekaligus. Kasih nilai
   awal supaya aku bisa menguji: di data tiruan cuma ada `ADM001`/`1111`, karena
   akun magang memang kamu buat sendiri lewat `POST /admin/magang`.
   Simpan `divisi` sebagai kolom tersendiri (lihat bagian 3.4 nomor 4).

   Tambahkan juga kolom **`aktif`** sekarang, walaupun belum ada yang memakainya:
   memberhentikan magang berarti menonaktifkannya, bukan menghapusnya —
   riwayat kehadirannya tetap harus ada. Menambahkan kolom ini belakangan berarti
   mengubah tabel yang sudah ada isinya.

5. **`GET /kiosk/lokasi`.** Kecil, cepat, dan membuat layar kiosk langsung
   terasa hidup.

6. **`POST /kiosk/absen`, plus dua penjagaannya** (batas IP dan batas
   percobaan). Jangan mengerjakan endpointnya dulu baru penjagaannya — dua hal
   itu satu paket. Tanpa keduanya, aplikasi ini cuma memindahkan absensi manual
   ke bentuk digital tanpa menambah apa pun.

   Endpoint ini juga yang pertama kali butuh **tabel shift** dengan jam masuk
   dan toleransinya. `telat_menit` dihitung **sekali saat absen**, lalu
   disimpan. Jangan menghitungnya ulang setiap laporan dibuka: jadwal shift yang
   diubah besok akan mengubah status telat kemarin, dan angka yang berubah
   sendiri tidak bisa dipertanggungjawabkan ke siapa pun.

   Untuk koordinat, ikuti aturan 7–8 di `KONTRAK-API.md`: `mode: "luar"` tanpa
   `lintang`/`bujur` yang sah dibalas `422`. Jangan menolak absen berdasarkan
   jarak ke kantor — akurasi PC kiosk tidak cukup untuk itu.

7. **`GET /admin/dashboard`.** Di sinilah absen yang dicatat kiosk akhirnya
   terlihat. Perhatikan aturan `hari_kerja` dan `keterangan_libur` di
   `KONTRAK-API.md` — tanpa keduanya, dashboard yang dibuka pada hari Sabtu
   melaporkan seluruh kantor tidak masuk.

8. **Endpoint data master** — `/admin/magang`, `/admin/lokasi`, `/admin/shift`,
   `/admin/hari-libur`. Keempat layarnya sudah jadi dan sudah aku uji. Dua hal
   yang paling mudah terlewat:
   - **`PUT` harus menerima kiriman sebagian.** Tombol Aktifkan/Nonaktifkan
     hanya mengirim `{ "aktif": false }`. Endpoint yang menuntut nama dan NIP
     ikut terkirim akan menolaknya, dan penonaktifannya diam-diam gagal.
   - **`aktif` harus diperiksa di `POST /masuk` dan `POST /kiosk/absen`.**
     Memeriksanya hanya di `GET /saya/profil` tidak menolong: itu baru berjalan
     saat aplikasi dibuka berikutnya, bukan saat dia menekan Masuk.
   - **Hapus shift ada, tapi bertiga syarat.** `DELETE /admin/shift/{id}` harus
     menolak `409` kalau itu shift terakhir, kalau masih ada magang dengan
     `shift_id` itu, atau kalau ada baris absen yang menunjuk ke sana. Yang
     menunjuk ke shift yang sudah hilang akan tampil sebagai "—" di layar, dan
     tidak ada satu pun layar yang bisa menjelaskan kenapa.

9. **Izin & cuti sekaligus persetujuannya** — `GET /saya/izin`,
    `POST /saya/izin`, `GET /admin/izin`, dan dua endpoint keputusan.
    Satu paket, jangan dipisah: pengajuan yang tidak bisa disetujui tidak
    membuktikan apa pun, dan layar admin yang kosong tidak bisa diuji.
    Baca bagian **Izin & cuti** di `KONTRAK-API.md` sebelum mulai — aturan
    hari kerja dan kuotanya ada di sana, dan itu bagian yang paling gampang
    salah kalau dikarang sendiri.

10. **`GET /saya/absen`, lalu `GET /admin/laporan` dan `/admin/laporan/harian`.**
    Ketiganya membaca riwayat, jadi kerjakan berurutan: tulis perhitungan satu
    bulan itu **satu kali** di satu tempat, lalu pakai di tiga endpoint.
    Kalau kamu menghitungnya dua kali dengan dua cara, angka admin dan angka
    magang akan berbeda — dan saat itu terjadi, tidak ada lagi angka yang
    dipercaya.

11. **Pembatasan percobaan di `POST /masuk`.** Kecil dan berdiri sendiri, tapi
    jangan ditunda ke akhir: PIN-nya cuma 4–6 angka dan NIP gampang ditebak
    (`MGG001`, `MGG002`, …), jadi tanpa batas percobaan seluruh akun bisa dibuka
    dengan mencoba seribu kombinasi. Aturannya sama dengan kiosk — 5 gagal per
    NIP, lalu `429` selama 60 detik.

12. **`GET /admin/anomali`** — tidak dipakai layar mana pun. Kerjakan hanya
    kalau kamu memang ingin memantau absen mencurigakan sendiri dari database.
    Bentuknya ada di ujung `KONTRAK-API.md`.

Kalau seluruh daftar di atas selesai, frontend dan backend sudah bertemu
seluruhnya. Tidak ada layar yang menunggu, dan tidak ada endpoint yang menganggur.

---

## 5. Hal yang paling sering bikin gagal

Aku menulis ini karena beberapa di antaranya sudah hampir menjebak aku sendiri.

**Kamera diblokir karena bukan HTTPS.** Sudah dijelaskan di poin 1. Gejalanya:
magang menekan "Absen Sekarang" dan langsung muncul pesan bahwa kamera tidak
bisa dipakai — tanpa pernah muncul permintaan izin. Kalau itu yang terjadi,
penyebabnya alamat server, bukan webcamnya.

**Absen dari rumah.** Ini yang paling ingin dihindari. Magang bisa membuka
`#/absen` dari HP-nya karena kiosk tidak butuh login. Yang menghalangi mereka
cuma PIN 4–6 angka — **10.000 sampai 1.000.000 kemungkinan, dan yang 4 angka
bisa dicoba komputer dalam hitungan detik**. Batasi endpoint absen supaya hanya
menerima dari alamat kantor. Kalau kantornya tidak punya IP publik tetap, kabari
aku, ada cara lain.

**PIN bisa ditebak berulang kali.** Batasi 5 kali gagal per NIP lalu tunggu
60 detik (`429`). Balas juga `429` dengan pesan Bahasa Indonesia yang enak dibaca —
magang melihatnya langsung di layar kiosk.

**Magang yang sudah dinonaktifkan masih bisa masuk.** Ini kesalahan yang sama
seperti di atas tapi lebih halus: memeriksa `aktif` cuma di `GET /saya/profil`
terasa sudah benar, karena aplikasinya memang menolak di pembukaan berikutnya.
Yang tidak tertutup adalah hari itu juga — dia masih bisa masuk dan absen sampai
aplikasinya ditutup. Periksa di `POST /masuk` dan di `POST /kiosk/absen`.

**Admin mengunci dirinya sendiri.** Layar Data Anak Magang bisa menurunkan peran
admin jadi magang. Server **wajib menolak** permintaan yang menurunkan peran
diri sendiri atau menonaktifkan akun sendiri (`422`). Frontend sudah tidak
menampilkan tombolnya, tapi itu bukan pengaman — permintaan bisa dikirim tanpa
lewat tombol.

**Akun admin ikut dihitung sebagai orang yang harus absen.** Sekarang daftarnya
mulai kosong, akun admin adalah satu-satunya akun yang pasti ada — jadi kalau
`GET /admin/dashboard` menghitung semua akun aktif, dashboardnya melaporkan satu
orang "belum absen" setiap pagi, dan tidak ada layar mana pun yang bisa
menghilangkannya. Kecualikan `peran: "admin"` dari hitungan itu, di dashboard
**dan** di `GET /admin/laporan`. Kecuali adminnya memang punya absen atau izin di
periode itu: kalau begitu dia harus tetap muncul, supaya angkanya tetap berjumlah
pas.

---

Enam berikut ini dari bagian izin dan laporan, dan keenamnya sudah hampir
menjebak aku sendiri waktu menguji. Aku tulis apa adanya supaya kamu tidak
menemukannya lewat sepuluh pengajuan yang salah hitung.

**Jatah cuti dihitung dengan hari kalender.** Ini kesalahan paling gampang
terjadi, dan hasilnya baru kelihatan sebulan kemudian waktu magang protes
sisanya kurang. Cuti Jumat sampai Senin adalah **2 hari kerja**, bukan 4. Sabtu,
Minggu, dan tanggal di `/admin/hari-libur` tidak dihitung. Yang paling penting:
**satu definisi dipakai di dua tempat** — layar Izin & Cuti dan laporan
bulanan. Kalau keduanya menghitung sendiri-sendiri, cepat atau lambat angkanya
berbeda, dan tidak ada yang tahu mana yang benar.

**Pengajuan yang masih `menunggu` tidak ikut memotong jatah.** Terasa masuk akal
— kan belum disetujui. Akibatnya: satu orang bisa mengajukan tiga cuti untuk
tanggal yang sama, dan admin baru sadar di pengajuan ketiga, setelah dua
keputusan yang salah. Hitung yang `menunggu` sebagai pemakaian jatah.

**Satu hari terhitung sebagai hadir dan cuti sekaligus.** Laporan menghitung
hari yang punya absen masuk sebagai *hadir*. Kalau ada cuti yang disetujui untuk
hari itu, jatahnya terpotong tapi di laporan mana pun tidak pernah muncul
sebagai cuti. Dari situ muncul pertanyaan yang tidak bisa dijawab siapa pun.
Dua penangkalnya, pakai dua-duanya: **urutan prioritas status** (absen menang
atas izin — ada di `KONTRAK-API.md`) dan **penolakan `409`** saat magang
mengajukan izin untuk hari yang sudah ada absennya.

**Menyetujui tanpa memeriksa ulang.** Bisa ada dua pengajuan yang
masing-masing muat tapi jumlahnya melebihi jatah kalau keduanya disetujui.
Periksa ulang sisa jatah di endpoint `setujui` (`422`), dan periksa juga
pengajuan lain yang sudah disetujui pada tanggal yang tumpang tindih (`409`).
Pemeriksaan di saat pengajuan dibuat saja tidak cukup, karena saat itulah
dua-duanya masih `menunggu`.

**Menolak tanpa alasan.** Alasan penolakan itu dibaca magangnya di layar Izin
& Cuti, dan itu satu-satunya tempat dia bisa membacanya. Tanpa alasan, dia akan
bertanya lewat WhatsApp, dan jawabannya hilang. Server wajib menolak `tolak`
yang tanpa `catatan` yang berarti (`422`, minimal 4 karakter) — bukan cuma
frontend yang meminta.

**Magang yang berhenti tengah bulan hilang dari rekap.** Kalau
`GET /admin/laporan` menyaring `aktif = true`, orang yang berhenti tanggal 10
tidak muncul di rekap bulan itu, padahal sepuluh hari absennya jelas ada di
database. Angkanya jadi tidak bisa dicocokkan dengan apa pun. Sertakan dia kalau
bulan itu dia punya catatan, dan tandai `aktif: false`.

---

Dua lagi yang lebih kecil, tapi tetap perlu:

**`GET /saya/profil` dipanggil setiap aplikasi dibuka.** Balasannya harus sama
persis dengan objek `pengguna` di `POST /masuk` — frontend memakai keduanya
silih berganti, dan bentuk yang berbeda berarti ada kolom yang hilang setelah
halaman dimuat ulang. Dulu di sini ada tambahan `shift`, `lokasi`, dan
`sisa_cuti` untuk layar Profil Saya; layar itu sudah dihapus, jadi tidak perlu.

**Batas PIN 4–6 angka harus sama di server dan di kiosk.** Versi pertama kiosk
memotong isiannya di 4 angka, jadi PIN lima atau enam angka yang sudah diterima
server tidak akan pernah bisa diketik — tanpa pesan apa pun, karena angkanya
hanya tidak muncul. Sudah aku perbaiki di `src/views/absen.js`; tolong jaga di
sisimu supaya batasnya tetap sama.

**Zona waktu server salah.** Kalau jam absen bergeser beberapa jam, hampir pasti
ini penyebabnya. Zona kantor adalah `Asia/Jakarta` (UTC+7). Di server Laravel:
set `'timezone' => 'Asia/Jakarta'` di `config/app.php`. Kalau memakai
PHP/XAMPP, ubah `date.timezone` di `php.ini` — **hati-hati, `php.ini` di komputer
ini masih disetel `Europe/Berlin`** dan itu menghasilkan selisih 6 jam yang
tidak terlihat sampai ada yang memeriksa laporan. Jam absen diambil dari jam
server, jadi server-lah yang harus benar.

**Balasan galat berupa halaman HTML.** Kalau Laravel mengirim halaman debug saat
error, frontend cuma bisa menampilkan "Permintaan gagal (500)" dan penyebab
aslinya tidak pernah sampai ke layar. Pastikan permintaan ber-`Accept:
application/json` selalu dijawab JSON.

**Foto terlalu besar untuk PHP.** Satu foto sekitar 55–80 KB setelah base64,
jadi sebenarnya tidak besar. Tapi nilai bawaan `post_max_size` kadang cuma 2 MB
dan ada juga batas lain di depan. Naikkan ke atas 1 MB supaya lega.

**Alamat `/` tidak menyajikan hasil build.** Kalau kamu menaruh `dist/` di dalam
`public/` Laravel dan menjalankannya dengan `php artisan serve`, halaman utama
**tidak akan muncul**. Router bawaan `artisan serve` selalu mengarahkan `/` ke
`public/index.php`. Cara mengatasinya ada di `KONTRAK-API.md`.

**CORS kalau tidak lewat proxy.** Vite sudah mem-proxy `/api`, jadi kalau kamu
menjalankan backend di `127.0.0.1:8000` (port bawaan `artisan serve`), tidak ada
yang perlu diatur. Kalau kamu memilih port atau alamat lain, itu yang harus
dibuka. Kalau nanti aplikasinya diakses dari HP magang, CORS perlu diatur
untuk alamat itu juga.

---

## 6. Menguji tanpa menunggu frontend

Kamu bisa menguji sendiri dengan `curl`. Ingat, `POST /kiosk/absen` butuh foto,
jadi siapkan berkas contoh:

```bash
# masuk — simpan token-nya, hampir semua perintah lain memerlukannya
curl -X POST http://127.0.0.1:8000/api/masuk \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"nip":"ADM001","pin":"1111"}'

# buat satu anak magang. KERJAKAN INI DULU.
# Tanpa akun magang, kiosk tidak punya siapa-siapa untuk diabsen dan tidak ada
# satu pun akun untuk menguji izin. Catat NIP dan PIN yang kamu isi di sini —
# dua perintah di bawah memakainya, dan PIN itu juga dipakai untuk masuk.
curl -X POST http://127.0.0.1:8000/api/admin/magang \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"nama":"Rina Kartika","nip":"MGG001","nik":"3271012345670001","email":"rina@kantor.id","divisi":"Perhitungan","peran":"magang","shift_id":1,"lokasi_id":1,"masuk_kerja":"2026-10-19","cuti_kuota":12,"pin":"4321"}'

# lokasi kiosk
curl "http://127.0.0.1:8000/api/kiosk/lokasi?lokasi=2" -H "Accept: application/json"

# absen — pakai NIP dan PIN dari akun yang baru saja kamu buat.
# Foto diganti isi berkas base64 yang sungguhan.
# Ini contoh absen di luar: koordinatnya wajib. Untuk absen di perusahaan,
# ganti mode jadi "kantor" dan buang lintang/bujur/akurasi.
curl -X POST http://127.0.0.1:8000/api/kiosk/absen \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"nip":"MGG001","pin":"4321","lokasi_id":2,"mode":"luar","lintang":-6.208812,"bujur":106.845599,"akurasi":12,"foto":"data:image/jpeg;base64,AAAA"}'

# harus 422: mode luar tanpa koordinat
curl -X POST http://127.0.0.1:8000/api/kiosk/absen \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"nip":"MGG001","pin":"4321","mode":"luar","foto":"data:image/jpeg;base64,AAAA"}'

# data master — ganti <token> dengan hasil dari /masuk
curl http://127.0.0.1:8000/api/admin/magang -H "Accept: application/json" \
  -H "Authorization: Bearer <token>"

# pembaruan sebagian: hanya status, tanpa nama dan NIP
curl -X PUT http://127.0.0.1:8000/api/admin/magang/3 \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -d '{"aktif":false}'

# izin & cuti
curl "http://127.0.0.1:8000/api/saya/izin" -H "Accept: application/json" \
  -H "Authorization: Bearer <token>"

curl -X POST http://127.0.0.1:8000/api/saya/izin \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jenis":"cuti","mulai":"2026-11-02","selesai":"2026-11-03","alasan":"Acara keluarga."}'

curl "http://127.0.0.1:8000/api/admin/izin?status=menunggu" \
  -H "Accept: application/json" -H "Authorization: Bearer <token>"

curl -X POST http://127.0.0.1:8000/api/admin/izin/1/setujui \
  -H "Accept: application/json" -H "Authorization: Bearer <token>"

curl -X POST http://127.0.0.1:8000/api/admin/izin/1/tolak \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -d '{"catatan":"Beban kerja sedang tinggi."}'

# riwayat dan laporan
curl "http://127.0.0.1:8000/api/saya/absen?bulan=2026-10" \
  -H "Accept: application/json" -H "Authorization: Bearer <token>"

curl "http://127.0.0.1:8000/api/admin/laporan?bulan=2026-10" \
  -H "Accept: application/json" -H "Authorization: Bearer <token>"

curl "http://127.0.0.1:8000/api/admin/laporan/harian?bulan=2026-10&pengguna_id=7" \
  -H "Accept: application/json" -H "Authorization: Bearer <token>"

# akun sendiri
# Tidak ada lagi PUT /saya/pin atau PUT /saya/sandi — keduanya dihapus, dan akun
# magang sekarang read-only. Kalau PIN seseorang perlu diganti, itu lewat
# endpoint admin, dan cukup kirim kolom pin-nya saja:
curl -X PUT http://127.0.0.1:8000/api/admin/magang/2 \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -d '{"pin":"97531"}'
```

Uji juga yang **seharusnya gagal** — bagian ini yang paling sering lupa dikerjakan:

- PIN benar, NIP salah → pesannya harus sama seperti NIP benar, PIN salah
- Absen ketiga hari itu → `409`, "sudah absen pulang hari ini."
- `foto` kosong atau bukan gambar → `422`
- Enam kali PIN salah berturut-turut → `429` pada percobaan kelima ke atas.
  **Berlaku dua-duanya: `/kiosk/absen` dan `/masuk`** — PIN yang sama menjaga
  dua pintu, jadi pembatasannya juga tidak boleh cuma di satu pintu.
- Permintaan absen dari alamat IP luar kantor → ditolak
- `POST /masuk` dengan akun yang sudah dinonaktifkan → `403`, bukan `200`
- `POST /kiosk/absen` dengan NIP yang sudah dinonaktifkan → `403`
- `GET /admin/magang` dengan token magang biasa → `403`
- `GET /admin/magang` → **tidak boleh ada `pin` di dalamnya.** Periksa
  balasannya, jangan cuma percaya pada kode programmu.
- `PUT /admin/magang/{id}` untuk diri sendiri dengan `{"peran":"magang"}` →
  `422`

Enam hari yang perlu benar di bagian izin:

- Ajukan cuti Jumat–Senin → balasannya `hari_kerja: 2`, bukan 4
- Ajukan cuti sampai melebihi jatah → `422`, dan pesannya menyebut berapa sisa
  dan berapa yang diajukan
- Ajukan izin untuk hari yang **sudah ada absennya** → `409`
- Ajukan pengajuan kedua untuk tanggal yang sama dengan yang masih `menunggu`
  → `409`
- Ajukan untuk tanggal yang seluruhnya sudah lewat → `422`
- Ajukan yang **selesai hari ini** kalau `mulai`-nya kemarin → **boleh**.
  Sakit biasanya baru dilapor setelah sembuh, jadi jangan ditolak.

Empat lagi untuk keputusan admin:

- `tolak` tanpa `catatan` → `422`
- `setujui` dua kali untuk id yang sama → `409` pada yang kedua
- `setujui` yang bikin jatahnya lewat → `422`
- `setujui` padahal sudah ada pengajuan **disetujui** yang tanggalnya
  tumpang tindih → `409`

Dan satu untuk akun sendiri:

- Endpoint `PUT /saya/pin` dan `PUT /saya/sandi` **sudah tidak ada.** Kalau
  terlanjur kamu buat, hapus: frontend tidak pernah memanggilnya lagi, dan
  setiap endpoint tulis yang tidak dipakai cuma menambah pintu yang perlu
  dijaga. Akun magang sekarang read-only — satu-satunya endpoint tulis di
  bawah `/saya/` adalah `POST /saya/izin`.

---

## 7. Cara tahu frontend sudah tersambung

Jalankan frontend dengan `VITE_USE_MOCK=false`, buka `http://localhost:5173`,
lalu buka Network tab di browser. Yang seharusnya kamu lihat:

1. Menekan "Masuk" mengirim `POST /api/masuk` — **bukan** dijawab dari memori,
   dan balasannya `200`
2. Di layar kiosk, `GET /api/kiosk/lokasi` balasannya `200` dan nama lokasi
   muncul di sudut kanan atas
3. Di layar kiosk, pilih **Di luar** sebelum mengetik NIP: izin lokasi muncul,
   statusnya berubah jadi "Lokasi terkunci · ± N m", dan `POST /api/kiosk/absen`
   terkirim membawa `mode`, `lintang`, `bujur`, serta `akurasi`. Balasannya
   `200` dan layar hijau "Absen masuk tercatat" muncul. Kalau izin lokasinya
   ditolak, absen **tidak boleh terkirim** dan tombol "Coba lagi" muncul
4. Membuka **Data Master → Anak Magang** memanggil `GET /api/admin/magang`. Di
   database yang baru dibuat, tabelnya **kosong** dan yang muncul adalah ajakan
   menambah — itu benar, bukan endpoint yang belum jalan (perhatikan
   balasannya tetap `200`). Tekan **Tambah anak magang**, isi satu akun lengkap
   dengan salah satu divisi, lalu simpan: `POST /api/admin/magang` terkirim dan
   orangnya muncul di tabel. **Catat NIP dan PIN-nya** — langkah 6, 7, 8, dan
   10 memakainya untuk masuk sebagai dia
5. Menambah satu hari libur di **Data Master → Hari Libur**, lalu membuka
   Beranda pada tanggal itu: spanduk liburnya muncul dan "belum absen"
   tidak menuduh siapa pun
6. Buka **Izin & Cuti** sebagai magang: sisa cuti dan bilahnya terisi, dan
   daftar pengajuannya muncul. Ajukan satu cuti dua hari — kalau salah satunya
   jatuh di akhir pekan, angka "hari kerja" di konfirmasi harus ikut mengecil
7. Masuk sebagai admin, buka **Persetujuan Izin**: tab-tabnya berisi angka yang
   sama dengan yang kamu lihat di database. Setujui satu pengajuan, lalu kembali
   ke magang tadi — sisa cutinya harus ikut berkurang tanpa perlu keluar-masuk
8. Buka **Riwayat Absen** sebagai magang: hari-hari yang ada absennya terisi
   masuk/pulang/lokasi, absen `mode: "luar"` tampil sebagai **"Luar kantor"**
   yang bisa diklik menuju OpenStreetMap, Sabtu dan Minggu muncul sebagai baris
   "Libur", hari kerja yang belum dilewati muncul sebagai "Belum absen", dan
   tombol bulan mundur berhenti di bulan dia mulai bekerja
9. Buka **Rekap & Laporan** sebagai admin: **jumlah barisnya sama dengan jumlah
   akun di database**, angka di kartu ringkasan cocok dengan jumlah barisnya, dan
   tombol **Unduh CSV** menghasilkan berkas yang membuka di Excel dengan kolom
   yang terpisah — bukan satu kolom panjang
10. Sebagai magang, ketik `#/beranda`, `#/profil`, dan `#/magang` di address
    bar. Ketiganya harus memantul ke **Riwayat Absen**, dan sidebar-nya tetap
    cuma dua menu — Riwayat Absen dan Izin & Cuti
11. Buka **Persetujuan Izin**, tolak satu pengajuan tanpa mengisi alasan —
    tombol simpannya harus menolak, dan server juga harus menolak kalau
    permintaannya dikirim langsung

Kalau salah satu langkah balasannya `404`, alamatnya belum kamu buat. Kalau
`500`, ada yang salah di sisi servermu dan pesannya ada di log Laravel. Kalau
permintaannya tidak muncul sama sekali di Network tab, berarti `VITE_USE_MOCK`
masih `true` — hentikan dev server, ubah `.env`, lalu jalankan lagi (Vite hanya
membaca `.env` saat start).

---

## 8. Yang tidak perlu kamu kerjakan

Supaya kamu tidak mengerjakan hal yang sudah beres:

- Menampilkan dan memformat tanggal/jam — sudah diurus frontend, dikunci ke
  `Asia/Jakarta` supaya jam laptop yang salah setel tidak merusak tampilan
- Mengambil foto dari kamera dan mengecilkannya — sudah, hasilnya 640×480 JPEG
- Menampilkan pesan galat ke pengguna — frontend menampilkan `message` apa adanya,
  jadi cukup tulisan Bahasa Indonesia yang enak dibaca
- Menentukan masuk atau pulang — itu tugasmu, tapi **jangan** minta frontend
  mengirimkannya
- Memvalidasi NIP huruf besar-kecil — frontend sudah menaikkan hurufnya, tapi
  tetap bandingkan tanpa peduli besar-kecil di sisimu
- **Membuat endpoint ekspor CSV.** Berkasnya disusun di browser dari balasan
  `GET /admin/laporan`. Termasuk pemisahnya (titik koma, karena Excel
  berbahasa Indonesia memakai koma untuk desimal) dan BOM-nya — sudah diurus.
- **Menghitung hari kerja di sisi frontend.** Semuanya datang dari server, dan
  memang harus begitu: satu definisi yang dipakai layar magang, beranda, dan
  laporan. Kalau frontend ikut menghitung, dua angka akan berbeda dan tidak ada
  yang bisa memutuskan mana yang benar.
- **Menyimpan PIN dalam bentuk terbaca.** Disimpan sebagai hash — lihat poin 4
  di bagian 4. Frontend tidak pernah menerima PIN siapa pun, termasuk miliknya
  sendiri: formulir Data Master hanya bisa **mengisi yang baru**, tidak pernah
  menampilkan yang lama.

---

Kalau ada yang kurang jelas atau kamu tidak setuju dengan salah satu keputusan
di atas, bilang saja. Lebih murah berdebat sekarang daripada setelah keduanya
kepalang jadi.
