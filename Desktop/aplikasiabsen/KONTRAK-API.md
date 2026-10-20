# Kontrak API — Aplikasi Absen

Dokumen ini ditulis dari sisi frontend. Isinya **bentuk data yang dibutuhkan
layar-layar di aplikasi**, bukan cara mengambilnya dari database.

Silakan dikoreksi. Kalau di backend sudah kepalang memakai nama lain, tidak
masalah — frontend hanya perlu menyesuaikan satu berkas (`src/api.js`).

**Daftarnya mulai kosong, dan itu memang disengaja.** Aplikasinya untuk **anak
magang**, dan anak magang belum punya riwayat absen apa pun — jadi mode tiruan
tidak membawa satu pun akun magang, tidak ada baris absen, dan tidak ada
pengajuan izin. Yang ada hanya satu akun admin, yang dipakai untuk membuat
sisanya:

| Peran | NIP | PIN |
|---|---|---|
| Admin | `ADM001` | `1111` |

Akun admin itu, dua lokasi, satu shift (08.00–17.00), dan empat hari libur
ditulis di `src/data-tiruan.js`. Karena akun magang tidak ada, **`POST /admin/magang`
adalah endpoint pertama yang harus jalan** — tanpa itu tidak ada yang bisa
diabsen di kiosk dan tidak ada yang bisa mengajukan izin.

**Masuk memakai NIP + PIN.** Tidak ada kata sandi di mana pun. PIN-nya sama
persis dengan yang dipakai absen di kiosk — satu rahasia untuk dua pintu — jadi
tidak ada kata sandi yang perlu dikarang admin setiap kali membuat akun.

Minggu kerjanya Senin sampai Jumat. Sabtu dan Minggu libur dengan sendirinya di
seluruh sistem karena dihitung dari hari dalam seminggu — jadi **jangan**
didaftarkan sebagai baris di tabel hari libur. Isi tabel itu hanya tanggal
merah.

---

## Aturan umum

### Alamat dasar

Semua endpoint di bawah `/api`.

| Lingkungan | Alamat |
|---|---|
| Development | `http://localhost:5173/api` → diteruskan Vite ke `http://127.0.0.1:8000/api` |
| Production | Terserah teman Anda; frontend membaca `VITE_API_BASE` |

Karena Vite mem-proxy `/api`, **tidak perlu konfigurasi CORS** selama
development, dan alamatnya sama persis dengan production.

### Autentikasi

- Setiap endpoint kecuali `/masuk` mengirim header `Authorization: Bearer <token>`
- Token didapat dari `POST /masuk`
- Response gagal dengan status `401` dianggap sesi habis → frontend mengembalikan
  pengguna ke halaman login

**Sesi diperiksa ulang setiap aplikasi dibuka.** Sebelum layar pertama dipasang,
frontend memanggil `GET /saya/profil` dan menimpa data pengguna yang tersimpan di
`localStorage`. Tanpa endpoint itu, dua hal ini terjadi:

- Nama atau divisi yang diubah admin tidak akan terlihat sampai orangnya keluar
  sendiri.
- Magang yang sudah dinonaktifkan tetap bisa membuka aplikasi, karena frontend
  hanya memegang salinan lama dari `localStorage`.

Status jawabannya menentukan tindakan frontend, dan aturan ini sudah tertanam di
`src/api.js`:

| Jawaban | Tindakan frontend |
|---|---|
| `200` | Data pengguna di `localStorage` ditimpa dengan yang baru |
| `401` atau `403` | Sesi dihapus, pengguna dikembalikan ke halaman login |
| Gagal jaringan atau `5xx` | Sesi **dipertahankan**, aplikasi lanjut dengan data tersimpan |

Baris terakhir disengaja: jaringan kantor yang sedang bermasalah bukan alasan
mengeluarkan orang dari aplikasinya.

> Frontend saat ini menyimpan token di `localStorage`. Kalau teman Anda lebih
> memilih cookie sesi + CSRF (gaya Laravel Sanctum stateful), beri tahu saja —
> perubahannya terbatas di `src/api.js`.
>
> Satu hal yang perlu diingat kalau memakai cookie: PC kiosk tidak boleh punya
> cookie sesi siapa pun, karena dipakai bergantian oleh seluruh magang.

### Format response

Bebas, asalkan konsisten. Yang dibutuhkan frontend:

**Berhasil** — HTTP `200`/`201`, body JSON.

**Gagal** — HTTP `4xx`/`5xx`, dengan:

```json
{
  "message": "NIP atau PIN salah.",
  "errors": { "nip": ["NIP wajib diisi."] }
}
```

`message` ditampilkan langsung ke pengguna, jadi mohon ditulis dalam Bahasa
Indonesia yang enak dibaca. `errors` dipakai untuk menempelkan pesan ke
masing-masing kolom.

> Penting: backend harus tetap mengirim JSON saat error. Kalau yang terkirim
> halaman HTML (misal halaman debug Laravel), frontend hanya bisa menampilkan
> "Permintaan gagal (500)".

### Waktu

**Jam absen wajib memakai jam server.** Frontend sengaja **tidak** mengirim jam
sama sekali, justru untuk memaksa hal ini. Kalau backend memercayai jam dari
browser, siapa pun bisa memundurkan jam laptop untuk memalsukan jam absen.

Format tanggal & waktu yang diharapkan: **ISO 8601 dengan zona waktu**, contoh
`2026-10-19T08:03:00+07:00`.

### HTTPS — wajib

Akses kamera (selfie) dan lokasi di browser **hanya diizinkan pada koneksi
aman**. Kalau aplikasi disajikan lewat `http://192.168.x.x` atau domain tanpa
HTTPS, browser memblokir kamera dan **tidak ada seorang pun yang bisa absen**.
Ini tidak bisa diperbaiki dari sisi frontend.

Lokasi terkena aturan yang sama. Di alamat `http://` biasa, pilihan "di luar"
akan menampilkan pesan bahwa lokasi hanya bisa diambil lewat HTTPS — bukan
karena izinnya ditolak, tapi karena browsernya tidak menawarkan izin itu sama
sekali di koneksi tidak aman.

Koneksi yang dianggap aman: `https://` apa pun, dan `http://localhost`.

### Menyajikan hasil build frontend

`npm run build` menghasilkan folder `dist/` yang statis dan bisa ditaruh di
mana saja. Kalau ditaruh di dalam `public/` Laravel dan dijalankan dengan
`php artisan serve`, ketahuilah bahwa router bawaan `artisan serve` **selalu**
mengarahkan alamat `/` ke `public/index.php` (lihat kondisi `$uri !== '/'` di
`server.php`). Akibatnya `public/index.html` tidak akan tersaji di halaman
utama.

