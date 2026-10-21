# Panduan Perbaikan — Kesesuaian dengan `PANDUAN-BACKEND.md`

Dokumen ini hanya membahas **hal-hal yang belum sesuai** dengan
`PANDUAN-BACKEND.md` dan hal-hal yang harus diselesaikan sebelum aplikasi
dipublikasikan. Bug/hardening di luar PANDUAN dicatat terpisah di bagian akhir.

## Ringkasan prioritas

| Prioritas | Item | Jenis |
|---|---|---|
| P0 | Build produksi tidak boleh memakai mode tiruan | Deploy / keamanan |
| P0 | Rate limit PIN dan pembatasan kiosk | Backend |
| P0 | PIN di-hash, tidak pernah dikembalikan ke browser | Backend |
| P0 | Token acak, punya masa berlaku, dan dicabut saat logout | Backend |
| P0 | Nominatim dipanggil dari server, bukan browser | Backend |
| P1 | `sisa` cuti harus mengurangi pengajuan `menunggu` | Backend + mock |
| P1 | `401` sesi habis harus mengembalikan ke login | Frontend + kontrak |
| P1 | Waktu dashboard memakai `Asia/Jakarta` | Frontend |
| P1 | Perbedaan perilaku GPS dengan PANDUAN | Keputusan produk + dokumen |
| P2 | PIN di Data Master tidak boleh terlihat | Frontend |
| P2 | Sanitasi CSV | Frontend |
| P2 | CSP dan header keamanan | Deploy |

---

## Keputusan yang harus diambil lebih dulu

Sebelum coding, tiga hal ini harus diputuskan karena memengaruhi desain.

### 1. Kiosk hanya di kantor, atau juga dipakai untuk dinas luar?

PANDUAN mengatakan:

- `POST /kiosk/absen` wajib dibatasi dari IP kantor (`PANDUAN-BACKEND.md:183-184`,
  `:627`).
- Tetapi mode `luar` untuk dinas luar bisa saja dilakukan jauh dari kantor
  (`:217-219`).

Dua hal ini bisa bertabrakan. Pilih salah satu (kita akan memakai opsi B):

**Opsi A — kiosk benar-benar PC tetap di kantor**

- Pasang allowlist IP/CIDR kantor.
- Kiosk hanya bisa dipakai dari jaringan kantor.
- Mode `luar` dipakai untuk orang yang tetap absen lewat kiosk kantor, atau
  memang bukan skenario lapangan.

**Opsi B — kiosk/tablet juga dipakai di lapangan**

- Jangan jadikan IP kantor satu-satunya kontrol.
- Gunakan **kiosk token/device enrollment** (perangkat terdaftar), ditambah
  PIN, foto, GPS, dan validasi server.
- Mode `luar` wajib GPS; mode `kantor` hanya boleh dari perangkat/jaringan
  kantor.
- Perbarui PANDUAN agar tidak lagi menyebut IP kantor sebagai satu-satunya
  syarat.

Jangan mengerjakan allowlist IP sebelum keputusan ini diambil, karena bisa
memblokir absen dinas luar yang sah.

### 2. GPS diminta untuk kedua mode, atau hanya mode luar?

Kode saat ini meminta GPS saat form kiosk dibuka, untuk **kedua mode**
(`src/views/absen.js:336`). Ini konsekuensi fitur alamat untuk absen
“Di perusahaan” dan “Di luar”.

PANDUAN masih mengatakan GPS diminta **hanya setelah memilih “Di luar”**
(`PANDUAN-BACKEND.md:205-207`, `:1007`).

Karena fitur alamat untuk kedua mode sudah diminta, rekomendasi saya:

- **Pertahankan perilaku kode**, lalu perbarui PANDUAN.
- Tulis bahwa GPS diminta saat form dibuka (atau saat NIP mulai diketik), untuk
  kedua mode, dan mode `luar` tetap wajib.
- Jelaskan konsekuensi privasi: kiosk akan meminta lokasi kepada orang yang
  lewat. Kalau ingin lebih sopan, picu GPS saat kolom NIP pertama kali
  difokuskan/diketik, bukan tepat saat halaman tampil.

Jangan mengembalikan GPS hanya ke mode `luar` tanpa keputusan produk, karena
alamat untuk mode `kantor` akan hilang.

### 3. `401` dipakai untuk apa?

Saat ini `401` dipakai untuk dua hal berbeda:

- PIN/NIP salah (`KONTRAK-API.md:197`)
- Token sesi tidak valid/kedaluwarsa (`PANDUAN-BACKEND.md:293-294`)

Ini membuat penanganan global `401` berbahaya: kalau semua `401` diarahkan ke
login, PIN salah di kiosk juga akan melempar kiosk ke halaman login.

Rekomendasi:

- `401` hanya untuk **token tidak ada/tidak valid/kedaluwarsa** pada endpoint
  yang membutuhkan sesi.
- Kredensial login/kiosk salah memakai `401` **hanya jika** frontend mengecualikan
  endpoint `/masuk` dan `/kiosk/absen` dari redirect global.
- Lebih baik lagi: tambahkan `code` di body error, misalnya
  `"kode": "kredensial_salah"` vs `"kode": "sesi_habis"`, supaya frontend tidak
  menebak dari status saja.

---

## P0 — Wajib sebelum produksi

### P0-1. Pastikan build produksi tidak memakai mode tiruan

**Masalah**

`src/api.js:5`:

```js
export const MODE_TIRUAN = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';
```

Tanpa `.env`, build produksi tetap memakai mock. `dist` kemudian memuat akun
demo `ADM001` / `1111`, token `tiruan.<id>`, dan seluruh data di
`localStorage`.

**Yang harus dilakukan**

1. Buat `.env.example`:

   ```env
   VITE_USE_MOCK=false
   VITE_API_BASE=/api
   ```

2. Untuk build produksi:

   ```powershell
   $env:VITE_USE_MOCK='false'
   npm run build
   Remove-Item Env:VITE_USE_MOCK
   ```

3. Ubah default kode agar **fail-closed** di produksi. Contoh:

   ```js
   export const MODE_TIRUAN =
     import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false';
   ```

   Artinya: mock hanya aktif saat development. Build produksi selalu memakai
   backend asli, walaupun env lupa diisi.

4. Hapus/cegah akun demo ikut ke bundle produksi. Kalau memakai
   `MODE_TIRUAN` sebagai kondisi, pastikan Vite bisa mengeliminasi blok demo
   saat produksi.

5. Tambahkan pemeriksaan build/CI:

   ```powershell
   if (Select-String -Path dist\assets\*.js -Pattern 'ADM001|1111|tiruan\.' -Quiet) {
     throw 'Build produksi masih memuat kredensial atau kode mock.'
   }
   ```

   Kalau menemukan hasil, build produksi dianggap gagal.

**Kriteria selesai**

- Build produksi tanpa backend tidak bisa login memakai akun demo.
- Tidak ada `ADM001`, `1111`, atau `tiruan.` di `dist`.
- Tombol akun demo tidak muncul.
- `localStorage` tidak berisi `absen-tiruan-2` setelah build produksi dipakai.

---

### P0-2. Rate limit PIN dan pembatasan kiosk

**Masalah**

PANDUAN mewajibkan:

- 5 kali gagal per NIP → `429`, tunggu 60 detik (`:282`, `:946-948`).
- Berlaku di `/masuk` **dan** `/kiosk/absen`.
- Kiosk dibatasi IP/Wi-Fi kantor (`:627`).

Mock saat ini:

- 8 kali PIN salah semuanya `401`, tidak ada `429`.
- Tidak ada pengecekan IP.
- `lokasi_id` dan `mode` diterima dari client.

**Yang harus dilakukan di backend**

1. Simpan hitungan gagal per kombinasi:

   ```text
   kunci = "login:{nip}:{ip}"      untuk /masuk
   kunci = "kiosk:{nip}:{ip}"      untuk /kiosk/absen
   ```