Karena frontend memakai **hash router** (`#/beranda`), tidak dibutuhkan aturan
catch-all apa pun. Cukup pastikan berkas `index.html` itu tersaji, misalnya
lewat satu route Laravel:

```php
Route::get('/', fn () => response()->file(public_path('index.html')));
```

---

## Endpoint

Berikut **seluruh** endpoint yang dipakai frontend. Tidak ada lagi yang berstatus
"direncanakan" — semua layar sudah jadi, jadi daftar ini sudah lengkap dan bisa
dikerjakan dari atas ke bawah.

### Sesi dan kiosk

#### `POST /masuk`

```json
// permintaan
{ "nip": "ADM001", "pin": "1111" }
```

```json
// berhasil — 200
{
  "token": "1|abcdef...",
  "pengguna": {
    "id": 1,
    "nama": "Budi Santoso",
    "email": "admin@kantor.id",
    "peran": "admin",
    "nip": "ADM001",
    "nik": "3271012345670001",
    "divisi": "Management Data",
    "lokasi_id": 1,
    "shift_id": 1,
    "cuti_kuota": 12,
    "aktif": true,
    "foto": null
  }
}
```

- `peran` hanya dua nilai: `"admin"` atau `"magang"`
- **Masuk memakai `nip` + `pin`, bukan email + kata sandi.** PIN-nya sama dengan
  yang dipakai `POST /kiosk/absen`; satu rahasia untuk dua pintu.
- `email` masih ada di objek pengguna, tapi **bukan lagi nama pengguna saat
  masuk** dan boleh berisi string kosong. Anak magang belum tentu punya email
  kantor, jadi kolomnya tidak wajib diisi admin.
- **PIN tidak boleh ikut dikembalikan.** Objek ini disimpan di `localStorage` PC
  yang dipakai bergantian.
- **Wajib dibatasi percobaannya.** PIN-nya cuma 4 sampai 6 angka dan NIP gampang
  ditebak (`MGG001`, `MGG002`, …), jadi tanpa pembatasan seluruh akun bisa
  dibuka dengan mencoba seribu kombinasi. Batasnya sama seperti kiosk: 5
  percobaan gagal per NIP, lalu tolak `429` selama 60 detik.
- Gagal: `401` dengan `message: "NIP atau PIN salah."` — **jangan** membedakan
  "NIP tidak ditemukan" dari "PIN salah", karena pesan yang membedakan keduanya
  memetakan daftar NIP satu per satu.
- `cuti_kuota` tetap ada di baris pengguna karena formulir Data Master yang
  mengisinya, tapi **tidak ada layar yang membacanya lagi**: sisa cuti dikirim
  sudah jadi lewat `GET /saya/izin`.
- `lokasi_id` dan `shift_id` disimpan untuk kiosk dan laporan, bukan untuk
  logika di layar mana pun.

> Objek `pengguna` di sini harus **sama persis** dengan yang dikembalikan
> `GET /saya/profil`. Frontend memakai keduanya silih berganti: yang pertama
> saat baru masuk, yang kedua setiap aplikasi dibuka lagi. Kalau bentuknya
> berbeda, ada kolom yang hilang setelah halaman dimuat ulang.

#### `POST /keluar`

Membatalkan token di sisi server. Response bebas.

#### `GET /saya/profil`

Data pengguna yang sedang masuk. Dipanggil sekali **setiap aplikasi dibuka**,
sebelum layar pertama dipasang — lihat bagian Autentikasi di atas.

```json
// berhasil — 200
{
  "id": 3, "nama": "Siti Rahayu", "email": "siti@kantor.id",
  "peran": "magang", "nip": "MGG002", "nik": "3271012345670002",
  "divisi": "Perhitungan", "lokasi_id": 1, "shift_id": 1,
  "cuti_kuota": 12, "aktif": true, "foto": null,
  "masuk_kerja": "2017-11-15"
}
```

- Bentuknya **sama persis** dengan objek `pengguna` di `POST /masuk`. Frontend
  memakai keduanya silih berganti: yang pertama saat baru masuk, yang kedua
  setiap aplikasi dibuka lagi. Kalau bentuknya berbeda, ada kolom yang hilang
  setelah halaman dimuat ulang.
- Dulu balasannya juga membawa `shift`, `lokasi`, dan `sisa_cuti` untuk layar
  Profil Saya. **Layar itu sudah dihapus** — anak magang tidak punya profil
  sendiri, karena semua kolomnya diatur admin — jadi ketiganya tidak perlu
  dikirim lagi.
- `401` kalau tokennya tidak dikenali lagi
- `403` kalau akunnya sudah dinonaktifkan
- Jangan dibuat mahal. Endpoint ini jalan setiap kali aplikasi dibuka.

#### `GET /admin/dashboard?tanggal=2026-10-19`

Isi layar Beranda untuk admin. Satu panggilan, karena semuanya tampil bersamaan.

```json
// berhasil — 200
{
  "tanggal": "2026-10-19",
  "hari_kerja": true,
  "keterangan_libur": null,
  "ringkasan": {
    "total": 50,
    "sudah_masuk": 47,
    "belum_masuk": 1,
    "izin": 2,
    "telat": 1
  },
  "terlambat": [
    {
      "id": 10, "nama": "Nurul Hidayah", "nip": "MGG009",
      "divisi": "Perhitungan", "shift": "Reguler",
      "waktu": "2026-10-19T08:46:52+07:00", "telat_menit": 31, "foto": null
    }
  ],
  "belum_masuk": [
    {
      "id": 35, "nama": "Rizal Fadillah", "nip": "MGG034",
      "divisi": "Pendataan", "shift": "Reguler"
    }
  ],
  "izin": [
    {
      "id": 12, "nama": "Dewi Lestari", "nip": "MGG003", "divisi": "Perhitungan",
      "jenis": "cuti", "mulai": "2026-10-19", "selesai": "2026-10-19",
      "alasan": "Keperluan keluarga"
    }
  ],
  "aktivitas": [
    {
      "id": 5646, "nama": "Lukman Hakim", "nip": "MGG038", "tipe": "pulang",
      "waktu": "2026-10-19T15:18:42+07:00", "foto": null, "lokasi": "Gudang Cikarang"
    }
  ]
}
```

Aturan yang perlu diikuti:

1. **`hari_kerja` dan `keterangan_libur` wajib ada.** Ini bukan hiasan. Dashboard
   yang dibuka pada hari Sabtu tanpa penanda ini akan menampilkan seluruh daftar
   nama di daftar "belum absen", dan admin mengira seluruh kantor membolos. Isi
   `keterangan_libur` dengan `"Hari Sabtu"`, `"Hari Minggu"`, atau keterangan
   dari tabel hari libur. Kalau `hari_kerja` bernilai `false`, kembalikan
   `belum_masuk` sebagai array kosong.
2. **`total` = `sudah_masuk` + `belum_masuk` + `izin`.** Keempatnya ditampilkan
   bersebelahan di kartu dashboard; kalau tidak berjumlah pas, akan terlihat
   salah.
3. **`telat` adalah bagian dari `sudah_masuk`**, bukan tambahan di luar.
4. Tanpa parameter `tanggal`, pakai hari ini menurut jam server.
5. `aktivitas` cukup 6 baris terbaru. Tiap baris bisa membawa foto, dan memuat
   seratus foto wajah akan membuat halaman ini berat.
6. `foto` boleh `null` — frontend menggantinya dengan lingkaran berisi inisial.
7. `aktivitas[].lokasi` untuk absen `mode: "luar"` diisi **`"Luar kantor"`**,
   bukan nama kantornya. Itulah tanda yang dibaca admin untuk tahu ada yang
   absen dari luar; `lokasi_id` di baris absennya tetap kantor tempat kiosk
   terpasang.
   Riwayat lama sebaiknya tidak menyertakan foto sama sekali.
7. Magang yang bergabung **setelah** tanggal yang diminta belum ikut dihitung.
8. **Akun admin tidak dihitung sebagai orang yang harus absen.** Dashboard yang
   menghitung semua akun akan melaporkan adminnya sendiri sebagai "belum absen"
   setiap hari, dan tidak ada layar mana pun yang bisa menghilangkannya.
   Pengecualiannya: admin yang memang punya absen atau izin di tanggal itu tetap
   ikut dihitung, supaya angkanya tetap berjumlah pas seperti aturan 2.
9. Hanya untuk `peran: "admin"`. Selain itu → `403`.

#### `GET /kiosk/lokasi?lokasi=<id>`

Identitas kiosk. Dipanggil layar absen saat dibuka, tanpa login.

```json
// berhasil — 200
{ "id": 2, "nama": "Gudang Cikarang" }
```

- `id` datang dari alamat halaman: `#/absen?lokasi=2`. Satu PC kiosk = satu
  alamat tetap, diatur saat pemasangan. Tanpa parameter, kembalikan lokasi
  pertama.
- Cuma dipakai untuk menampilkan badge nama lokasi di sudut layar. Kalau
  endpoint ini gagal, kiosk tetap bisa dipakai — jadi jangan jadikan syarat
  untuk absen.
- Nama lokasinya salah tulis? Yang tertulis di layar kiosk ikut salah. Itu
  memang gunanya: admin langsung tahu ada kiosk yang salah setel.

#### `POST /kiosk/absen`

**Ini endpoint yang paling perlu dijaga.** Tanpa login — PC kiosk tidak boleh
menyimpan token siapa pun di `localStorage`-nya.

```json
// permintaan — absen di luar, koordinat wajib ikut
{
  "nip": "MGG002",
  "pin": "2222",
  "foto": "data:image/jpeg;base64,/9j/4AAQ...",
  "lokasi_id": 2,
  "mode": "luar",
  "lintang": -6.208812,
  "bujur": 106.845599,
  "akurasi": 12
}
```

> Untuk `mode: "kantor"`, `lintang`, `bujur`, dan `akurasi` **tidak dikirim sama
> sekali**. Kalau tetap terkirim, abaikan dan simpan `null`.

```json
// berhasil — 200
{
  "tipe": "masuk",
  "nama": "Siti Rahayu",
  "nip": "MGG002",
  "waktu": "2026-10-19T08:03:00+07:00",
  "lokasi_id": 2
}
```

Aturan yang **wajib** dipatuhi backend:

1. **`nip` dan `pin` diperiksa bersamaan.** Pesan gagalnya harus sama untuk
   dua-duanya: `"NIP atau PIN tidak dikenali."` Kalau backend menjawab "NIP
   tidak ditemukan", siapa pun bisa memetakan NIP magang satu per satu.
2. **`tipe` ditentukan server**, bukan dikirim frontend. Aturannya: belum ada
   catatan `masuk` hari ini → `masuk`; sudah ada `masuk` tapi belum `pulang` →
   `pulang`; sudah lengkap → `409` dengan pesan `"<nama> sudah absen pulang hari ini."`
3. **`nip` dibandingkan tanpa peduli huruf besar-kecil.** Frontend sudah
   menaikkan hurufnya sebelum mengirim, tapi jangan bergantung pada itu.
4. **Batas percobaan.** Kiosk ini terbuka, jadi PIN 4 angka bisa ditebak
   berulang kali. Batasi per NIP dan per alamat IP — misalnya 5 kali gagal lalu
   tunggu 60 detik (status `429`).
5. **Batasi dari alamat kantor.** Ini satu-satunya yang benar-benar mencegah
   absen dari rumah. Magang bisa membuka `#/absen` dari HP-nya di rumah;
   kalau `POST /kiosk/absen` tidak dibatasi IP, PIN-lah satu-satunya penghalang
   dan 4 angka itu tidak cukup.
6. **Jam pakai jam server.** Lihat bagian Waktu di atas.
7. **`mode` berisi `"kantor"` atau `"luar"`.** Simpan apa adanya di baris absen;
   kalau tidak dikirim atau isinya lain, anggap `"kantor"`. Fotonya tetap wajib
   di dua-duanya — `mode` cuma keterangan tempat, bukan izin istimewa.
8. **`mode: "luar"` tanpa koordinat ditolak `422`.** `lintang` (−90…90) dan
   `bujur` (−180…180) wajib berupa angka; `akurasi` (meter) boleh `null` atau
   tidak dikirim sama sekali. Simpan ketiganya di baris absen. Untuk
   `"kantor"`, koordinat yang ikut terkirim diabaikan dan disimpan `null`.
   Tanpa aturan ini, "di luar" cuma tulisan yang tidak bisa diperiksa siapa pun
   saat absennya dipertanyakan.
9. Gagal validasi → `422` dengan `message`, bukan halaman HTML.

> **Kenapa koordinat tidak dipakai untuk memblokir apa pun.** Angka `akurasi`
> adalah jari-jari perkiraan dalam meter, dan sumbernya berbeda-beda. HP memakai
> GPS (biasanya 5–50 m). PC kiosk tidak punya GPS sama sekali — browsernya
> menebak dari IP atau Wi-Fi, dan hasilnya bisa meleset ratusan meter sampai
> salah kota. Menolak absen karena "terlalu jauh dari kantor" akan menolak orang
> yang memang sedang duduk di kantor. Simpan angkanya, biarkan admin menilai.
>
> Batas percobaan PIN dan pembatasan IP (poin 4 dan 5) tetap wajib. Koordinat
> bukan pengganti keduanya: angkanya datang dari browser dan bisa dipalsukan
> dengan ekstensi apa pun.