2. Setelah 5 gagal dalam 60 detik:

   ```json
   HTTP 429
   { "message": "Terlalu banyak percobaan. Coba lagi dalam 60 detik." }
   ```

3. Reset hitungan setelah login berhasil.

4. Terapkan limit sebelum atau sesudah verifikasi PIN secara konsisten, dan
   jangan pernah memberi pesan yang membedakan NIP salah dari PIN salah.

5. Terapkan allowlist kiosk **sesuai keputusan Opsi A/B di atas**. Kalau
   memakai IP:

   - Baca `REMOTE_ADDR`; jangan percaya `X-Forwarded-For` mentah.
   - Kalau di belakang reverse proxy, konfigurasikan trusted proxy.
   - Tolak request dari luar CIDR dengan `403`.

6. Jangan memakai `lokasi_id` dari client sebagai sumber kebenaran. Server
   harus menentukan lokasi dari identitas kiosk/perangkat. Kalau tetap
   menerima `lokasi_id`, validasi bahwa ID itu milik kiosk tersebut dan
   statusnya aktif.

7. Catat `ip`, `user_agent`, `kiosk_id`, dan hasil validasi untuk audit.

**Kriteria selesai**

- Percobaan ke-5 gagal → `429`.
- Setelah 60 detik → boleh mencoba lagi.
- Request dari IP di luar allowlist → `403` (jika Opsi A).
- `lokasi_id` yang tidak cocok dengan kiosk → `403`/`422`, bukan diterima.
- Log memuat IP dan kiosk yang dipakai.

---

### P0-3. PIN di-hash dan tidak pernah dikembalikan ke browser

**Masalah**

PANDUAN:

- PIN disimpan sebagai hash (`PANDUAN-BACKEND.md:527`).
- Frontend tidak pernah menerima PIN siapa pun (`:350`, `:1091`).

Mock menyimpan `pin` apa adanya di `localStorage` (`src/mock.js:34`, `:41-61`).
Ini hanya boleh untuk mode tiruan, dan build produksi tidak boleh membawanya.

**Yang harus dilakukan di backend**

1. Ganti kolom `pin` menjadi `pin_hash`.
2. Hash dengan Argon2id atau bcrypt:

   ```php
   $hash = password_hash($pin, PASSWORD_DEFAULT);
   password_verify($pin, $user->pin_hash);
   ```

3. Jangan pernah mengembalikan `pin`/`pin_hash` di:

   - `POST /masuk`
   - `GET /saya/profil`
   - `GET /admin/magang`
   - `GET /admin/dashboard`
   - `GET /admin/laporan`
   - `POST /admin/magang`
   - `PUT /admin/magang/{id}`

4. Reset PIN hanya lewat endpoint admin, dengan PIN baru di body. Jangan
   menyediakan endpoint baca PIN.

5. Di frontend, pastikan `MODE_TIRUAN=false` pada produksi (lihat P0-1).

**Kriteria selesai**

- `GET /admin/magang` tidak mengandung `pin` atau `pin_hash`.
- Database tidak menyimpan PIN terbaca.
- Tidak ada PIN di respons login/profil.
- Tidak ada `absen-tiruan-2` di browser produksi.

---

### P0-4. Token acak, kedaluwarsa, dan dicabut saat logout

**Masalah**

Mock memakai token `tiruan.<id>` (`src/mock.js:116-118`, `:804`). Token ini:

- Bisa diprediksi.
- Tidak punya masa berlaku.
- Tidak benar-benar dicabut oleh `POST /keluar` (`src/mock.js:807-809`).

PANDUAN meminta token sesi yang bisa dicabut (`:276-278`, `:293-294`).

**Yang harus dilakukan di backend**

1. Generate token acak minimal 32 byte.
2. Simpan **hash token** di database, bukan token mentah.
3. Simpan `expires_at`, misalnya 8–12 jam.
4. `POST /keluar` menghapus/mencabut token tersebut.
5. Setiap request terautentikasi memeriksa:
   - token ada,
   - hash cocok,
   - belum kedaluwarsa.