---

### Data master

Empat layar di bagian **Data Master** memakai pola yang sama. Aturan berikut
berlaku untuk keempatnya:

- **`PUT` bersifat menambal.** Kirim hanya kolom yang berubah; kolom yang tidak
  ikut tidak disentuh. Tombol Aktifkan/Nonaktifkan di layar Anak Magang cuma
  mengirim `{ "aktif": false }` — endpoint yang menuntut kiriman lengkap akan
  menolaknya, dan penonaktifannya tidak pernah terjadi.
- **Tidak ada `DELETE` untuk magang dan lokasi.** Keduanya dirujuk oleh baris
  absen. Menghapus sebuah lokasi membuat absen orang-orang yang bekerja di sana
  kehilangan tempatnya; menghapus magang membuat riwayat kehadirannya
  menggantung tanpa pemiliknya. Menutup lokasi atau memberhentikan orang berarti
  mengubah `aktif` menjadi `false`.
- **Hari libur dan shift punya `DELETE`, syaratnya berbeda.** Hari libur tidak
  dirujuk siapa pun, jadi selalu boleh dihapus. Shift hanya boleh dihapus kalau
  belum ada yang memakainya — rinciannya di `DELETE /admin/shift/{id}`.
- Semua endpoint di bagian ini **hanya untuk admin**. Selain admin → `403`,
  token tidak dikenali → `401`.

> **Nama yang ditampilkan diambil dari tabel magang, bukan dari baris
> absennya.** Baris absen menyimpan `nama` dan `nip` sebagai salinan beku saat
> orang itu absen — itu benar dan memang perlu untuk arsip. Tapi kalau yang
> ditampilkan adalah salinan itu, ejaan nama yang baru diperbaiki admin tidak
> akan pernah terlihat di dashboard dan laporan. Ambil nama terkini lewat
> `pengguna_id`-nya, dan pakai salinan beku itu hanya sebagai cadangan kalau
> penggunanya sudah tidak ada.

#### `GET /admin/magang`

```json
// berhasil — 200
{
  "data": [
    {
      "id": 2, "nama": "Andi Prasetyo", "email": "andi.prasetyo@kantor.id",
      "peran": "magang", "nip": "MGG001", "nik": "3271012345670003",
      "divisi": "Pendataan", "shift_id": 1, "lokasi_id": 1,
      "shift": "Reguler", "lokasi": "Kantor Pusat",
      "masuk_kerja": "2016-02-08", "cuti_kuota": 12, "aktif": true, "foto": null
    }
  ],
  "divisi": ["Pendataan", "Perhitungan", "Management Data"]
}
```

- Kirim **semuanya**, tanpa halaman dan tanpa penyaring. Jumlahnya masih
  puluhan, dan penyaringan nama dikerjakan di browser sehingga terasa
  seketika. Kalau jumlahnya suatu saat ratusan, tambahkan `?cari=` dan
  `?halaman=` **di sini** — bukan di layarnya.
- **`pin` tidak boleh ikut sama sekali.** Layar ini hanya bisa mengisi yang
  baru, tidak pernah membaca yang lama. PIN yang bocor ke browser sama saja
  dengan tidak punya PIN — dan sekarang PIN itu sekaligus kunci masuk akun,
  sementara PC kiosk dipakai bergantian.
- `shift` dan `lokasi` adalah namanya, untuk ditampilkan. `shift_id` dan
  `lokasi_id` tetap dikirim karena formulir membutuhkannya.
- `divisi` di akar response adalah **daftar divisi yang sah** — lihat di bawah.
- Urutannya bebas. Frontend tidak mengandalkan urutan apa pun dari endpoint ini;
  penyaringan dilakukan di sana.

**`divisi` adalah pilihan tetap, bukan teks bebas.** Isinya hanya tiga:

| `divisi` |
|---|
| `Pendataan` |
| `Perhitungan` |
| `Management Data` |

Huruf besar di awal, persis seperti itu. Daftarnya **ikut dikirim di akar
response ini** (`"divisi": [...]`), dan formulir di layar membangun pilihan
dropdown-nya dari daftar itu — jadi kalau nanti divisinya bertambah, kamu cukup
mengubahnya di backend dan frontend ikut sendiri tanpa perlu diubah.

Dulu kolom ini bernama `departemen` dan diketik bebas. Itu dihapus: dengan teks
bebas, `Management Data`, `manajemen data`, dan `Mgmt Data` hidup berdampingan
pada orang yang berbeda, dan pertanyaan "siapa saja di Perhitungan?" jadi tidak
bisa dijawab tanpa membersihkan datanya dulu.

#### `POST /admin/magang`

```json
// permintaan
{
  "nama": "Uji Magang", "nip": "MGG050", "email": "uji@kantor.id",
  "divisi": "Pendataan", "nik": "3271012345670004", "peran": "magang",
  "shift_id": 1, "lokasi_id": 1, "masuk_kerja": "2026-10-19",
  "cuti_kuota": "12", "pin": "9090"
}
```

- `pin` 4–6 angka dan **wajib diisi saat membuat**. Ini satu-satunya rahasia
  yang dimiliki magang: dipakai untuk absen di kiosk sekaligus untuk masuk
  aplikasi. Simpan sebagai hash, dan sampaikan angka aslinya ke orangnya.
- `email` **boleh dikosongkan** — kirim `""` saja. Kolomnya tidak lagi dipakai
  untuk masuk; anak magang belum tentu punya email kantor, jadi jangan
  menjadikannya wajib.
- `nik` juga boleh kosong, tapi kalau diisi harus **16 angka** — selain itu
  `422`. NIK bukan kunci apa pun di aplikasi ini: dia data diri yang tampil di
  Data Master dan ikut di CSV rekap, jadi tidak perlu unik. Simpan sebagai teks,
  bukan angka: nol di depan harus tetap ada.
- `divisi` wajib salah satu dari tiga nilai tetap di atas; selain itu `422`.
  Sebutkan daftar yang sah di pesannya — endpoint ini yang paling mungkin
  dipanggil manual waktu kamu menguji.
- `409` kalau NIP sudah dipakai. Pesannya harus menyebut mana yang bentrok:
  `"NIP MGG050 sudah dipakai magang lain."` — ada beberapa kotak isian di layar,
  dan pesan yang tidak menyebut kolomnya memaksa admin menebak.
- `409` juga kalau email diisi dan sudah dipakai orang lain. Kalau kosong, tidak
  ada yang perlu diperiksa — dua orang tanpa email bukan bentrok.
- `409` juga kalau PIN-nya sudah dipakai orang lain. Dua orang dengan PIN sama
  membuat absen tidak jelas milik siapa.
- NIP sebaiknya disimpan huruf besar. `"mgg001"` dan `"MGG001"` adalah orang
  yang sama, dan frontend sudah menaikkan hurufnya sebelum mengirim — tapi
  jangan bergantung pada itu.
- Berhasil `201`, kembalikan barisnya **tanpa** `pin`.

#### `PUT /admin/magang/{id}`

```json
// contoh: sekadar mengaktifkan kembali
{ "aktif": true }
```

Dua aturan khusus di sini:

- **`pin` yang kosong berarti "biarkan yang lama".** Jangan menimpa jadi kosong.
  Tanpa aturan ini, mengubah nama seseorang akan sekaligus menghapus PIN-nya,
  dan dia tidak bisa absen lagi besok pagi — sekaligus tidak bisa masuk aplikasi.
  Tombol Nonaktifkan juga mengirim kiriman sebagian (`{ "aktif": false }`), jadi
  endpoint ini memang harus tahan terhadap kolom yang tidak ikut terkirim.
- Server **wajib menolak** admin yang menurunkan perannya sendiri atau
  menonaktifkan akunnya sendiri (`422`). Kalau tidak, satu-satunya admin bisa
  mengunci dirinya keluar, dan tidak ada siapa pun yang tersisa untuk
  mengembalikannya. Frontend juga sudah tidak menampilkan tombolnya, tapi itu
  bukan pengaman.

Menonaktifkan akun **tidak menyentuh riwayat absennya** — yang berhenti adalah
hak masuknya, bukan catatan kehadirannya selama bekerja. Konsekuensinya yang
wajib diingat: pemeriksaan `aktif` harus ada di `POST /masuk` **dan** di
`POST /kiosk/absen`. Kalau hanya ada di `GET /saya/profil`, orang yang baru
dinonaktifkan masih bisa masuk hari itu juga.

#### `GET /admin/lokasi`

```json
// berhasil — 200
{
  "data": [
    {
      "id": 1, "nama": "Kantor Pusat", "aktif": true, "jumlah_magang": 37,
      "alamat": "Jl. Jenderal Sudirman No. 1, Jakarta"
    }
  ]
}
```

- `jumlah_magang` = jumlah magang **aktif** di lokasi itu. Dihitung server.
  Dipakai layar supaya admin tahu akibatnya sebelum menutup sebuah lokasi.
- Kembalikan **semua**, termasuk yang sudah nonaktif. Layar menampilkannya, dan
  formulir magang perlu tetap bisa menampilkan lokasi yang sudah dipilih
  walaupun lokasinya keburu ditutup.

#### `POST /admin/lokasi` · `PUT /admin/lokasi/{id}`

```json
{ "nama": "Kantor Bandung", "alamat": "Jl. Asia Afrika No. 3", "aktif": "true" }
```

- `nama` wajib dan tidak boleh kembar, dibandingkan **tanpa** membedakan huruf
  besar-kecil
- `aktif` datang sebagai teks `"true"`/`"false"`, karena isian formulir selalu
  berupa teks
- Lokasi nonaktif **tidak boleh muncul di pilihan kiosk**. Alamat kiosk yang
  menyebut lokasi nonaktif harus jatuh ke lokasi aktif pertama, bukan tetap
  menerima absen di lokasi yang sudah tutup.

#### `GET /admin/shift`

```json
// berhasil — 200
{
  "data": [
    {
      "id": 1, "nama": "Reguler", "masuk": "08:00", "pulang": "17:00",
      "toleransi_menit": 15, "aktif": true, "jumlah_magang": 36
    }
  ]
}
```

#### `POST /admin/shift` · `PUT /admin/shift/{id}`

```json
{ "nama": "Reguler", "masuk": "08:00", "pulang": "17:00", "toleransi_menit": 15, "aktif": "true" }
```

- `masuk` dan `pulang` format `HH:MM` 24 jam
- **Jangan tolak `pulang` yang lebih kecil daripada `masuk`.** Untuk kantor yang
  cuma punya satu shift siang validasi itu kelihatan masuk akal, tapi yang kamu
  validasi adalah bentuk jam, bukan jam kantornya: shift malam 22.00–06.00 tetap
  bentuk yang sah, dan menolaknya cuma menutup pintu tanpa melindungi apa pun
- `toleransi_menit` antara 0 dan 120
- Mengubah shift berlaku untuk absen **berikutnya**, bukan yang sudah tercatat.
  `telat_menit` dihitung sekali saat orang absen lalu disimpan — kalau dihitung
  ulang tiap kali laporan dibuka, mengubah shift besok akan menulis ulang status
  telat kemarin.

#### `DELETE /admin/shift/{id}`

```json
// berhasil — 200
{ "ok": true }
```

Shift boleh dihapus sungguhan, bukan cuma dinonaktifkan — tapi hanya kalau tidak
ada yang menunjuk ke sana. Tiga penolakan, semuanya `409`:

| Keadaan | Balasan |
|---|---|
| Ini shift terakhir yang tersisa | "Ini satu-satunya shift. Tanpa shift, tidak ada yang bisa dipilih saat menambah anak magang." |
| Masih ada magang dengan `shift_id` ini | "Shift ini masih dipakai 3 orang. Pindahkan mereka ke shift lain dulu, atau nonaktifkan shift ini." |
| Ada baris absen dengan `shift_id` ini | "Shift ini dipakai 12 catatan absen. Menghapusnya membuat riwayat itu kehilangan jam kerjanya — nonaktifkan saja." |

Ketiganya bukan formalitas. Frontend menampilkan nama shift dengan mencari
`shift_id` ke tabel shift, jadi baris yang menunjuk ke shift yang sudah tidak
ada akan tampil sebagai "—", dan tidak ada layar yang bisa menjelaskan kenapa.
Untuk shift lama yang sudah terlanjur dipakai, yang berlaku adalah
`PUT { "aktif": false }` — tombol Nonaktifkan.

#### `GET /admin/hari-libur`

```json
// berhasil — 200
{ "data": [ { "id": 1, "tanggal": "2026-01-01", "keterangan": "Tahun Baru Masehi" } ] }
```

- Terurut naik menurut tanggal. Daftar tanggal yang tidak berurut membuat admin
  harus memindai seluruh baris untuk tahu hari libur berikutnya kapan.
- Sabtu dan Minggu tidak perlu didaftarkan di sini; keduanya libur dengan
  sendirinya.

#### `POST /admin/hari-libur` · `PUT /admin/hari-libur/{id}` · `DELETE /admin/hari-libur/{id}`