6. Kalau token tidak valid → `401`.
7. Rotasi token setelah login berhasil.

**Kriteria selesai**

- Token lama setelah logout → `401`.
- Token yang diubah satu karakter → `401`.
- Token kedaluwarsa → `401`.
- Tidak ada token yang bisa ditebak dari ID pengguna.

---

### P0-5. Nominatim dari server, dengan cache dan batas 1 request/detik

**Masalah**

Mock memanggil Nominatim dari browser (`src/mock.js:648-681`). PANDUAN meminta
server yang memanggil, menyimpan `lokasi_teks`, memakai cache, dan membatasi
1 permintaan/detik (`:221-226`, `:617-619`).

**Yang harus dilakukan di backend**

1. Setelah koordinat valid, panggil Nominatim dari server:

   ```text
   https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=...&lon=...
   ```

2. Kirim `User-Agent` yang jelas, misalnya nama aplikasi + email kontak.
3. Cache hasil berdasarkan koordinat yang dibulatkan (misalnya 4 desimal).
4. Batasi 1 request/detik; gunakan antrean/background job kalau kiosk banyak.
5. Timeout singkat, misalnya 3 detik.
6. Kalau gagal: simpan `lokasi_teks = null`, **absen tetap diterima** `200`.
7. Jangan menunggu geocoding sebelum menyimpan absen kalau bisa; kalau harus
   menunggu, pastikan kegagalan tidak membatalkan absen.

**Kriteria selesai**

- Dua absen dari koordinat yang sama hanya memanggil Nominatim sekali.
- Nominatim dimatikan → absen tetap `200`, `lokasi_teks` null.
- Request dari browser ke Nominatim tidak ada di production.
- Ada bukti `User-Agent` dan cache.

---

## P1 — Perbaikan fungsional dan kontrak

### P1-1. `sisa` cuti harus mengurangi pengajuan `menunggu`

**Masalah**

`src/mock.js:254`:

```js
sisa: Math.max(0, jatah - terpakai)
```

PANDUAN (`:768-771`) mewajibkan `menunggu` ikut memotong jatah.

**Perbaikan**

```js
sisa: Math.max(0, jatah - terpakai - menunggu)
```

Gunakan `sisa` yang sudah dikurangi `menunggu` di:

- `GET /saya/izin`
- `POST /saya/izin`

Validasi pengajuan baru: `jumlah_hari > sisa` → `422`.
Pesan `422` harus menyebut sisa dan jumlah yang diajukan.

**Khusus endpoint setujui**, jangan membandingkan jumlah hari pengajuan dengan
`sisa` yang masih memasukkan pengajuan itu sendiri. Rumus yang benar:

```text
disetujui + semua_menunggu <= jatah
```

atau:

```text
sisa (yang sudah memasukkan pengajuan ini) >= 0
```

Contoh: jatah 12, belum ada yang disetujui, total pending 10 (termasuk
pengajuan yang akan disetujui). Nilai `sisa` = 2, tetapi pengajuan 10 hari itu
tetap boleh disetujui karena `0 + 10 <= 12`. Membandingkan `10 > 2` akan salah
menolak.

Untuk pengajuan baru, `sisa` adalah sisa setelah semua pending; untuk
persetujuan, hitung ulang totalnya secara eksplisit.

**Kriteria selesai**

- Jatah 12, pending 2 → `sisa: 10`.
- Pengajuan 11 hari → `422`.
- Setelah satu pengajuan disetujui, angka tetap konsisten.
- Hari libur dan akhir pekan tidak dihitung.
- Hari yang sudah ada absen tidak dihitung sebagai cuti.

---

### P1-2. Tangani `401` sesi habis tanpa merusak login/kiosk

**Masalah**

- `src/api.js` hanya menangani `401` saat startup (`segarkanSesi`).
- Sesi yang habis di tengah pemakaian hanya menampilkan “Gagal dimuat”.
- Kalau semua `401` diarahkan ke login, PIN salah di kiosk akan ikut
  terlempar.