```json
{ "tanggal": "2026-10-19", "keterangan": "Cuti bersama" }
```

- `tanggal` wajib `YYYY-MM-DD` dan tidak boleh kembar
- Menambah atau menghapus hari libur **langsung mengubah** hasil
  `GET /admin/dashboard`: tanggal itu berhenti dihitung sebagai hari kerja,
  tidak ada lagi yang dianggap "belum absen", dan tidak ada lagi yang dihitung
  alpha pada tanggal itu.

---

### Izin & cuti

Tiga hal yang wajib sama di seluruh sistem, dan ketiganya gampang salah:

1. **`jenis` berisi `'cuti'`, `'izin'`, atau `'sakit'`.** Ketiganya dicatat
   dengan bentuk yang sama, tapi hanya **`cuti`** yang memotong jatah. Izin dan
   sakit tidak. Kalau ketiganya dipotongkan, sisa cuti tidak bisa dipercaya —
   dan sisa cuti itulah angka yang paling sering ditanyakan magang.
2. **Jatah dihitung dalam hari kerja, bukan hari kalender.** Cuti Jumat sampai
   Senin adalah 2 hari, bukan 4. Sabtu, Minggu, dan tanggal di
   `/admin/hari-libur` tidak dihitung. Satu definisi dipakai di dua tempat:
   layar Izin & Cuti dan laporan bulanan.
3. **Pengajuan yang masih `menunggu` ikut dihitung** sebagai pemakaian jatah.
   Kalau tidak, satu orang bisa mengajukan tiga cuti untuk tanggal yang sama
   dan admin baru sadar di pengajuan ketiga.

Bentuk kuota selalu begini:

```json
{ "jatah": 12, "terpakai": 3, "menunggu": 2, "sisa": 7 }
```

`sisa = jatah - terpakai - menunggu`. Jangan kirim `sisa` saja — layar
menampilkan ketiganya berdampingan, dan angka yang tidak bisa dijumlahkan
sendiri oleh pembacanya akan terlihat seperti salah hitung.

#### `GET /admin/izin?status=menunggu`

`status` berisi `menunggu` · `disetujui` · `ditolak` · `semua`. Tanpa parameter,
anggap `menunggu`.

```json
{
  "data": [
    {
      "id": 124,
      "pengguna_id": 9,
      "nama": "Nurul Hidayah", "nip": "MGG009",
      "divisi": "Perhitungan",
      "jenis": "cuti",
      "mulai": "2026-10-26", "selesai": "2026-10-27",
      "hari_kerja": 2,
      "alasan": "Keperluan keluarga di luar kota",
      "status": "menunggu",
      "diajukan": "2026-10-18T09:15:00+07:00",
      "catatan_admin": null,
      "diputuskan": null
    }
  ],
  "jumlah": { "menunggu": 6, "disetujui": 121, "ditolak": 0, "semua": 127 }
}
```

- **`jumlah` adalah jumlah seluruh status**, bukan cuma yang sedang tersaring.
  Angka itulah yang dipakai tab di layar. Tab yang menghitung sendiri dari
  daftar tersaring akan selalu menulis `0` untuk status yang tidak sedang dibuka,
  dan terlihat seperti tidak ada pengajuan sama sekali.
- Urutkan terbaru di atas (`diajukan` menurun). Admin membuka layar ini untuk
  memutuskan, bukan membaca arsip dari awal.
- **Nama dan divisi diambil dari tabel pengguna lewat join**, bukan dari
  salinan di baris pengajuannya. Perbaikan ejaan nama harus langsung terlihat di
  semua layar. Salinan di baris pengajuan boleh tetap disimpan sebagai riwayat,
  tapi jangan pernah dipakai untuk ditampilkan.
- `hari_kerja` dihitung server, tidak dikirim balik oleh frontend. Aturannya
  sama dengan poin 2 di atas.

#### `POST /admin/izin/{id}/setujui` · `POST /admin/izin/{id}/tolak`

```json
// tolak — catatan wajib
{ "catatan": "Beban kerja sedang tinggi pada tanggal itu." }
```

Yang wajib ada di server, bukan cuma di layar:

- **`404`** kalau id-nya tidak ada.
- **`409`** kalau pengajuannya sudah diputuskan. Menekan Setujui dua kali tidak
  boleh mencatat keputusan kedua di atas yang pertama — setelah itu tidak ada
  cara tahu mana yang berlaku.
- **`422`** kalau `tolak` tanpa `catatan` yang berarti (minimal 4 karakter).
  Alasannya dibaca magang di layar Izin & Cuti; penolakan tanpa alasan akan
  ditanyakan lewat pesan pribadi, dan jawabannya tidak tercatat di mana pun.
- Saat **menyetujui**, periksa ulang jatahnya (`422`, sebut sisa dan jumlah
  yang diajukan) dan pastikan tidak ada pengajuan lain yang **sudah disetujui**
  pada tanggal yang tumpang tindih (`409`). Bisa ada dua pengajuan yang
  masing-masing muat tapi jumlahnya melebihi jatah kalau keduanya disetujui.
  Kalau pemeriksaannya cuma di sisi magang, yang tahu masalahnya justru bukan
  yang bisa memutuskan.
- Periksa ulang juga bahwa rentangnya masih memuat hari kerja (`422`).
  Pengajuan yang disetujui setelah seluruh tanggalnya lewat tidak mengurangi
  apa pun dan tidak boleh tercatat sebagai cuti terpakai.
- Isi `diputuskan`, dan `catatan_admin` (untuk `setujui` boleh `null`).

#### `GET /saya/izin`

```json
{
  "data": [ /* seluruh pengajuan milik yang sedang masuk, bentuk sama seperti di atas */ ],
  "kuota": { "jatah": 12, "terpakai": 3, "menunggu": 2, "sisa": 7 }
}
```

Urutkan terbaru di atas. `catatan_admin` **wajib ikut** — itu satu-satunya
tempat magang bisa membaca kenapa pengajuannya ditolak.

#### `POST /saya/izin`

```json
// permintaan
{
  "jenis": "cuti",
  "mulai": "2026-10-20", "selesai": "2026-10-21",
  "alasan": "Menghadiri acara keluarga di Bandung."
}
```

| Diperiksa | Status | Kenapa |
|---|---|---|
| `jenis` termasuk tiga yang dikenal | `422` | nilai lain membuat laporan bingung |
| `mulai` dan `selesai` berbentuk `YYYY-MM-DD` | `422` | |
| `selesai >= mulai` | `422` | rentang terbalik |
| **`selesai >= hari ini`** | `422` | lihat catatan di bawah |
| `alasan` minimal 4 karakter | `422` | |
| rentangnya memuat hari kerja | `422` | Sabtu–Minggu saja tidak perlu disetujui |
| tidak ada absen pada hari kerja di rentang itu | `409` | lihat catatan di bawah |
| tidak ada pengajuan lain yang tumpang tindih | `409` | **termasuk yang masih `menunggu`** |
| jatah cukup, kalau `jenis` = `cuti` | `422` | sebut sisa dan jumlah yang diajukan |

**Yang diperiksa `selesai`, bukan `mulai`.** Sakit biasanya baru dilaporkan
setelah sembuh. Memeriksa `mulai` membuat laporan sakit sehari terlambat selalu
ditolak, dan magang akan menyerah lalu tidak melapor sama sekali. Yang tidak
masuk akal hanya pengajuan yang **seluruhnya** sudah lewat.

**Kenapa hari yang sudah ada absennya ditolak (`409`).** Laporan bulanan
menghitung hari yang punya absen masuk sebagai *hadir*. Cuti yang disetujui
untuk hari itu akan memotong jatah tanpa pernah muncul sebagai cuti di laporan
mana pun. Angka yang tidak bisa dipertemukan dengan catatannya akan ditanyakan
ulang oleh magangnya, dan tidak ada yang bisa menjawab.

**Kenapa tumpang tindih diperiksa sampai yang masih `menunggu`.** Kalau cuma
yang `disetujui` yang dihitung, satu orang bisa mengajukan tiga cuti untuk
tanggal yang sama dan admin baru sadar di pengajuan ketiga — setelah dua
keputusan yang salah.

Balasan `201`: baris barunya, ditambah `hari_kerja`.

### Riwayat absen magang

#### `GET /saya/absen?bulan=2026-10`

```json
{
  "bulan": "2026-10",
  "hari_kerja": 13,
  "ringkasan": {
    "hadir": 13, "tepat": 9, "telat": 4, "telat_menit": 149,
    "izin": 0, "alpha": 0
  },
  "data": [
    {
      "tanggal": "2026-10-01", "keterangan_libur": null,
      "masuk": "2026-10-01T08:43:00+07:00",
      "pulang": "2026-10-01T17:07:00+07:00",
      "telat_menit": 28, "status": "telat",
      "keterangan_izin": null, "alasan_izin": null,
      "lokasi": "Kantor Pusat", "foto": null,
      "mode": "kantor", "lintang": null, "bujur": null, "akurasi": null
    }
  ]
}
```

- `data` memuat **seluruh hari dalam bulan itu**, termasuk Sabtu, Minggu, dan
  tanggal merah, dengan `status: "libur"` dan `keterangan_libur` berisi
  `"Hari Sabtu"` / `"Hari Minggu"` / nama liburnya. Tanggal yang bolong dari
  daftar membuat orang mengira ada catatan yang hilang, dan pertanyaannya sampai
  ke admin.
- Urutkan **menaik** menurut tanggal. Ini satu-satunya daftar di aplikasi yang
  dibaca dari atas ke bawah sebagai kalender.
- `status` hanya berisi: `tepat` · `telat` · `izin` · `cuti` · `sakit` ·
  `alpha` · `libur` · `belum`.
- `hari_kerja` dihitung **sejak magang itu masuk kerja**, bukan seluruh bulan.
  Magang yang baru bergabung tanggal 10 tidak punya 13 hari kerja di bulan
  itu, dan memakai angka bulan penuh membuat rekapnya terlihat seperti banyak
  mangkir.
- `telat_menit` dibaca dari baris absennya, **tidak dihitung ulang** dari `masuk`
  dan jam shift. Tarifnya bisa berubah, dan angka yang ditampilkan saat ini harus
  angka yang berlaku saat itu.
- `mode` berisi `"kantor"` atau `"luar"`; baris lama yang belum punya kolom ini
  dikirim sebagai `"kantor"`. Untuk `"luar"`, `lokasi` diisi `"Luar kantor"` dan
  `lintang`/`bujur`/`akurasi` berisi titik yang dikirim kiosk — frontend memakai
  koordinat itu untuk menautkan barisnya ke peta OpenStreetMap, jadi kirim
  angkanya apa adanya. `akurasi` boleh `null` kalau perangkat tidak
  melaporkannya. Baris tanpa absen (izin, libur, alpha) cukup mengirim ketiga
  kolom ini sebagai `null`.

**Urutan prioritas status wajib sama persis**, dan urutannya begini:

```
libur  >  tepat/telat  >  izin/cuti/sakit  >  belum (hari ini)  >  alpha (hari lewat)
```

Absen **di atas** izin. Satu hari kerja tidak boleh terhitung dua kali sebagai
hadir *dan* cuti — dan kalau suatu saat dua-duanya ada, yang menang adalah
absen, karena itu yang benar-benar terjadi. Persis di bawah absen ada izin,
supaya magang yang lupa absen tapi sudah punya izin disetujui tidak dicap
alpha.

Konsekuensi yang paling gampang terlewat: **kuota cuti hanya boleh dihitung dari
hari yang benar-benar berstatus `cuti`**, bukan dari pengajuan yang disetujui.
Pengajuan yang disetujui untuk hari yang ternyata ada absennya tidak memotong
jatah.

### Keamanan akun sendiri

**Tidak ada endpoint untuk mengganti PIN atau kata sandi sendiri — dan tidak ada
kata sandi sama sekali.** Bagian ini dulu berisi `PUT /saya/pin` dan
`PUT /saya/sandi`; keduanya dihapus.

Alasannya:

- **PIN dipegang admin.** Dia yang menyetelnya saat akun dibuat, dan dia yang
  meresetnya kalau magangnya lupa. Membiarkan magang menggantinya sendiri tidak
  menambah keamanan — orang yang cuma melihat PIN di kiosk tidak bisa
  menggantinya, karena endpoint lama itu butuh login dulu — dan yang tersisa
  hanya jalur "lupa PIN baru" yang ujungnya tetap ke meja admin.
- **Kata sandi dihapus seluruhnya** karena masuk memakai NIP + PIN. Satu rahasia
  untuk dua pintu, dan tidak ada kata sandi yang perlu dikarang admin setiap
  kali membuat akun.

Akibatnya akun magang benar-benar hanya bisa dilihat. Yang masih bisa dia
lakukan cuma dua: mengajukan izin (`POST /saya/izin`) dan melihat datanya
sendiri.

> Kalau PIN perlu diganti, itu lewat `PUT /admin/magang/{id}` — kirim `pin`
> yang baru, dan biarkan kolom lain apa adanya.

> **Batas 4–6 angka harus sama di server, di layar Data Master, dan di kiosk.**
> Versi pertama kiosk memotong isiannya di 4 angka, jadi PIN lima atau enam
> angka yang sudah diterima server tidak akan pernah bisa diketik — tanpa pesan
> apa pun, karena angkanya hanya tidak muncul.