**Perbaikan frontend**

Di `src/api.js`, setelah respons `401`:

- Kalau endpoint adalah `/masuk` atau `/kiosk/absen` → lempar error ke layar,
  **jangan** redirect.
- Kalau endpoint lain dan ada sesi → `hapusSesi()`, lalu
  `location.replace('#/masuk')`.
- Kalau `403` karena role → tampilkan pesan “tidak berhak”, jangan hapus sesi
  kecuali memang tokennya tidak valid.

Contoh logika:

```js
if (res.status === 401 && !['/masuk', '/kiosk/absen'].includes(jalur)) {
  hapusSesi();
  location.replace('#/masuk');
}
```

**Perbaikan kontrak**

- Tegaskan `401` untuk token tidak valid.
- Untuk kredensial salah, pertimbangkan `code` khusus atau status yang
  berbeda.
- Pisahkan arti `403`: token tidak valid vs role tidak berhak. Saat ini
  PANDUAN/KONTRAK menyebut `401`/`403` sama-sama menghapus sesi; keputusan
  final harus satu dan dipakai konsisten di frontend.
- Perbarui PANDUAN/KONTRAK agar tidak ada dua arti untuk `401`.

**Kriteria selesai**

- Token kedaluwarsa saat membuka menu → langsung `#/masuk`.
- PIN salah di kiosk → tetap di kiosk, PIN bisa diulang.
- PIN salah di login → tetap di login, pesan tampil.
- Tidak ada loop redirect.

---

### P1-3. Dashboard memakai tanggal `Asia/Jakarta`

**Masalah**

`src/views/beranda.js:100`:

```js
const hariIni = new Date().toISOString().slice(0, 10);
```

Antara 00:00–06:59 WIB, dashboard menampilkan tanggal kemarin.

**Perbaikan**

Gunakan helper yang sudah ada di layar lain:

```js
const hariIni = new Date().toLocaleDateString('en-CA', {
  timeZone: 'Asia/Jakarta',
});
```

Atau buat satu helper `hariIniISO()` dan pakai di semua layar.

**Kriteria selesai**

- Pada 21 Oktober 2026 pukul 00:30 WIB, dashboard menampilkan 21 Oktober.
- Tombol maju disabled hanya saat sudah di hari ini.
- Label “Hari ini”/“Kemarin” benar.

---

### P1-4. Selaraskan perilaku GPS dengan PANDUAN

**Masalah**

- Kode meminta GPS saat form kiosk dibuka, untuk kedua mode.
- PANDUAN masih mengatakan hanya setelah memilih “Di luar”.

**Pilihan**

**A. Pertahankan kode (alamat untuk kedua mode) — direkomendasikan**

Perbarui PANDUAN:

- GPS diminta saat form dibuka atau saat NIP mulai diketik.
- Berlaku untuk kedua mode.
- Mode `luar` tetap wajib koordinat + akurasi.
- Jelaskan bahwa kiosk bisa memunculkan prompt lokasi kepada orang yang lewat.

**B. Ikuti PANDUAN secara ketat**

- Panggil `mulaiGps()` hanya saat mode `luar` dipilih.
- Mode `kantor` tidak akan punya alamat.
- Ini menghapus fitur alamat di mode kantor yang sebelumnya diminta.

**Kriteria selesai**

- Tidak ada lagi perbedaan antara kode dan PANDUAN.
- Mode `luar` tanpa GPS tetap `422`.
- Mode `kantor` tetap bisa absen tanpa GPS.
- Perilaku prompt dijelaskan di dokumen.

---

## P2 — Di luar PANDUAN, tetapi sebaiknya diperbaiki

Item ini tidak semuanya pelanggaran PANDUAN, tetapi menutup celah keamanan
yang ditemukan saat audit.

### P2-1. PIN di Data Master jangan terlihat

`src/views/magang.js:254` memakai `jenis: 'teks'`.