### Rekap & laporan

#### `GET /admin/laporan?bulan=2026-10`

```json
{
  "bulan": "2026-10",
  "hari_kerja": 13,
  "ringkasan": {
    "magang": 50, "hadir": 606, "telat": 56, "telat_menit": 1551,
    "izin": 24, "alpha": 14
  },
  "data": [
    {
      "pengguna_id": 7, "nip": "MGG006", "nama": "Agus Firmansyah",
      "divisi": "Management Data", "nik": "3271012345670006",
      "shift": "Reguler", "aktif": true, "hari_kerja": 13,
      "hadir": 12, "telat": 2, "telat_menit": 52,
      "izin": 0, "cuti": 0, "sakit": 1, "alpha": 0
    }
  ]
}
```

- `hadir` = `tepat` + `telat`. `izin`, `cuti`, dan `sakit` dikirim **terpisah**
  dan tidak digabung, supaya masih bisa ditelusuri saat angkanya dipertanyakan.
- `hari_kerja` di akar response = jumlah hari kerja **di bulan itu** (13 untuk
  Oktober sampai tanggal 19). Itu **bukan** penyebut kartu "Kehadiran" di layar:
  kartu itu menjumlahkan `hari_kerja` tiap baris, karena `hadir` juga
  dijumlahkan per orang dan "606 dari 13" bukan perbandingan yang berarti.
  Kirim saja keduanya — yang satu untuk konteks, yang satu untuk kartunya.
- Urutkan menurut nama.
- **Magang yang sudah dinonaktifkan tetap muncul kalau bulan itu dia punya
  catatan.** Kalau tidak, orang yang berhenti tanggal 10 hilang dari rekap bulan
  itu dan angkanya tidak bisa dicocokkan dengan absennya yang jelas ada. Tandai
  dengan `aktif: false` — layar menulisnya sebagai "(nonaktif)".
- **Akun admin tidak muncul kalau bulan itu dia tidak punya catatan**, dengan
  alasan yang sama seperti di dashboard. Admin yang ternyata ikut absen tetap
  muncul, jadi tidak ada catatan yang hilang.
- `ringkasan.izin` = jumlah `izin` + `cuti` + `sakit` dari seluruh baris. Ini
  pengecualian dari aturan "jangan digabung": untuk satu angka besar di kartu
  ringkasan, yang dibaca cuma "berapa hari orang tidak masuk".
- Ukurannya 50 orang × 1 bulan. Aman dihitung saat permintaan datang. Kalau
  magangnya jadi ratusan, ini yang pertama perlu di-cache — bukan yang pertama
  perlu ditambah parameter.

#### `GET /admin/laporan/harian?bulan=2026-10&pengguna_id=7`

```json
{
  "bulan": "2026-10",
  "pengguna": { /* baris pengguna tanpa pin */ },
  "data": [ /* sama persis dengan GET /saya/absen */ ]
}
```

Bentuk `data`-nya **wajib sama persis** dengan `GET /saya/absen`. Admin dan
magang harus melihat hari yang sama dengan kolom yang sama; kalau berbeda,
salah satu dari mereka akan merasa ada yang disembunyikan. Cara paling murah
memastikan itu: satu fungsi yang dipakai dua endpoint.

`pengguna_id` wajib (`422` kalau kosong), `404` kalau orangnya tidak ada.

### Ekspor CSV

**Tidak perlu endpoint.** Berkasnya disusun di browser dari balasan
`GET /admin/laporan`, lalu diunduh lewat `Blob`. Dari sisi backend tidak ada
yang perlu ditambahkan.

Kalau nanti ada yang bertanya kenapa berkasnya terlihat aneh di Excel:
pemisahnya **titik koma**, dan isinya diawali BOM UTF-8. Excel di komputer
berbahasa Indonesia memakai koma sebagai pemisah desimal, jadi berkas berpemisah
koma membuka seluruh isinya di satu kolom.

### Yang belum ada, dan sengaja dibiarkan begitu

`GET /admin/anomali` — absen mencurigakan: `ip`, `tanpa_foto`, `pin_salah_berulang`.
Tidak ada layar yang memakainya, jadi endpoint-nya belum dibuat.

Dulu barisnya juga direncanakan memuat `jarak_m` — jarak absen dari titik kantor.
Rencana itu dibatalkan: kiosk ini PC kantor yang tidak berpindah, jadi titik
kantornya sudah pasti, dan akurasi PC tidak cukup untuk menghitung jarak yang
berarti. Yang sekarang ada hanyalah koordinat yang **dilaporkan sendiri** saat
magang memilih "di luar" (lihat `POST /kiosk/absen`). Koordinat itu untuk
menunjukkan di mana orangnya, bukan untuk memblokir atau menuduh.

---

## Foto selfie — titik yang paling rawan

**Sudah diputuskan dan sudah jalan:** base64 di dalam body JSON. Yang benar-benar
dikirim frontend:

- **640×480 piksel**, format JPEG, mutu **0,7**
- Wajah masih jelas dikenali, berkasnya kecil. Dengan webcam sungguhan
  hasilnya sekitar **40–60 KB**, jadi sekitar **55–80 KB** setelah base64.
  (Angka ini diukur dari wajah asli, bukan dari kamera palsu Chrome yang
  gambarnya rata dan cuma berbobot 6 KB.)
- Gambarnya **dicerminkan**, supaya sama dengan yang dilihat magang di
  pratinjau. Jangan dibalik lagi di backend — nanti terbalik dua kali.
- Diawali `data:image/jpeg;base64,`. Panjangnya ± 23 karakter; kalau backend
  menyimpannya mentah-mentah ke kolom, buang dulu awalan itu.

Keputusan ini diambil sadar meski base64 sekitar 33% lebih boros daripada
`multipart/form-data`: hasilnya satu permintaan JSON yang sama seperti endpoint
lain, tidak perlu jalur unggah terpisah, dan `src/api.js` tidak perlu diubah.
Dengan ~100 absen sehari, selisihnya tidak berarti.

Yang perlu dipastikan dari sisi backend:

1. Batas ukuran body cukup. Kalau pakai PHP, `post_max_size` dan
   `upload_max_filesize` perlu di atas 1 MB supaya ada ruang lega.
2. Kalau `/api/kiosk/absen` melakukan validasi dan gagal, **jangan** mengembalikan
   HTML — frontend tidak akan bisa menampilkan pesannya.

Simpan foto di penyimpanan privat, bukan folder yang bisa diakses publik.
Foto wajah magang tidak boleh bisa dibuka siapa pun yang menebak URL-nya.