Ganti menjadi `jenis: 'sandi'`, lalu tambahkan tombol “lihat” jika admin perlu
memeriksa PIN yang sedang diketik.

### P2-2. Sanitasi CSV

`src/views/laporan.js:46-51` belum menetralkan sel yang diawali:

```text
= + - @
```

Awali dengan `'` atau sanitasi sebelum ditulis ke CSV.

### P2-3. CSP dan header keamanan

Tambahkan di server/reverse proxy:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` untuk kamera/lokasi
- `Strict-Transport-Security` setelah HTTPS aktif

### P2-4. Batas foto dan body request

Backend harus:

- Membatasi ukuran body/foto.
- Hanya menerima JPEG/PNG yang valid.
- Menyimpan foto di storage privat.
- Tidak menerima SVG mentah.

### P2-5. Audit log admin

Catat:

- siapa mengubah PIN,
- siapa menyetujui/menolak cuti,
- siapa mengubah lokasi/shift,
- waktu dan IP.

---

## Urutan pengerjaan yang disarankan

1. Putuskan Opsi A/B kiosk dan perilaku GPS.
2. Perbaiki build produksi (P0-1).
3. Implementasi hash PIN + token + logout (P0-3, P0-4).
4. Implementasi rate limit + allowlist/device binding (P0-2).
5. Pindahkan Nominatim ke server (P0-5).
6. Perbaiki kuota cuti (P1-1).
7. Perbaiki `401` dan tanggal dashboard (P1-2, P1-3).
8. Perbarui PANDUAN/KONTRAK.
9. Kerjakan P2.

---

## Daftar uji akhir

### Backend

- [ ] 5 PIN salah → `429`; setelah 60 detik bisa lagi.
- [ ] Request kiosk dari luar allowlist → `403` (atau device token ditolak).
- [ ] Token setelah logout → `401`.
- [ ] Token kedaluwarsa → `401`.
- [ ] `GET /admin/magang` tidak memuat `pin`/`pin_hash`.
- [ ] Database tidak menyimpan PIN terbaca.
- [ ] Mode luar tanpa koordinat → `422`.
- [ ] Mode luar akurasi 250 m → `422`.
- [ ] Mode luar jarak jauh tetap `200`.
- [ ] Nominatim mati → absen `200`, `lokasi_teks` null.
- [ ] Dua absen koordinat sama → satu request Nominatim.
- [ ] Cuti 12, pending 2 → sisa 10.
- [ ] Pengajuan 11 hari → `422`.
- [ ] Setujui dua kali → `409`.
- [ ] Setujui melebihi jatah → `422`.

### Frontend / browser

- [ ] Build produksi tanpa backend tidak bisa login demo.
- [ ] Tidak ada `ADM001`/`1111`/`tiruan.` di `dist`.
- [ ] Dashboard pada 00:30 WIB menampilkan tanggal hari ini.
- [ ] Token kedaluwarsa → kembali ke `#/masuk`.
- [ ] PIN salah di kiosk → tetap di kiosk.
- [ ] PIN salah di login → tetap di login.
- [ ] GPS kedua mode berjalan; mode luar memblokir tanpa GPS.
- [ ] PIN Data Master tidak terlihat saat diketik.
- [ ] CSV dengan nama `=1+1` tidak dieksekusi Excel.
- [ ] CSP/header terpasang di respons produksi.

---

## Definition of done

Perbaikan dianggap selesai jika:

1. Build produksi tidak membawa mock, akun demo, atau PIN terbaca.
2. Rate limit dan pembatasan kiosk benar-benar menegakkan aturan PANDUAN.
3. PIN di-hash dan tidak pernah keluar dari server.
4. Token tidak bisa diprediksi dan benar-benar dicabut saat logout.
5. Kuota cuti konsisten antara tampilan, pengajuan, dan persetujuan.
6. Sesi habis selalu kembali ke login, tanpa merusak kiosk.
7. Tidak ada lagi perbedaan antara kode dan PANDUAN.
8. Semua daftar uji di atas lulus.
