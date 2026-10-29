# M6 — Hardening, QA & Rilis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat Aplikasi Absen layak produksi: kebijakan tertulis, kiosk tahan koneksi putus, audit dan anomali bisa diperiksa admin, operasional (monitoring, retensi, backup, pemulihan) berjalan, serta seluruh alur diuji dan disetujui sebelum rilis.

**Architecture:** M6 tidak menambah fitur produk baru. Pekerjaan dibagi menjadi empat lapis: (1) keputusan dan kebijakan yang mengikat, (2) ketahanan kiosk dan pengamatan server, (3) perkakas operasional, (4) QA dan gerbang rilis. Setiap endpoint baru masuk `KONTRAK-API.md` lebih dulu, lalu backend, lalu frontend. Semua pekerjaan backend memakai TDD dengan SQLite in-memory; tidak ada perintah database destruktif ke database pengembangan.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 8, Tailwind CSS 4, Vitest, Laravel 13 / PHP 8.3+, PHPUnit 12.5, MariaDB 10.11 (produksi), SQLite (tes), GitHub Actions.

**Spec:** `KONTRAK-API.md`, `docs/milestones/M6-hardening-rilis.md`, `docs/PRD.md`, dan `docs/KEBIJAKAN-PRODUKSI.md` yang dibuat pada Task 1.

**Depends on:** `docs/superpowers/plans/2026-10-28-m5-integrasi-backend.md` harus selesai lebih dulu. Task 6, 7, 8, dan 12 memakai endpoint izin, laporan, dan shift dari M5. Task 3 boleh dikerjakan paralel sesudah M5 karena CI menjalankan seluruh suite.

## Global Constraints

- Akar aplikasi: `D:\Work\Aplikasi-Absen\Desktop\aplikasiabsen`. Frontend di akar, backend di `backend/`.
- Semua dokumen repo ditulis dalam bahasa Indonesia. Balasan chat memakai bahasa pengguna.
- `KONTRAK-API.md` menang atas dokumen lain. Setiap endpoint atau bentuk response baru diubah di kontrak **sebelum** kode.
- Jangan pernah menulis PIN mentah, token, `pin_hash`, atau isi foto ke respons API, log aplikasi, audit, dokumentasi, atau keluaran perintah.
- Jangan menjalankan `migrate:fresh`, `db:wipe`, atau `DROP` pada database pengembangan yang berisi data. Tes memakai SQLite `:memory:`. Latihan backup/pemulihan hanya di direktori sementara atau staging.
- Waktu server adalah `Asia/Jakarta`. Jangan memakai jam browser untuk menentukan tanggal atau keterlambatan.
- TDD: tulis tes yang gagal, jalankan dan lihat gagal, tulis implementasi minimal, jalankan sampai lulus, lalu commit.
- Frontend tidak boleh mengimpor `src/mock.js` di build produksi. `npm run build` harus tetap lulus `scripts/periksa-build.mjs`.
- Semua akses admin baru memakai middleware `auth.token` + `admin`. Tidak ada endpoint publik baru.
- Audit dan anomali bersifat baca saja. Tidak ada endpoint hapus audit.
- Perubahan yang terlihat pengguna harus diuji di browser dengan backend asli (`VITE_USE_MOCK=false`). Tes unit bukan bukti UI berjalan.
- Satu task = satu commit. Jangan menggabungkan task yang belum lulus tesnya.

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `docs/KEBIJAKAN-PRODUKSI.md` | Keputusan retensi, akses, IP kiosk, ekspor, dan kontak insiden. |
| `docs/OPERASIONAL.md` | Monitoring, retensi, backup, pemulihan, rollback, dan insiden. |
| `docs/RILIS.md` | Daftar periksa pra-rilis, rilis, pasca-rilis, dan tanda tangan. |
| `src/csv.js` | Penyusunan CSV murni yang bisa diuji tanpa DOM. |
| `src/views/audit.js` | Layar log audit admin. |
| `src/views/anomali.js` | Layar anomali admin. |
| `backend/app/Support/Anomali.php` | Pengumpulan sinyal anomali dari data absen dan percobaan masuk. |
| `backend/app/Http/Controllers/AdminAuditController.php` | Daftar audit dengan filter dan paginasi. |
| `backend/app/Http/Controllers/AdminAnomaliController.php` | Daftar anomali dalam rentang tanggal. |
| `backend/app/Console/Commands/PeriksaKesehatan.php` | Perintah `absen:periksa`. |
| `backend/app/Console/Commands/BersihkanData.php` | Perintah `absen:bersihkan` untuk retensi. |
| `backend/database/migrations/2026_10_28_000002_add_kunci_idempoten_to_absen_table.php` | Kunci idempotensi kiosk. |
| `backend/database/migrations/2026_10_28_000003_create_percobaan_masuk_table.php` | Catatan percobaan masuk tanpa PIN. |
| `backend/deploy/backup.sh` | Backup database + foto + checksum. |
| `backend/deploy/restore.sh` | Pemulihan dengan konfirmasi. |
| `.github/workflows/ci.yml` | CI frontend dan backend dari akar repo. |
| `scripts/uji-beban.mjs` | Pengukur waktu laporan 50 magang. |
| `backend/database/seeders/UjiBebanSeeder.php` | Data 50 magang untuk staging. |

---

### Task 1: Kebijakan produksi dan penyelarasan PRD

**Files:**
- Create: `docs/KEBIJAKAN-PRODUKSI.md`
- Modify: `docs/PRD.md:106` (KIOSK-05), `docs/PRD.md:171` (foto), `docs/PRD.md:194` (retensi), `docs/PRD.md:320-330` (pertanyaan rilis), `docs/PRD.md:312-317` (risiko)
- Modify: `PANDUAN-PERBAIKAN.md` (tabel audit status di awal)
- Test: pemeriksaan teks dengan `grep`

**Interfaces:**
- Consumes: keputusan yang sudah berjalan di kode: kiosk publik, `kiosk_id` terdaftar, PIN + selfie, GPS 150 m, audit admin, CSV di browser, foto privat signed URL 10 menit.
- Produces: kebijakan yang menjadi acuan Task 9 (retensi), Task 6 (IP kantor), Task 10 (backup), dan Task 13 (tanda tangan rilis).

- [ ] **Step 1: Tulis berkas kebijakan**

Buat `docs/KEBIJAKAN-PRODUKSI.md`:

```markdown
# Kebijakan Produksi — Aplikasi Absen

Status: **Draf untuk persetujuan pemilik aplikasi**.
Berlaku sejak tanggal persetujuan. Perubahan kebijakan harus mengubah berkas ini
lebih dulu, lalu kode dan kontrak.

## 1. Kiosk dan lokasi

- Kiosk boleh dipakai untuk absen **di kantor** dan **dinas luar**.
- Pertahanan utama adalah `kiosk_id` yang terdaftar, PIN, selfie, dan batas
  percobaan. IP kantor **bukan** syarat absen.
- `ABSEN_IP_KANTOR` boleh diisi daftar IP kantor. Kalau diisi, absen dari IP di
  luar daftar hanya **ditandai** di layar anomali, tidak ditolak. Alasannya: IP
  kantor bisa berubah dan dinas luar yang sah berasal dari jaringan lain.
- Perangkat kiosk baru didaftarkan PIC infrastruktur saat pemasangan lewat
  prosedur deploy. Belum ada layar admin untuk mendaftarkan perangkat pada
  rilis ini. Identitas perangkat disimpan di `localStorage` PC kiosk, bukan di
  URL yang bisa dibagikan.

## 2. Foto dan data absen

| Data | Masa simpan | Setelah habis |
|---|---|---|
| Foto selfie | 180 hari sejak absen | Berkas dihapus; baris absen tetap ada dengan `foto_path` kosong |
| Baris absen | 5 tahun | Diarsipkan atau dihapus oleh pemilik data; bukan oleh aplikasi |
| Audit | 2 tahun | Dihapus oleh perintah retensi |
| Sesi | 12 jam | Kedaluwarsa dan dibersihkan otomatis |

- Foto hanya di disk privat. Akses lewat signed URL 10 menit.
- Yang boleh melihat foto: admin aplikasi dan pemilik data untuk fotonya
  sendiri. Tidak ada unduhan massal foto.
- Permintaan salinan data oleh pihak luar harus disetujui pemilik data dan
  dicatat di luar aplikasi.

## 3. Audit dan anomali

- Audit hanya dapat dibaca admin. Tidak ada endpoint mengubah atau menghapus
  audit.
- Anomali adalah **petunjuk untuk diperiksa**, bukan tuduhan. Jarak jauh dari
  kantor bukan pelanggaran; dinas luar memang jauh.
- PIN, token, `pin_hash`, dan isi foto tidak boleh masuk audit, log, atau layar.

## 4. Ekspor dan laporan

- Ekspor resmi hanya CSV yang disusun di browser. Tidak ada PDF, tanda tangan
  basah, atau endpoint ekspor di backend.
- CSV memakai pemisah titik koma dan BOM UTF-8 agar terbuka benar di Excel
  berbahasa Indonesia.
- Angka laporan mengikuti `KONTRAK-API.md`; perubahan rumus harus mengubah
  kontrak lebih dulu.

## 5. Operasional

- Jam server wajib NTP dan zona waktu `Asia/Jakarta`.
- Backup database dan foto dilakukan setiap hari, disimpan 14 hari, dan
  diuji pemulihannya minimal sekali sebelum rilis.
- Monitoring dasar berjalan setiap lima menit: database, penyimpanan, kapasitas
  disk, dan ada/tidaknya absen pada hari kerja.
- Insiden keamanan (PIN bocor, foto terbuka, akun admin disalahgunakan)
  dilaporkan ke pemilik aplikasi dan PIC infrastruktur maksimal 1 jam setelah
  diketahui.

## 6. Kontak insiden

Nama dan nomor kontak **tidak disimpan di repo**. Daftar kontak disimpan di
password manager kantor dengan nama "Kontak Insiden Aplikasi Absen" dan harus
berisi tiga peran: pemilik aplikasi, PIC infrastruktur, dan pemilik data.
Berkas ini hanya menyebut perannya.

## 7. Persetujuan

| Peran | Nama | Tanggal | Tanda tangan |
|---|---|---|---|
| Pemilik aplikasi |  |  |  |
| PIC infrastruktur |  |  |  |
| Pemilik data |  |  |  |

Persetujuan diberikan setelah seluruh butir `docs/RILIS.md` tercentang.
```

- [ ] **Step 2: Selaraskan KIOSK-05 dengan perilaku sebenarnya**

Di `docs/PRD.md`, ganti baris KIOSK-05:

```markdown
| KIOSK-05 | Selfie diambil otomatis setelah hitung mundur. | Tidak ada pratinjau atau ambil ulang sebelum kirim; hasil foto tampil di layar konfirmasi. Izin kamera yang gagal diberi pesan yang bisa ditindaklanjuti. |
```

- [ ] **Step 3: Ganti aturan foto dan retensi di PRD**

Ganti baris aturan bisnis foto:

```markdown
| Foto | Disimpan privat; akses lewat signed URL berumur 10 menit; foto dihapus setelah 180 hari, baris absen tetap ada. |
```

Ganti butir NFR tentang retensi:

```markdown
- Foto selfie disimpan 180 hari, baris absen 5 tahun, dan audit 2 tahun.
  Kebijakan lengkap ada di `docs/KEBIJAKAN-PRODUKSI.md`.
```

- [ ] **Step 4: Tutup pertanyaan rilis yang sudah diputuskan**

Ganti bagian "Pertanyaan yang harus dijawab sebelum rilis" dengan:

```markdown
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
```

- [ ] **Step 5: Perbarui tabel risiko PRD**

Ganti baris risiko retensi dan IP dengan:

```markdown
| PIN 4–6 angka dipakai bersama di PC kiosk. | PIN bisa ditebak atau dipinjam orang lain. | Rate limit, device enrollment, selfie; IP kantor hanya penanda anomali sesuai kebijakan. |
| Foto dan data absen menumpuk. | Disk penuh; biaya backup naik. | Retensi foto 180 hari, audit 2 tahun; monitoring kapasitas dan backup di M6. |
```

- [ ] **Step 6: Tambahkan audit status ke panduan perbaikan**

Di awal `PANDUAN-PERBAIKAN.md`, setelah judul, sisipkan:

```markdown
> **Audit status — 28 Oktober 2026.** Dokumen ini ditulis sebelum beberapa
> perbaikan masuk. Item yang sudah selesai: P0-1 (mock DEV-only + pemeriksaan
> build), P0-2 (rate limit kiosk), P0-3 (PIN hash, tidak dikembalikan), P0-4
> (token acak + kedaluwarsa), P0-5 (Nominatim server + cache), P1-2 (`401`),
> P1-3 (tanggal Jakarta), P1-4 (GPS), P2-1 (PIN tidak tampil), P2-2 (CSV),
> P2-3 (CSP), P2-4 (batas foto), P2-5 (audit log). Yang masih terbuka: allowlist
> IP sebagai lapisan tambahan (diputuskan sebagai penanda anomali, bukan
> penolakan) dan verifikasi akhir di staging. Baca kode sebelum mengerjakan
> ulang item di bawah.
```

- [ ] **Step 7: Verifikasi teks**

Run:

```bash
grep -n "180 hari\|5 tahun\|2 tahun\|bukan syarat absen" docs/KEBIJAKAN-PRODUKSI.md
grep -n "Tidak ada pratinjau atau ambil ulang" docs/PRD.md
grep -n "Audit status — 28 Oktober 2026" PANDUAN-PERBAIKAN.md
```

Expected: setiap pola ditemukan minimal sekali; tidak ada `TBD` atau `TODO`.

- [ ] **Step 8: Commit**

```bash
git add docs/KEBIJAKAN-PRODUKSI.md docs/PRD.md PANDUAN-PERBAIKAN.md
git commit -m "docs: tetapkan kebijakan produksi dan selaraskan PRD"
```

---

### Task 2: Harness tes frontend dan ekstraksi CSV

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/csv.js`, `src/csv.test.js`, `src/tabel.test.js`
- Modify: `src/views/laporan.js:14-69`

**Interfaces:**
- Consumes: `unduhCSV` lokal di `src/views/laporan.js`.
- Produces: `susunCSV(kepala: string[], baris: unknown[][]): string`, `selCSV(nilai: unknown): string`, `unduhCSV(namaBerkas: string, kepala: string[], baris: unknown[][]): void`; `npm test` untuk CI Task 3.

- [ ] **Step 1: Pasang Vitest**

Run:

```bash
npm install --save-dev vitest
```

Expected: `package.json` dan `package-lock.json` berubah; tidak ada perubahan kode aplikasi.

- [ ] **Step 2: Tulis tes CSV yang gagal**

Buat `src/csv.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { selCSV, susunCSV } from './csv.js';

describe('selCSV', () => {
  it('membungkus sel dengan kutip dan menggandakan kutip di dalamnya', () => {
    expect(selCSV('Siti "Rahayu"')).toBe('"Siti ""Rahayu"""');
  });

  it('mengamankan sel yang akan dieksekusi Excel sebagai rumus', () => {
    expect(selCSV('=1+1')).toBe("\"'=1+1\"");
    expect(selCSV('+62')).toBe("\"'+62\"");
    expect(selCSV('-1')).toBe("\"'-1\"");
    expect(selCSV('@SUM(A1)')).toBe("\"'@SUM(A1)\"");
  });

  it('mengubah null dan undefined menjadi sel kosong', () => {
    expect(selCSV(null)).toBe('""');
    expect(selCSV(undefined)).toBe('""');
  });
});

describe('susunCSV', () => {
  it('memakai titik koma dan CRLF tanpa BOM', () => {
    expect(susunCSV(['Nama', 'Hadir'], [['Siti', 20], ['Budi', null]])).toBe(
      '"Nama";"Hadir"\r\n"Siti";"20"\r\n"Budi";""',
    );
  });
});
```

Buat `src/tabel.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { tabel } from './tabel.js';

describe('tabel', () => {
  it('memberi caption tersembunyi untuk pembaca layar', () => {
    const html = tabel({
      judul: 'Daftar hari libur',
      kolom: [{ judul: 'Tanggal', sel: (b) => b.tanggal }],
      baris: [{ tanggal: '2026-01-01' }],
    });

    expect(html).toContain('<caption class="sr-only">Daftar hari libur</caption>');
    expect(html).toContain('<th scope="col"');
  });
});
```

- [ ] **Step 3: Jalankan tes dan pastikan gagal**

Run:

```bash
npx vitest run src/csv.test.js src/tabel.test.js
```

Expected: FAIL karena `src/csv.js` belum ada dan `tabel` belum menerima `judul`/caption.

- [ ] **Step 4: Buat modul CSV**

Buat `src/csv.js`:

```js
// Penyusunan CSV dipisah dari layar supaya aturan escaping bisa diuji tanpa
// browser. Pemisah titik koma adalah yang diharapkan Excel berbahasa Indonesia;
// BOM ditambahkan saat berkas diunduh, bukan di dalam string ini.
export function selCSV(nilai) {
  let teks = String(nilai ?? '');

  if (/^[=+\-@\t\r]/.test(teks)) teks = `'${teks}`;

  return `"${teks.replace(/"/g, '""')}"`;
}

export function susunCSV(kepala, baris) {
  return [kepala, ...baris].map((b) => b.map(selCSV).join(';')).join('\r\n');
}

export function unduhCSV(namaBerkas, kepala, baris) {
  const isi = susunCSV(kepala, baris);
  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(new Blob([`\ufeff${isi}`], { type: 'text/csv;charset=utf-8' }));
  tautan.download = namaBerkas;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();

  setTimeout(() => URL.revokeObjectURL(tautan.href), 2000);
}
```

- [ ] **Step 5: Pakai modul baru di laporan dan tambahkan caption**

Di `src/views/laporan.js`, tambahkan impor setelah impor `tabel.js`:

```js
import { unduhCSV } from '../csv.js';
```

Hapus seluruh fungsi lokal `unduhCSV` (baris 35–69) beserta komentarnya.

Pada pemanggilan `tabel` rekap, tambahkan `judul`:

```js
${tabel({
  judul: 'Rekap absen bulanan',
  kolom: kolomRekap(),
  baris: rekap.data,
  kosong: 'Belum ada data pada bulan ini.',
})}
```

Pada pemanggilan `tabel` harian, tambahkan `judul`:

```js
${tabel({
  judul: 'Rincian absen harian',
  kolom: kolomHarian(),
  baris: hari,
  kosong: 'Belum ada catatan pada bulan ini.',
})}
```

Di `src/tabel.js`, ubah signature dan tambahkan caption:

```js
export function tabel({ judul, kolom, baris, kosong = 'Belum ada data.' }) {
```

dan di dalam template:

```html
<table class="w-full min-w-[42rem] border-collapse text-sm">
  <caption class="sr-only">${esc(judul)}</caption>
  <thead>
```

- [ ] **Step 6: Update seluruh pemanggil tabel**

Tambahkan properti `judul` pada setiap pemanggilan:

| Berkas | Nilai `judul` |
|---|---|
| `src/views/hari-libur.js:73` | `'Daftar hari libur'` |
| `src/views/izin-masuk.js:131` | `'Daftar pengajuan izin'` |
| `src/views/lokasi.js:78` | `'Daftar lokasi kantor'` |
| `src/views/magang.js:121` | `'Daftar anak magang'` |
| `src/views/riwayat.js:111` | `'Riwayat absen'` |
| `src/views/shift.js:75` | `'Daftar shift kerja'` |

Contoh bentuk akhir untuk `hari-libur.js`:

```js
kotakDaftar.innerHTML = tabel({
  judul: 'Daftar hari libur',
  kolom,
  baris,
  kosong: cari
    ? `Tidak ada hari libur yang cocok dengan "${cari}".`
    : 'Belum ada hari libur. Sabtu dan Minggu sudah otomatis libur.',
});
```

Ulangi pola yang sama untuk lima berkas lain tanpa mengubah `kolom`, `baris`, atau `kosong`.

- [ ] **Step 7: Tambahkan skrip tes**

Di `package.json` bagian `scripts`, tambahkan:

```json
"test": "vitest run"
```

- [ ] **Step 8: Jalankan tes dan build**

Run:

```bash
npm test
npm run build
```

Expected: kedua tes lulus; build lulus pemeriksaan `dist`; tidak ada `dist` yang memuat mode tiruan.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/csv.js src/csv.test.js src/tabel.js src/tabel.test.js src/views/laporan.js src/views/hari-libur.js src/views/izin-masuk.js src/views/lokasi.js src/views/magang.js src/views/riwayat.js src/views/shift.js
git commit -m "test: tambah harness vitest dan uji csv"
```

---

### Task 3: CI dari akar repo dan koreksi panduan deploy

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `backend/deploy/README.md:41-51`, `backend/deploy/README.md:98-102`, `backend/deploy/README.md:157-169`, `backend/deploy/README.md:208-221`, `backend/deploy/README.md:244-259`
- Test: `npx --yes js-yaml .github/workflows/ci.yml`, `npm test`, `npm run build`, `cd backend && php artisan test`

**Interfaces:**
- Consumes: `npm test` dari Task 2 dan seluruh suite backend M5.
- Produces: CI yang berjalan pada push/PR di root repo; panduan deploy yang tidak menjalankan seeder rutin dan tidak mencampur dependensi tes dengan produksi.

- [ ] **Step 1: Tulis workflow CI**

Buat `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, frontend-rf]
  pull_request:

permissions:
  contents: read

jobs:
  frontend:
    name: Frontend
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Unit tests
        run: npm test

      - name: Production build
        run: npm run build

  backend:
    name: Backend PHP ${{ matrix.php }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: true
      matrix:
        php: ['8.3', '8.4']
    defaults:
      run:
        working-directory: backend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php }}
          extensions: dom, curl, libxml, mbstring, zip, pcntl, pdo, sqlite, pdo_sqlite
          coverage: none

      - name: Install Composer dependencies
        run: composer install --prefer-dist --no-interaction --no-progress

      - name: Prepare environment
        run: |
          cp .env.example .env
          php artisan key:generate

      - name: Run tests
        run: php artisan test
```

Catatan: `backend/.github/workflows/tests.yml` adalah bawaan Laravel dan **tidak dijalankan GitHub** karena berada di subfolder. Workflow yang berlaku adalah `.github/workflows/ci.yml` di akar. Jangan menghapus berkas lama tanpa persetujuan pemilik repo; cukup catat di panduan deploy.

- [ ] **Step 2: Validasi YAML dan jalankan seluruh pemeriksaan lokal**

Run:

```bash
npx --yes js-yaml .github/workflows/ci.yml > /dev/null
npm test
npm run build
cd backend && php artisan test
```

Expected: YAML valid; tes frontend lulus; build lulus; seluruh tes backend lulus. Kalau tes backend gagal karena M5 belum selesai, jangan lanjut ke task berikutnya.

- [ ] **Step 3: Perbaiki urutan build frontend di panduan deploy**

Di `backend/deploy/README.md`, ganti blok bagian 6:

```bash
cd /var/www/aplikasiabsen
npm ci
npm run build
cp -r dist/* backend/public/
```

Tambahkan tepat setelah blok:

```markdown
`npm ci` harus dijalankan dari akar proyek, bukan dari `backend/`; berkas
`package.json` frontend ada di sana. Jangan menyalin `dist` ke
`backend/public/dist` — isinya harus berada langsung di `backend/public`.
```

- [ ] **Step 4: Pisahkan migrasi rutin dari seeder**

Ganti blok migrasi dan data awal:

```bash
php artisan migrate --force
```

Tambahkan:

````markdown
Seeder hanya untuk pemasangan pertama, **bukan** untuk setiap deploy:

```bash
php artisan db:seed --force
```

Seeder memakai `updateOrCreate`; menjalankannya lagi akan mengatur ulang PIN
admin ke nilai `ADMIN_PIN` di `.env`. Jangan simpan `ADMIN_PIN` produksi di
repo dan jangan jalankan seeder rutin.
````

- [ ] **Step 5: Koreksi klaim tes di server produksi**

Ganti butir verifikasi:

```markdown
- `php artisan test` dijalankan di CI dan di salinan staging, bukan di server
  produksi. Server produksi memakai `composer install --no-dev`, sehingga
  PHPUnit tidak tersedia. Untuk menjalankan tes di server, pasang dependensi
  pengembangan di salinan terpisah, jangan mengubah instalasi produksi.
```

- [ ] **Step 6: Tambahkan bagian CI dan backup baru**

Tambahkan bagian sebelum "Firewall":

```markdown
## 12a. CI

Workflow ada di `.github/workflows/ci.yml` (akar repo), bukan di
`backend/.github/`. CI menjalankan `npm test`, `npm run build`, dan
`php artisan test` untuk PHP 8.3 dan 8.4. Pull request tidak boleh digabung
kalau CI merah.

## 12b. Backup dan retensi

Jangan memakai perintah `mysqldump` manual di dokumen ini sebagai prosedur
utama. Gunakan `backend/deploy/backup.sh` dan `backend/deploy/restore.sh`
seperti dijelaskan di `docs/OPERASIONAL.md`. Skrip itu menolak berjalan tanpa
berkas kredensial MySQL dan menyimpan checksum.
```

- [ ] **Step 7: Periksa tidak ada instruksi berbahaya**

Run:

```bash
grep -n "migrate --seed --force" backend/deploy/README.md
grep -n "npm ci" backend/deploy/README.md
```

Expected: tidak ada lagi `migrate --seed --force`; `npm ci` berada setelah `cd /var/www/aplikasiabsen` (akar), bukan setelah `cd .../backend`.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/ci.yml backend/deploy/README.md
git commit -m "ci: jalankan tes frontend dan backend dari akar repo"
```

---

### Task 4: Idempotensi absen kiosk (backend)

**Files:**
- Modify: `KONTRAK-API.md:405-533`
- Create: `backend/database/migrations/2026_10_28_000002_add_kunci_idempoten_to_absen_table.php`
- Modify: `backend/app/Http/Controllers/KioskController.php:72-330`
- Test: `backend/tests/Feature/KioskIdempotenTest.php`

**Interfaces:**
- Consumes: `POST /kiosk/absen` yang sudah ada; kolom `kiosk_id`, `nama_salinan`, `nip_salinan`.
- Produces: field permintaan `kunci_idempoten` (opsional, 8–80 karakter `[A-Za-z0-9._-]`); response sukses selalu memuat `id` dan `idempoten` (boolean). Replay dengan kunci dan NIP yang sama mengembalikan baris yang sama tanpa menyimpan foto baru. Kunci sama dengan NIP berbeda → `409 kunci_bentrok`.

- [ ] **Step 1: Ubah kontrak lebih dulu**

Di `KONTRAK-API.md` bagian `POST /kiosk/absen`, tambahkan ke contoh permintaan:

```json
"kunci_idempoten": "8f14e45f-ceea-467f-a1c3-0d3b4f5e6a71"
```

Tambahkan ke contoh berhasil:

```json
"id": 91,
"idempoten": false
```

Tambahkan aturan setelah aturan 13:

```markdown
14. **Klien boleh mengirim `kunci_idempoten`.** Nilainya 8–80 karakter dari
    `A-Z`, `a-z`, `0-9`, titik, garis bawah, atau tanda hubung. Kunci dibuat
    sekali untuk satu percobaan absen dan dipakai ulang saat klien mengirim
    ulang setelah jaringan putus.
15. **Kunci yang sama untuk NIP dan `kiosk_id` yang sama mengembalikan hasil
    pertama.** Status `200`, `idempoten: true`, `id` sama, dan tidak ada baris
    absen atau foto baru. Ini yang membuat tombol "kirim ulang" aman.
16. **Kunci yang sama untuk NIP berbeda dibalas `409` dengan
    `kode: "kunci_bentrok"`.** Jangan mengembalikan data absen orang lain.
17. **Tanpa `kunci_idempoten`, perilaku lama berlaku.** Klien lama tetap bisa
    absen, tetapi tidak mendapat perlindungan dari pengiriman ganda.
```

- [ ] **Step 2: Tulis tes yang gagal**

Buat `backend/tests/Feature/KioskIdempotenTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PerangkatKiosk;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class KioskIdempotenTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private PerangkatKiosk $kiosk;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Cache::flush();

        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                'display_name' => 'Jl. Uji No. 1, Jakarta',
                'address' => ['road' => 'Jl. Uji', 'house_number' => '1', 'city' => 'Jakarta Pusat'],
            ]),
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-19 08:43:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor Pusat',
            'alamat' => 'Jl. Uji No. 1',
            'lintang' => -6.2246,
            'bujur' => 106.8094,
            'radius_m' => 50,
            'aktif' => true,
        ]);

        $this->shift = Shift::create([
            'nama' => 'Reguler',
            'masuk' => '08:00',
            'pulang' => '17:00',
            'toleransi_menit' => 15,
            'aktif' => true,
        ]);

        $this->kiosk = PerangkatKiosk::create([
            'id' => 'kiosk-idempoten',
            'nama' => 'Kiosk Idempoten',
            'lokasi_id' => $this->lokasi->id,
            'aktif' => true,
            'created_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_kunci_sama_mengembalikan_hasil_pertama_tanpa_baris_baru(): void
    {
        $magang = $this->buatPengguna('MGG101');

        $payload = [
            'nip' => 'MGG101',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
            'kunci_idempoten' => 'uji-idempoten-0001',
        ];

        $pertama = $this->postJson('/api/kiosk/absen', $payload)
            ->assertOk()
            ->assertJsonPath('idempoten', false)
            ->assertJsonPath('tipe', 'masuk');

        $kedua = $this->postJson('/api/kiosk/absen', $payload)
            ->assertOk()
            ->assertJsonPath('idempoten', true)
            ->assertJsonPath('tipe', 'masuk')
            ->assertJsonPath('id', $pertama->json('id'));

        $this->assertSame(1, Absen::count());
        $this->assertCount(1, Storage::disk('local')->allFiles('absen'));
        $this->assertSame($magang->id, Absen::firstOrFail()->pengguna_id);
    }

    public function test_kunci_sama_untuk_nip_lain_ditolak_tanpa_membocorkan_data(): void
    {
        $this->buatPengguna('MGG102');
        $this->buatPengguna('MGG103');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG102',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
            'kunci_idempoten' => 'uji-idempoten-0002',
        ])->assertOk();

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG103',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
            'kunci_idempoten' => 'uji-idempoten-0002',
        ])->assertStatus(409)
            ->assertJsonPath('kode', 'kunci_bentrok')
            ->assertJsonMissingPath('nama');

        $this->assertSame(1, Absen::count());
    }

    public function test_tanpa_kunci_tetap_bisa_absen(): void
    {
        $this->buatPengguna('MGG104');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG104',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ])->assertOk()
            ->assertJsonPath('idempoten', false);

        $this->assertSame(1, Absen::count());
    }

    private function buatPengguna(string $nip): Pengguna
    {
        return Pengguna::create([
            'nama' => 'Magang '.$nip,
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    private function foto(): string
    {
        return 'data:image/jpeg;base64,'.base64_encode(
            "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9"
        );
    }
}
```

- [ ] **Step 3: Jalankan tes dan pastikan gagal**

Run:

```bash
cd backend
php artisan test --filter=KioskIdempotenTest
```

Expected: FAIL karena kolom `kunci_idempoten` belum ada atau belum divalidasi.

- [ ] **Step 4: Buat migrasi**

Buat `backend/database/migrations/2026_10_28_000002_add_kunci_idempoten_to_absen_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absen', function (Blueprint $table) {
            $table->string('kunci_idempoten', 80)->nullable()->after('user_agent');
            $table->unique(['kiosk_id', 'kunci_idempoten'], 'absen_kiosk_kunci_unique');
        });
    }

    public function down(): void
    {
        Schema::table('absen', function (Blueprint $table) {
            $table->dropUnique('absen_kiosk_kunci_unique');
            $table->dropColumn('kunci_idempoten');
        });
    }
};
```

Run migrasi hanya pada database pengembangan yang aman:

```bash
php artisan migrate
```

Jangan memakai `migrate:fresh`.

- [ ] **Step 5: Tambahkan validasi dan replay di controller**

Di `KioskController::absen`, tambahkan aturan validasi setelah `foto`:

```php
'kunci_idempoten' => ['nullable', 'string', 'min:8', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/'],
```

Tambahkan pesan:

```php
'kunci_idempoten.min' => 'Kunci idempoten minimal 8 karakter.',
'kunci_idempoten.max' => 'Kunci idempoten maksimal 80 karakter.',
'kunci_idempoten.regex' => 'Kunci idempoten hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.',
```

Setelah `$ip = $request->ip() ?? 'tidak-diketahui';`, tambahkan:

```php
$kunciIdempoten = $data['kunci_idempoten'] ?? null;
```

Setelah blok validasi perangkat/lokasi (`lokasi_id` cocok) dan sebelum penentuan `$mode`, sisipkan:

```php
if ($kunciIdempoten !== null) {
    $lama = Absen::where('kiosk_id', $kioskId)
        ->where('kunci_idempoten', $kunciIdempoten)
        ->first();

    if ($lama) {
        return $lama->pengguna_id === $pengguna->id
            ? $this->jawabanAbsen($lama, true)
            : $this->galat(
                'Kunci idempoten sudah dipakai untuk pengguna lain.',
                409,
                'kunci_bentrok'
            );
    }
}
```

Tambahkan `'kunci_idempoten' => $kunciIdempoten,` ke array `Absen::create`.

Ganti blok `return response()->json([...])` di akhir `absen` dengan:

```php
return $this->jawabanAbsen($absen, false);
```

Ganti seluruh blok `catch (QueryException $e)` dengan:

```php
} catch (QueryException $e) {
    Foto::hapus($fotoPath);

    if ($kunciIdempoten !== null) {
        $lama = Absen::where('kiosk_id', $kioskId)
            ->where('kunci_idempoten', $kunciIdempoten)
            ->first();

        if ($lama) {
            return $lama->pengguna_id === $pengguna->id
                ? $this->jawabanAbsen($lama, true)
                : $this->galat(
                    'Kunci idempoten sudah dipakai untuk pengguna lain.',
                    409,
                    'kunci_bentrok'
                );
        }
    }

    if ($this->duplikat($e)) {
        return $this->galat(
            $pengguna->nama.' sudah absen pulang hari ini.',
            409,
            'sudah_absen'
        );
    }

    throw $e;
}
```

Tambahkan helper sebelum `bacaFoto`:

```php
private function jawabanAbsen(Absen $absen, bool $idempoten): JsonResponse
{
    return response()->json([
        'id' => $absen->id,
        'tipe' => $absen->tipe,
        'nama' => $absen->nama_salinan,
        'nip' => $absen->nip_salinan,
        'waktu' => $absen->waktu->toIso8601String(),
        'lokasi_id' => $absen->lokasi_id,
        'mode' => $absen->mode,
        'jarak_m' => $absen->jarak_m,
        'akurasi' => $absen->akurasi,
        'lokasi_teks' => $absen->lokasi_teks,
        'lokasi_meragukan' => $absen->lokasi_meragukan,
        'idempoten' => $idempoten,
    ]);
}
```

- [ ] **Step 6: Jalankan tes sampai lulus**

Run:

```bash
cd backend
php artisan test --filter=KioskIdempotenTest
php artisan test --filter=Fase1Test
```

Expected: `KioskIdempotenTest` lulus; `Fase1Test` tetap lulus karena `kunci_idempoten` opsional.

- [ ] **Step 7: Commit**

```bash
git add KONTRAK-API.md backend/database/migrations/2026_10_28_000002_add_kunci_idempoten_to_absen_table.php backend/app/Http/Controllers/KioskController.php backend/tests/Feature/KioskIdempotenTest.php
git commit -m "feat: idempotensi absen kiosk dengan kunci klien"
```

---

### Task 5: Batas waktu dan kirim ulang kiosk (frontend)

**Files:**
- Modify: `src/api.js:67-122`
- Modify: `src/views/absen.js:15`, `src/views/absen.js:104-120` (daftar timer), `src/views/absen.js:532-581`, `src/views/absen.js:585-663`
- Test: manual browser dengan jaringan terputus; `npm run build`

**Interfaces:**
- Consumes: `kunci_idempoten` dan `idempoten` dari Task 4.
- Produces: `api.js` menandai kegagalan jaringan dengan `galat.jaringan = true` dan membatalkan permintaan setelah 30 detik. Kiosk mengirim ulang sekali otomatis memakai kunci dan foto yang sama; kalau masih gagal, layar menawarkan "Kirim ulang absen" tanpa memotret ulang.

- [ ] **Step 1: Tambahkan batas waktu dan penanda jaringan di api.js**

Di dekat konstanta atas, tambahkan:

```js
const BATAS_PERMINTAAN_MS = 30_000;
```

Di `minta`, ganti blok `try { res = await fetch(...) } catch {...}` dengan:

```js
const pengawas = new AbortController();
const timer = setTimeout(() => pengawas.abort(), BATAS_PERMINTAAN_MS);

try {
  res = await fetch(PANGKAL + jalur, {
    method: metode,
    headers: {
      Accept: 'application/json',
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(sesi?.token ? { Authorization: `Bearer ${sesi.token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: pengawas.signal,
  });
} catch (galat) {
  const putus = galat.name === 'AbortError'
    ? 'Server tidak menjawab dalam 30 detik. Periksa jaringan kantor, lalu coba lagi.'
    : 'Tidak bisa menghubungi server. Periksa jaringan kantor, lalu coba lagi.';

  const kesalahan = new Error(putus);
  kesalahan.jaringan = true;
  throw kesalahan;
} finally {
  clearTimeout(timer);
}
```

Jangan mengubah perilaku `401`/`403`.

- [ ] **Step 2: Tambahkan kunci dan kirim ulang di kiosk**

Di `src/views/absen.js`, tambahkan helper setelah konstanta tombol:

```js
function kunciBaru() {
  return crypto.randomUUID?.()
    ?? `kiosk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

Ganti fungsi `kirim` dengan versi ini:

```js
async function kirim(nip, pin, gambar, mode, kunci = kunciBaru(), percobaan = 1) {
  langkah = 'simpan';

  panggung.innerHTML = `
    <div class="w-full max-w-md text-center">
      <div class="overflow-hidden rounded-[1.75rem] ring-1 ring-ink/10">
        <img src="${gambar}" alt="" class="block aspect-[4/3] w-full object-cover" />
      </div>

      <p class="mt-5 flex items-center justify-center gap-2.5 text-sm font-medium text-muted">
        ${IKON_MUTAR}
        ${percobaan > 1 ? 'Mengirim ulang absen…' : 'Menyimpan absen…'}
      </p>
    </div>`;

  try {
    const jawab = await api.post('/kiosk/absen', {
      nip,
      pin,
      foto: gambar,
      kiosk_id: idPerangkat(),
      lokasi_id: lokasi?.id ?? null,
      mode,
      kunci_idempoten: kunci,
      ...(gps
        ? { lintang: gps.lintang, bujur: gps.bujur, akurasi: gps.akurasi }
        : {}),
    });

    tampilkanHasil({
      ok: true,
      judul: jawab.tipe === 'pulang' ? 'Absen pulang tercatat' : 'Absen masuk tercatat',
      nama: jawab.nama,
      waktu: jawab.waktu,
      tipe: jawab.tipe,
      gambar,
      jarak_m: jawab.jarak_m,
      akurasi: jawab.akurasi,
      lokasi_teks: jawab.lokasi_teks,
      lokasi_meragukan: jawab.lokasi_meragukan,
    });
  } catch (galat) {
    // Hanya kegagalan jaringan yang aman diulang otomatis. 409/422 berarti
    // server sudah menjawab dan pengulangan tidak akan mengubah hasilnya.
    if (galat.jaringan && percobaan === 1 && langkah === 'simpan') {
      jadwalkan(() => {
        if (langkah === 'simpan') kirim(nip, pin, gambar, mode, kunci, 2);
      }, 1500);
      return;
    }

    tampilkanHasil({
      ok: false,
      judul: galat.jaringan ? 'Koneksi terputus' : 'Absen tidak tercatat',
      pesan: galat.message,
      ulangKirim: galat.jaringan
        ? () => kirim(nip, pin, gambar, mode, kunci, 2)
        : null,
    });
  }
}
```

- [ ] **Step 3: Tambahkan tombol kirim ulang di layar hasil**

Ubah signature `tampilkanHasil`:

```js
function tampilkanHasil({
  ok,
  judul,
  pesan = '',
  nama,
  waktu,
  gambar,
  jarak_m = null,
  akurasi = null,
  lokasi_teks = null,
  lokasi_meragukan = false,
  ulangKirim = null,
}) {
```

Di template setelah tombol `[data-ulang]`, sisipkan:

```html
${ulangKirim ? '<button type="button" data-kirim-ulang class="' + TOMBOL_ULANG + '">Kirim ulang absen</button>' : ''}
```

Di bawah listener `[data-ulang]`, tambahkan:

```js
panggung.querySelector('[data-kirim-ulang]')?.addEventListener('click', () => {
  if (!ulangKirim) return;
  bersihkanTimer();
  ulangKirim();
});
```

Pengumuman pembaca layar untuk hasil kiosk dikerjakan di Task 11 supaya
`aria-live` hanya ditambahkan sekali.

- [ ] **Step 4: Perbarui komentar timer**

Komentar di atas `const JEDA_HASIL` tidak berubah. Pastikan `jadwalkan` masih dipakai untuk percobaan ulang; tidak ada timer baru di luar `timers`.

- [ ] **Step 5: Uji manual di browser**

Run:

```bash
npm run dev
```

Langkah:

1. Buka `#/absen`, isi NIP/PIN, pilih "Di perusahaan", tunggu foto terkirim.
2. Sebelum menekan absen, buka DevTools → Network → Offline.
3. Kirim absen. Pastikan layar menampilkan "Mengirim ulang absen…" lalu "Koneksi terputus" dengan tombol "Kirim ulang absen".
4. Online-kan jaringan, tekan "Kirim ulang absen". Pastikan absen tercatat satu kali (cek `GET /admin/laporan/harian`).
5. Ulangi dengan server dimatikan; setelah 30 detik pesan batas waktu muncul, bukan menggantung.
6. Pastikan tombol "Mulai lagi" tetap bekerja dan kamera dimatikan.

Expected: tidak ada baris absen ganda; foto tidak diambil ulang saat kirim ulang.

- [ ] **Step 6: Build dan commit**

Run:

```bash
npm run build
```

Expected: lulus; `dist` tidak memuat mode tiruan.

```bash
git add src/api.js src/views/absen.js
git commit -m "fix: kiosk mengirim ulang absen dengan kunci idempoten"
```

---

### Task 6: Catatan percobaan masuk dan endpoint anomali

**Files:**
- Modify: `KONTRAK-API.md` (bagian "Yang belum ada" diganti bagian anomali)
- Create: `backend/database/migrations/2026_10_28_000003_create_percobaan_masuk_table.php`
- Create: `backend/app/Models/PercobaanMasuk.php`
- Modify: `backend/app/Http/Controllers/KioskController.php` (catat percobaan)
- Create: `backend/app/Support/Anomali.php`
- Create: `backend/app/Http/Controllers/AdminAnomaliController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/config/absensi.php`
- Modify: `backend/.env.example`
- Test: `backend/tests/Feature/AdminAnomaliTest.php`, `backend/tests/Feature/PercobaanMasukTest.php`

**Interfaces:**
- Consumes: `Absen` (koordinat, `jarak_m`, `akurasi`, `lokasi_meragukan`, `foto_path`, `ip`, `mode`), `PercobaanMasuk`, `Geo::jarakMeter`, konfigurasi `absensi.ip_kantor`.
- Produces: `GET /admin/anomali?dari=YYYY-MM-DD&sampai=YYYY-MM-DD` → `{dari, sampai, data: [{jenis, tingkat, judul, keterangan, absen_id, pengguna_id, nama, nip, waktu}]}`; jenis: `pin_salah_berulang`, `lokasi_meragukan`, `jarak_jauh`, `perpindahan_mustahil`, `ip_di_luar_kantor`, `foto_hilang`.

- [ ] **Step 1: Tambahkan bagian kontrak anomali**

Di `KONTRAK-API.md`, ganti paragraf `GET /admin/anomali` di "Yang belum ada" dengan bagian baru sebelum "Foto selfie":

```markdown
### Anomali

#### `GET /admin/anomali?dari=2026-10-01&sampai=2026-10-07`

Admin saja. Rentang maksimal 31 hari; bawaan 7 hari terakhir. Semua tanggal
memakai `Asia/Jakarta`.

```json
{
  "dari": "2026-10-01",
  "sampai": "2026-10-07",
  "data": [
    {
      "jenis": "pin_salah_berulang",
      "tingkat": "tinggi",
      "judul": "PIN salah berulang",
      "keterangan": "5 percobaan gagal untuk NIP MGG002 dalam 10 menit.",
      "absen_id": null,
      "pengguna_id": 7,
      "nama": "Siti Rahayu",
      "nip": "MGG002",
      "waktu": "2026-10-07T08:12:00+07:00"
    }
  ]
}
```

Jenis yang wajib ada:

| `jenis` | `tingkat` | Arti |
|---|---|---|
| `pin_salah_berulang` | `tinggi` | ≥5 percobaan masuk gagal untuk NIP yang sama dalam 10 menit. |
| `lokasi_meragukan` | `sedang` | Absen `luar` dengan `lokasi_meragukan` atau akurasi >50 m. |
| `jarak_jauh` | `rendah` | Absen `luar` dengan `jarak_m` > 100 km. Bukan tuduhan; dinas luar boleh jauh. |
| `perpindahan_mustahil` | `tinggi` | Dua absen berkoordinat menunjukkan kecepatan >900 km/jam dan jarak ≥5 km. |
| `ip_di_luar_kantor` | `rendah` | Hanya muncul kalau `ABSEN_IP_KANTOR` diisi dan IP absen tidak ada di daftar. |
| `foto_hilang` | `sedang` | Baris absen tidak punya `foto_path` (data lama atau berkas hilang). |

Anomali adalah petunjuk untuk diperiksa, bukan keputusan otomatis. Tidak ada
endpoint untuk mengubah atau menghapus anomali.
```

- [ ] **Step 2: Tulis tes percobaan masuk yang gagal**

Buat `backend/tests/Feature/PercobaanMasukTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PercobaanMasuk;
use App\Models\PerangkatKiosk;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PercobaanMasukTest extends TestCase
{
    use RefreshDatabase;

    private PerangkatKiosk $kiosk;

    private Lokasi $lokasi;

    private Shift $shift;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Cache::flush();
        Http::fake(['nominatim.openstreetmap.org/*' => Http::response([], 500)]);
        Carbon::setTestNow(Carbon::parse('2026-10-19 08:30:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $this->shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);
        $this->kiosk = PerangkatKiosk::create([
            'id' => 'kiosk-catatan', 'nama' => 'Kiosk Catatan',
            'lokasi_id' => $this->lokasi->id, 'aktif' => true, 'created_at' => now(),
        ]);

        Pengguna::create([
            'nama' => 'Siti', 'nip' => 'MGG201', 'pin_hash' => Hash::make('1357'),
            'peran' => 'magang', 'divisi' => 'Pendataan', 'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id, 'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12, 'aktif' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_pin_salah_dicatat_tanpa_pin_mentah(): void
    {
        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG201',
            'pin' => '9999',
            'kiosk_id' => $this->kiosk->id,
            'foto' => $this->foto(),
        ])->assertStatus(401);

        $catatan = PercobaanMasuk::firstOrFail();

        $this->assertFalse($catatan->berhasil);
        $this->assertSame('kredensial_salah', $catatan->alasan);
        $this->assertSame('MGG201', $catatan->nip);
        $this->assertStringNotContainsString('9999', json_encode($catatan->toArray()));
    }

    public function test_pin_benar_dicatat_berhasil(): void
    {
        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG201',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ])->assertOk();

        $catatan = PercobaanMasuk::firstOrFail();

        $this->assertTrue($catatan->berhasil);
        $this->assertNull($catatan->alasan);
    }

    private function foto(): string
    {
        return 'data:image/jpeg;base64,'.base64_encode(
            "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9"
        );
    }
}
```

- [ ] **Step 3: Tulis tes anomali yang gagal**

Buat `backend/tests/Feature/AdminAnomaliTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PercobaanMasuk;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAnomaliTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $admin;

    private Pengguna $magang;

    private Lokasi $lokasi;

    private Shift $shift;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-07 12:00:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $this->shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);
        $this->admin = $this->buatPengguna('ADM301', 'admin');
        $this->magang = $this->buatPengguna('MGG301', 'magang');
        $this->token = $this->tokenUntuk($this->admin);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_menandai_pin_salah_berulang(): void
    {
        for ($i = 0; $i < 5; $i++) {
            PercobaanMasuk::create([
                'pengguna_id' => $this->magang->id,
                'nip' => 'MGG301',
                'kiosk_id' => 'kiosk-uji',
                'ip' => '10.0.0.1',
                'berhasil' => false,
                'alasan' => 'kredensial_salah',
                'created_at' => now()->subMinutes($i),
            ]);
        }

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-10-07&sampai=2026-10-07')
            ->assertOk()
            ->assertJsonFragment(['jenis' => 'pin_salah_berulang', 'tingkat' => 'tinggi']);
    }

    public function test_menandai_lokasi_kasar_dan_perpindahan_mustahil(): void
    {
        Absen::create($this->absen([
            'waktu' => now()->subMinutes(10),
            'mode' => 'luar',
            'lintang' => -6.2,
            'bujur' => 106.8,
            'akurasi' => 80,
            'lokasi_meragukan' => true,
            'jarak_m' => 400,
        ]));

        Absen::create($this->absen([
            'tipe' => 'pulang',
            'waktu' => now()->subMinutes(5),
            'mode' => 'luar',
            'lintang' => -7.2575,
            'bujur' => 112.7521,
            'akurasi' => 20,
            'lokasi_meragukan' => false,
            'jarak_m' => 700000,
        ]));

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-10-07&sampai=2026-10-07')
            ->assertOk()
            ->assertJsonFragment(['jenis' => 'lokasi_meragukan'])
            ->assertJsonFragment(['jenis' => 'perpindahan_mustahil'])
            ->assertJsonFragment(['jenis' => 'jarak_jauh']);
    }

    public function test_rentang_lebih_dari_31_hari_ditolak(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-01-01&sampai=2026-03-01')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_terlalu_lama');
    }

    private function buatPengguna(string $nip, string $peran): Pengguna
    {
        return Pengguna::create([
            'nama' => 'Orang '.$nip, 'nip' => $nip, 'pin_hash' => Hash::make('1357'),
            'peran' => $peran, 'divisi' => 'Pendataan', 'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id, 'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12, 'aktif' => true,
        ]);
    }

    private function tokenUntuk(Pengguna $pengguna): string
    {
        $token = bin2hex(random_bytes(32));
        Sesi::create([
            'pengguna_id' => $pengguna->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHours(12),
            'last_used_at' => now(),
            'created_at' => now(),
        ]);

        return $token;
    }

    private function absen(array $ubah): array
    {
        return array_merge([
            'pengguna_id' => $this->magang->id,
            'tanggal' => now()->toDateString(),
            'tipe' => 'masuk',
            'waktu' => now(),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'foto_path' => 'absen/uji.jpg',
            'kiosk_id' => 'kiosk-uji',
            'ip' => '10.0.0.1',
            'created_at' => now(),
        ], $ubah);
    }
}
```

- [ ] **Step 4: Jalankan tes dan pastikan gagal**

Run:

```bash
cd backend
php artisan test --filter='PercobaanMasukTest|AdminAnomaliTest'
```

Expected: FAIL karena tabel, model, endpoint, dan pencatatan belum ada.

- [ ] **Step 5: Tambahkan konfigurasi**

Di `backend/config/absensi.php`, sebelum `'seed'`:

```php
'ip_kantor' => array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('ABSEN_IP_KANTOR', ''))
))),

'anomali_jarak_m' => (int) env('ABSEN_ANOMALI_JARAK_M', 100000),

'foto_simpan_hari' => (int) env('ABSEN_FOTO_SIMPAN_HARI', 180),
'audit_simpan_hari' => (int) env('ABSEN_AUDIT_SIMPAN_HARI', 730),
```

Di `backend/.env.example`, setelah `NOMINATIM_USER_AGENT`:

```dotenv
# Kosong = pemeriksaan IP kantor mati. Isi daftar dipisah koma untuk menandai
# absen dari luar IP kantor sebagai anomali (tidak menolak absen).
ABSEN_IP_KANTOR=

ABSEN_ANOMALI_JARAK_M=100000
ABSEN_FOTO_SIMPAN_HARI=180
ABSEN_AUDIT_SIMPAN_HARI=730
```

- [ ] **Step 6: Buat migrasi dan model percobaan masuk**

Buat `backend/database/migrations/2026_10_28_000003_create_percobaan_masuk_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('percobaan_masuk', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengguna_id')->nullable()->constrained('pengguna')->nullOnDelete();
            $table->string('nip', 30);
            $table->string('kiosk_id', 64);
            $table->string('ip', 45)->nullable();
            $table->boolean('berhasil')->default(false);
            $table->string('alasan', 40)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['nip', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('percobaan_masuk');
    }
};
```

Buat `backend/app/Models/PercobaanMasuk.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PercobaanMasuk extends Model
{
    protected $table = 'percobaan_masuk';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'berhasil' => 'boolean',
        'created_at' => 'datetime',
    ];
}
```

- [ ] **Step 7: Catat percobaan di KioskController**

Tambahkan impor:

```php
use App\Models\PercobaanMasuk;
```

Tambahkan helper sebelum `bacaFoto`:

```php
private function catatPercobaan(
    string $nip,
    ?int $penggunaId,
    string $kioskId,
    string $ip,
    bool $berhasil,
    ?string $alasan = null
): void {
    PercobaanMasuk::create([
        'pengguna_id' => $penggunaId,
        'nip' => $nip,
        'kiosk_id' => $kioskId,
        'ip' => $ip,
        'berhasil' => $berhasil,
        'alasan' => $alasan,
        'created_at' => now(),
    ]);
}
```

Pada cabang kredensial salah, sebelum `return $this->galat('NIP atau PIN salah.'...)`, tambahkan:

```php
$this->catatPercobaan($nip, $pengguna?->id, $kioskId, $ip, false, 'kredensial_salah');
```

Pada cabang akun nonaktif, sebelum return, tambahkan:

```php
$this->catatPercobaan($nip, $pengguna->id, $kioskId, $ip, false, 'akun_nonaktif');
```

Pada cabang perangkat tidak dikenal/nonaktif, sebelum return, tambahkan:

```php
$this->catatPercobaan($nip, $pengguna->id, $kioskId, $ip, false, 'perangkat_ditolak');
```

Setelah `RateLimiter::clear($kunci[0]);` dan sebelum cek `aktif`, jangan mencatat apa pun. Catat keberhasilan tepat sebelum `return $this->jawabanAbsen($absen, false);`:

```php
$this->catatPercobaan($nip, $pengguna->id, $kioskId, $ip, true);
```

Jangan mencatat pada replay idempoten, supaya percobaan ulang tidak menggandakan catatan.

- [ ] **Step 8: Buat kelas Anomali**

Buat `backend/app/Support/Anomali.php`:

```php
<?php

namespace App\Support;

use App\Models\Absen;
use App\Models\PercobaanMasuk;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class Anomali
{
    public static function kumpulkan(Carbon $dari, Carbon $sampai): array
    {
        return collect()
            ->merge(self::pinSalah($dari, $sampai))
            ->merge(self::lokasiKasar($dari, $sampai))
            ->merge(self::jarakJauh($dari, $sampai))
            ->merge(self::perpindahanMustahil($dari, $sampai))
            ->merge(self::ipLuarKantor($dari, $sampai))
            ->merge(self::fotoHilang($dari, $sampai))
            ->sortByDesc('waktu')
            ->values()
            ->all();
    }

    private static function pinSalah(Carbon $dari, Carbon $sampai): Collection
    {
        return PercobaanMasuk::query()
            ->where('berhasil', false)
            ->whereBetween('created_at', [$dari, $sampai])
            ->selectRaw('nip, COUNT(*) as jumlah, MAX(created_at) as terakhir')
            ->groupBy('nip')
            ->havingRaw('COUNT(*) >= 5')
            ->get()
            ->map(function ($baris) {
                $terakhir = PercobaanMasuk::where('nip', $baris->nip)
                    ->where('berhasil', false)
                    ->whereBetween('created_at', [$dari, $sampai])
                    ->latest('created_at')
                    ->first();

                return [
                    'jenis' => 'pin_salah_berulang',
                    'tingkat' => 'tinggi',
                    'judul' => 'PIN salah berulang',
                    'keterangan' => $baris->jumlah.' percobaan gagal untuk NIP '.$baris->nip.'.',
                    'absen_id' => null,
                    'pengguna_id' => $terakhir?->pengguna_id,
                    'nama' => null,
                    'nip' => $baris->nip,
                    'waktu' => Carbon::parse($baris->terakhir)->toIso8601String(),
                ];
            });
    }

    private static function lokasiKasar(Carbon $dari, Carbon $sampai): Collection
    {
        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->where('mode', 'luar')
            ->where(function ($q) {
                $q->where('lokasi_meragukan', true)->orWhere('akurasi', '>', 50);
            })
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'lokasi_meragukan',
                'sedang',
                'Lokasi kasar',
                'Absen luar dengan akurasi '.($a->akurasi ?? '?').' m.'
            ));
    }

    private static function jarakJauh(Carbon $dari, Carbon $sampai): Collection
    {
        $batas = (int) config('absensi.anomali_jarak_m', 100000);

        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->where('mode', 'luar')
            ->where('jarak_m', '>', $batas)
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'jarak_jauh',
                'rendah',
                'Jarak jauh dari kantor',
                'Absen luar '.round($a->jarak_m / 1000).' km dari kantor. Dinas luar boleh jauh; periksa hanya jika tidak sesuai.',
            ));
    }

    private static function perpindahanMustahil(Carbon $dari, Carbon $sampai): Collection
    {
        $baris = Absen::whereBetween('tanggal', [
            $dari->copy()->subDay()->toDateString(),
            $sampai->toDateString(),
        ])
            ->whereNotNull('lintang')
            ->whereNotNull('bujur')
            ->orderBy('pengguna_id')
            ->orderBy('waktu')
            ->get();

        $hasil = collect();

        foreach ($baris->groupBy('pengguna_id') as $daftar) {
            $sebelum = null;

            foreach ($daftar as $sekarang) {
                if ($sebelum && $sekarang->waktu->between($dari, $sampai)) {
                    $detik = (int) $sebelum->waktu->diffInSeconds($sekarang->waktu);
                    $meter = Geo::jarakMeter(
                        (float) $sebelum->lintang,
                        (float) $sebelum->bujur,
                        (float) $sekarang->lintang,
                        (float) $sekarang->bujur
                    );

                    $kmJam = $detik > 0 ? ($meter / 1000) / ($detik / 3600) : 0;

                    if ($detik > 0 && $meter >= 5000 && $kmJam > 900) {
                        $hasil->push(self::dariAbsen(
                            $sekarang,
                            'perpindahan_mustahil',
                            'tinggi',
                            'Perpindahan mustahil',
                            'Berpindah '.round($meter / 1000).' km dalam '.round($detik / 60).' menit.'
                        ));
                    }
                }

                $sebelum = $sekarang;
            }
        }

        return $hasil;
    }

    private static function ipLuarKantor(Carbon $dari, Carbon $sampai): Collection
    {
        $daftar = config('absensi.ip_kantor', []);

        if ($daftar === []) {
            return collect();
        }

        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->whereNotNull('ip')
            ->whereNotIn('ip', $daftar)
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'ip_di_luar_kantor',
                'rendah',
                'IP di luar kantor',
                'Absen datang dari IP '.$a->ip.'.'
            ));
    }

    private static function fotoHilang(Carbon $dari, Carbon $sampai): Collection
    {
        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->whereNull('foto_path')
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'foto_hilang',
                'sedang',
                'Foto tidak tersedia',
                'Baris absen tidak punya foto.'
            ));
    }

    private static function dariAbsen(
        Absen $absen,
        string $jenis,
        string $tingkat,
        string $judul,
        string $keterangan
    ): array {
        return [
            'jenis' => $jenis,
            'tingkat' => $tingkat,
            'judul' => $judul,
            'keterangan' => $keterangan,
            'absen_id' => $absen->id,
            'pengguna_id' => $absen->pengguna_id,
            'nama' => $absen->nama_salinan,
            'nip' => $absen->nip_salinan,
            'waktu' => $absen->waktu->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 9: Buat controller dan rute**

Buat `backend/app/Http/Controllers/AdminAnomaliController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Support\Anomali;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminAnomaliController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
        ], [
            'dari.date_format' => 'Tanggal awal harus berformat YYYY-MM-DD.',
            'sampai.date_format' => 'Tanggal akhir harus berformat YYYY-MM-DD.',
        ]);

        $sampai = isset($data['sampai'])
            ? Carbon::createFromFormat('Y-m-d', $data['sampai'], 'Asia/Jakarta')->endOfDay()
            : now()->endOfDay();

        $dari = isset($data['dari'])
            ? Carbon::createFromFormat('Y-m-d', $data['dari'], 'Asia/Jakarta')->startOfDay()
            : $sampai->copy()->subDays(6)->startOfDay();

        if ($dari->greaterThan($sampai)) {
            return $this->galat('Tanggal awal tidak boleh setelah tanggal akhir.', 422, 'rentang_tidak_valid');
        }

        if ($dari->diffInDays($sampai) > 31) {
            return $this->galat('Rentang anomali maksimal 31 hari.', 422, 'rentang_terlalu_lama');
        }

        return response()->json([
            'dari' => $dari->toDateString(),
            'sampai' => $sampai->toDateString(),
            'data' => Anomali::kumpulkan($dari, $sampai),
        ]);
    }
}
```

Di `backend/routes/api.php`, tambahkan impor:

```php
use App\Http\Controllers\AdminAnomaliController;
```

dan rute di grup admin setelah dashboard:

```php
Route::get('/anomali', [AdminAnomaliController::class, 'index']);
```

- [ ] **Step 10: Jalankan tes sampai lulus**

Run:

```bash
cd backend
php artisan test --filter='PercobaanMasukTest|AdminAnomaliTest'
php artisan test --filter=Fase1Test
```

Expected: semua lulus. Kalau `PercobaanMasukTest` gagal karena rate limit tersisa, `Cache::flush()` di setup sudah menanganinya.

- [ ] **Step 11: Commit**

```bash
git add KONTRAK-API.md backend/config/absensi.php backend/.env.example backend/database/migrations/2026_10_28_000003_create_percobaan_masuk_table.php backend/app/Models/PercobaanMasuk.php backend/app/Support/Anomali.php backend/app/Http/Controllers/AdminAnomaliController.php backend/app/Http/Controllers/KioskController.php backend/routes/api.php backend/tests/Feature/PercobaanMasukTest.php backend/tests/Feature/AdminAnomaliTest.php
git commit -m "feat: catat percobaan masuk dan endpoint anomali admin"
```

---

### Task 7: Endpoint log audit admin

**Files:**
- Modify: `KONTRAK-API.md` (bagian baru "Log audit" sebelum "Ekspor CSV")
- Modify: `backend/app/Models/Audit.php`
- Create: `backend/app/Http/Controllers/AdminAuditController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/AdminAuditTest.php`

**Interfaces:**
- Consumes: tabel `audit`, relasi `pengguna`, middleware admin.
- Produces: `GET /admin/audit?aksi=&pengguna_id=&dari=&sampai=&halaman=1&per=50` → `{data: [...], meta: {halaman, per, total, terakhir}}`; urut terbaru; rentang maksimal 90 hari, bawaan 30 hari; `per` maksimal 100.

- [ ] **Step 1: Tambahkan kontrak audit**

Di `KONTRAK-API.md`, sebelum `### Ekspor CSV`:

```markdown
### Log audit

#### `GET /admin/audit?dari=2026-10-01&sampai=2026-10-07&aksi=tambah_magang&halaman=1&per=50`

Admin saja. Menampilkan audit terbaru lebih dulu. Rentang maksimal 90 hari;
bawaan 30 hari terakhir. `per` 1–100, bawaan 50.

```json
{
  "data": [
    {
      "id": 120,
      "waktu": "2026-10-07T09:15:00+07:00",
      "aksi": "tambah_magang",
      "pengguna_id": 1,
      "aktor": { "nama": "Administrator", "nip": "ADM001" },
      "rincian": { "pengguna_id": 7, "nip": "MGG002" },
      "ip": "10.0.0.5",
      "user_agent": "Mozilla/5.0"
    }
  ],
  "meta": { "halaman": 1, "per": 50, "total": 1, "terakhir": 1 }
}
```

Tidak ada endpoint mengubah atau menghapus audit. PIN, token, `pin_hash`, dan
isi foto tidak boleh muncul di `rincian`.
```

- [ ] **Step 2: Tulis tes yang gagal**

Buat `backend/tests/Feature/AdminAuditTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAuditTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $admin;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-07 12:00:00', 'Asia/Jakarta'));

        $lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);

        $this->admin = Pengguna::create([
            'nama' => 'Administrator', 'nip' => 'ADM401', 'pin_hash' => Hash::make('1357'),
            'peran' => 'admin', 'divisi' => 'Management Data', 'shift_id' => $shift->id,
            'lokasi_id' => $lokasi->id, 'masuk_kerja' => '2026-01-01', 'cuti_kuota' => 12,
            'aktif' => true,
        ]);

        $this->token = bin2hex(random_bytes(32));
        Sesi::create([
            'pengguna_id' => $this->admin->id,
            'token_hash' => hash('sha256', $this->token),
            'expires_at' => now()->addHours(12),
            'last_used_at' => now(),
            'created_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_menampilkan_audit_terbaru_dengan_aktor(): void
    {
        Audit::create([
            'pengguna_id' => $this->admin->id,
            'aksi' => 'tambah_magang',
            'rincian' => ['pengguna_id' => 7, 'nip' => 'MGG002'],
            'ip' => '10.0.0.5',
            'user_agent' => 'Mozilla/5.0',
            'created_at' => now()->subMinute(),
        ]);
        Audit::create([
            'pengguna_id' => $this->admin->id,
            'aksi' => 'ubah_lokasi',
            'rincian' => ['lokasi_id' => 2],
            'ip' => '10.0.0.5',
            'user_agent' => 'Mozilla/5.0',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/audit')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.aksi', 'ubah_lokasi')
            ->assertJsonPath('data.0.aktor.nip', 'ADM401')
            ->assertJsonPath('data.1.aksi', 'tambah_magang');
    }

    public function test_filter_aksi_dan_paginasi(): void
    {
        foreach (['tambah_magang', 'ubah_magang', 'tambah_magang'] as $i => $aksi) {
            Audit::create([
                'pengguna_id' => $this->admin->id,
                'aksi' => $aksi,
                'rincian' => ['ke' => $i],
                'created_at' => now()->subMinutes($i),
            ]);
        }

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/audit?aksi=tambah_magang&per=1&halaman=2')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.halaman', 2)
            ->assertJsonPath('meta.terakhir', 2)
            ->assertJsonCount(1, 'data');
    }

    public function test_rentang_lebih_dari_90_hari_ditolak(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/audit?dari=2026-01-01&sampai=2026-06-01')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_terlalu_lama');
    }
}
```

- [ ] **Step 3: Jalankan tes dan pastikan gagal**

Run:

```bash
cd backend
php artisan test --filter=AdminAuditTest
```

Expected: FAIL karena relasi dan endpoint belum ada.

- [ ] **Step 4: Tambahkan relasi pengguna di model Audit**

Di `backend/app/Models/Audit.php`, tambahkan impor:

```php
use Illuminate\Database\Eloquent\Relations\BelongsTo;
```

dan method:

```php
public function pengguna(): BelongsTo
{
    return $this->belongsTo(Pengguna::class, 'pengguna_id');
}
```

- [ ] **Step 5: Buat controller dan rute**

Buat `backend/app/Http/Controllers/AdminAuditController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'aksi' => ['nullable', 'string', 'max:80'],
            'pengguna_id' => ['nullable', 'integer', 'min:1'],
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
            'halaman' => ['nullable', 'integer', 'min:1'],
            'per' => ['nullable', 'integer', 'min:1', 'max:100'],
        ], [
            'dari.date_format' => 'Tanggal awal harus berformat YYYY-MM-DD.',
            'sampai.date_format' => 'Tanggal akhir harus berformat YYYY-MM-DD.',
        ]);

        $sampai = isset($data['sampai'])
            ? Carbon::createFromFormat('Y-m-d', $data['sampai'], 'Asia/Jakarta')->endOfDay()
            : now()->endOfDay();

        $dari = isset($data['dari'])
            ? Carbon::createFromFormat('Y-m-d', $data['dari'], 'Asia/Jakarta')->startOfDay()
            : $sampai->copy()->subDays(29)->startOfDay();

        if ($dari->greaterThan($sampai)) {
            return $this->galat('Tanggal awal tidak boleh setelah tanggal akhir.', 422, 'rentang_tidak_valid');
        }

        if ($dari->diffInDays($sampai) > 90) {
            return $this->galat('Rentang audit maksimal 90 hari.', 422, 'rentang_terlalu_lama');
        }

        $kueri = Audit::with('pengguna:id,nama,nip')
            ->whereBetween('created_at', [$dari, $sampai])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (! empty($data['aksi'])) {
            $kueri->where('aksi', $data['aksi']);
        }

        if (! empty($data['pengguna_id'])) {
            $kueri->where('pengguna_id', (int) $data['pengguna_id']);
        }

        $hasil = $kueri->paginate(
            (int) ($data['per'] ?? 50),
            ['id', 'pengguna_id', 'aksi', 'rincian', 'ip', 'user_agent', 'created_at'],
            'halaman',
            (int) ($data['halaman'] ?? 1)
        );

        return response()->json([
            'data' => collect($hasil->items())->map(fn (Audit $audit) => [
                'id' => $audit->id,
                'waktu' => $audit->created_at->toIso8601String(),
                'aksi' => $audit->aksi,
                'pengguna_id' => $audit->pengguna_id,
                'aktor' => $audit->pengguna ? [
                    'nama' => $audit->pengguna->nama,
                    'nip' => $audit->pengguna->nip,
                ] : null,
                'rincian' => $audit->rincian ?? [],
                'ip' => $audit->ip,
                'user_agent' => $audit->user_agent,
            ])->all(),
            'meta' => [
                'halaman' => $hasil->currentPage(),
                'per' => $hasil->perPage(),
                'total' => $hasil->total(),
                'terakhir' => $hasil->lastPage(),
            ],
        ]);
    }
}
```

Di `backend/routes/api.php`, tambahkan impor `AdminAuditController` dan rute
**di dalam grup `auth.token` + `admin`**, setelah dashboard:

```php
Route::get('/audit', [AdminAuditController::class, 'index']);
```

- [ ] **Step 6: Jalankan tes sampai lulus**

Run:

```bash
cd backend
php artisan test --filter=AdminAuditTest
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add KONTRAK-API.md backend/app/Models/Audit.php backend/app/Http/Controllers/AdminAuditController.php backend/routes/api.php backend/tests/Feature/AdminAuditTest.php
git commit -m "feat: endpoint log audit admin dengan filter dan paginasi"
```

---

### Task 8: Layar audit dan anomali di frontend

**Files:**
- Create: `src/views/audit.js`, `src/views/anomali.js`
- Modify: `src/menu.js:96-98`, `src/main.js:20-24`
- Test: `npm run build`; manual browser dengan admin

**Interfaces:**
- Consumes: `GET /admin/audit`, `GET /admin/anomali`, `pasangKerangka`, `tabel`, `pesanGalat`, `KARTU`.
- Produces: menu "Sistem" dengan "Log Audit" dan "Anomali", hanya untuk admin; rute `#/audit` dan `#/anomali`.

- [ ] **Step 1: Buat layar audit**

Buat `src/views/audit.js`:

```js
import { api } from '../api.js';
import { esc, waktu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, tabel, pesanGalat, TOMBOL_HALUS } from '../tabel.js';

const KELAS_TANGGAL =
  'rounded-xl border border-ink/12 bg-white/75 px-3 py-2 text-sm text-ink outline-none focus:border-merek';

function tanggalISO(geserHari = 0) {
  return new Date(Date.now() + geserHari * 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
}

export default {
  judul: 'Log Audit',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Log Audit' });

    isi.innerHTML = `
      <div class="${KARTU}">
        <form data-filter class="flex flex-wrap items-end gap-3">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Dari</span>
            <input type="date" name="dari" value="${tanggalISO(-6)}" class="${KELAS_TANGGAL}" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Sampai</span>
            <input type="date" name="sampai" value="${tanggalISO()}" class="${KELAS_TANGGAL}" />
          </label>
          <label class="min-w-52 flex-1 text-sm">
            <span class="mb-1 block font-medium text-ink">Aksi</span>
            <input name="aksi" placeholder="Semua aksi" class="w-full ${KELAS_TANGGAL}" />
          </label>
          <button type="submit" class="${TOMBOL_HALUS}">Tampilkan</button>
        </form>

        <div data-tabel class="mt-5"></div>
      </div>`;

    const form = isi.querySelector('[data-filter]');
    const kotak = isi.querySelector('[data-tabel]');
    let halaman = 1;
    let meta = null;

    const kolom = [
      { judul: 'Waktu', sel: (a) => `<span class="whitespace-nowrap">${esc(waktu(a.waktu))}</span>` },
      {
        judul: 'Aktor',
        sel: (a) =>
          a.aktor
            ? `<span class="font-medium text-ink">${esc(a.aktor.nama)}</span>
               <span class="block text-xs text-muted">${esc(a.aktor.nip)}</span>`
            : '<span class="text-muted">Sistem</span>',
      },
      { judul: 'Aksi', sel: (a) => `<span class="font-medium text-ink">${esc(a.aksi)}</span>` },
      {
        judul: 'Rincian',
        sel: (a) =>
          `<code class="block max-w-md break-words text-xs text-muted">${esc(JSON.stringify(a.rincian))}</code>`,
      },
      { judul: 'IP', sel: (a) => `<span class="text-muted">${esc(a.ip ?? '—')}</span>` },
    ];

    function gambar() {
      kotak.innerHTML = `
        ${tabel({
          judul: 'Log audit',
          kolom,
          baris: data,
          kosong: 'Tidak ada audit pada rentang ini.',
        })}
        <div class="mt-4 flex items-center justify-between text-sm text-muted">
          <span>${meta.total} catatan · halaman ${meta.halaman} dari ${meta.terakhir}</span>
          <span class="flex gap-2">
            <button type="button" data-sebelum ${meta.halaman <= 1 ? 'disabled' : ''}
              class="${TOMBOL_HALUS} disabled:opacity-40">Sebelumnya</button>
            <button type="button" data-berikut ${meta.halaman >= meta.terakhir ? 'disabled' : ''}
              class="${TOMBOL_HALUS} disabled:opacity-40">Berikutnya</button>
          </span>
        </div>`;

      kotak.querySelector('[data-sebelum]')?.addEventListener('click', () => {
        if (meta.halaman > 1) {
          halaman -= 1;
          muat();
        }
      });
      kotak.querySelector('[data-berikut]')?.addEventListener('click', () => {
        if (meta.halaman < meta.terakhir) {
          halaman += 1;
          muat();
        }
      });
    }

    let data = [];

    async function muat() {
      kotak.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat audit…</p>';

      const kueri = new URLSearchParams({
        dari: form.elements.dari.value,
        sampai: form.elements.sampai.value,
        halaman: String(halaman),
        per: '50',
      });

      if (form.elements.aksi.value.trim()) kueri.set('aksi', form.elements.aksi.value.trim());

      try {
        const jawab = await api.get(`/admin/audit?${kueri}`);
        data = jawab.data;
        meta = jawab.meta;
        gambar();
      } catch (galat) {
        kotak.innerHTML = pesanGalat(galat.message);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      halaman = 1;
      muat();
    });

    muat();
  },
};
```

- [ ] **Step 2: Buat layar anomali**

Buat `src/views/anomali.js`:

```js
import { api } from '../api.js';
import { esc, waktu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, tabel, pesanGalat, TOMBOL_HALUS } from '../tabel.js';

const KELAS_TANGGAL =
  'rounded-xl border border-ink/12 bg-white/75 px-3 py-2 text-sm text-ink outline-none focus:border-merek';

const LABEL_JENIS = {
  pin_salah_berulang: 'PIN salah berulang',
  lokasi_meragukan: 'Lokasi kasar',
  jarak_jauh: 'Jarak jauh',
  perpindahan_mustahil: 'Perpindahan mustahil',
  ip_di_luar_kantor: 'IP di luar kantor',
  foto_hilang: 'Foto hilang',
};

const WARNA_TINGKAT = {
  tinggi: 'bg-rose-500/12 text-rose-700',
  sedang: 'bg-amber-500/15 text-amber-800',
  rendah: 'bg-ink/8 text-muted',
};

function tanggalISO(geserHari = 0) {
  return new Date(Date.now() + geserHari * 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
}

export default {
  judul: 'Anomali',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Anomali' });

    isi.innerHTML = `
      <div class="${KARTU}">
        <p class="text-sm text-muted">
          Anomali adalah petunjuk untuk diperiksa, bukan tuduhan. Jarak jauh dari kantor
          bukan pelanggaran; dinas luar memang boleh jauh.
        </p>

        <form data-filter class="mt-4 flex flex-wrap items-end gap-3">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Dari</span>
            <input type="date" name="dari" value="${tanggalISO(-6)}" class="${KELAS_TANGGAL}" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Sampai</span>
            <input type="date" name="sampai" value="${tanggalISO()}" class="${KELAS_TANGGAL}" />
          </label>
          <button type="submit" class="${TOMBOL_HALUS}">Tampilkan</button>
        </form>

        <div data-daftar class="mt-5"></div>
      </div>`;

    const form = isi.querySelector('[data-filter]');
    const kotak = isi.querySelector('[data-daftar]');

    const kolom = [
      { judul: 'Waktu', sel: (a) => `<span class="whitespace-nowrap">${esc(waktu(a.waktu))}</span>` },
      {
        judul: 'Orang',
        sel: (a) =>
          `<span class="font-medium text-ink">${esc(a.nama ?? a.nip ?? '—')}</span>
           <span class="block text-xs text-muted">${esc(a.nip ?? '')}</span>`,
      },
      {
        judul: 'Jenis',
        sel: (a) =>
          `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            WARNA_TINGKAT[a.tingkat] ?? WARNA_TINGKAT.rendah
          }">${esc(LABEL_JENIS[a.jenis] ?? a.jenis)}</span>`,
      },
      { judul: 'Keterangan', sel: (a) => `<span class="text-muted">${esc(a.keterangan)}</span>` },
    ];

    async function muat() {
      kotak.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat anomali…</p>';

      const kueri = new URLSearchParams({
        dari: form.elements.dari.value,
        sampai: form.elements.sampai.value,
      });

      try {
        const jawab = await api.get(`/admin/anomali?${kueri}`);
        kotak.innerHTML = tabel({
          judul: 'Daftar anomali',
          kolom,
          baris: jawab.data,
          kosong: 'Tidak ada anomali pada rentang ini.',
        });
      } catch (galat) {
        kotak.innerHTML = pesanGalat(galat.message);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      muat();
    });

    muat();
  },
};
```

- [ ] **Step 3: Daftarkan menu dan rute**

Di `src/menu.js`, tambahkan bagian sebelum penutup array `MENU`:

```js
{
  bagian: 'Sistem',
  butir: [
    {
      jalur: '#/audit',
      label: 'Log Audit',
      peran: ['admin'],
      ikon: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2v-16a1 1 0 0 1 1-1Z"/><path d="M9.5 8h5"/><path d="M9.5 11.5h5"/>',
    },
    {
      jalur: '#/anomali',
      label: 'Anomali',
      peran: ['admin'],
      ikon: '<path d="M12 3.5 21 20H3L12 3.5Z"/><path d="M12 9v5"/><path d="M12 17.2h.01"/>',
    },
  ],
},
```

Di `src/main.js`, tambahkan entri `MUAT`:

```js
'#/audit': () => import('./views/audit.js'),
'#/anomali': () => import('./views/anomali.js'),
```

- [ ] **Step 4: Build dan uji manual**

Run:

```bash
npm run build
npm run dev
```

Langkah dengan admin:

1. Buka `#/audit`. Pastikan tabel memuat, filter aksi bekerja, dan tombol halaman tidak aktif di ujung.
2. Buka `#/anomali`. Pastikan rentang 7 hari tampil dan badge jenis berwarna.
3. Login sebagai magang; pastikan menu "Sistem" tidak muncul dan `#/audit` dialihkan ke riwayat.
4. Buka dengan API mati; pastikan pesan galat tampil, bukan layar kosong.

Expected: semua langkah sesuai; tidak ada error konsol.

- [ ] **Step 5: Commit**

```bash
git add src/views/audit.js src/views/anomali.js src/menu.js src/main.js
git commit -m "feat: layar log audit dan anomali untuk admin"
```

---

### Task 9: Monitoring dan retensi otomatis

**Files:**
- Create: `backend/app/Console/Commands/PeriksaKesehatan.php`
- Create: `backend/app/Console/Commands/BersihkanData.php`
- Modify: `backend/routes/console.php`
- Test: `backend/tests/Feature/PeriksaKesehatanTest.php`, `backend/tests/Feature/BersihkanDataTest.php`

**Interfaces:**
- Consumes: `Absen`, `Sesi`, `Audit`, `Foto::hapus`, konfigurasi retensi Task 6.
- Produces: `php artisan absen:periksa {--json}` dengan exit code 0 sehat, 1 peringatan, 2 galat; `php artisan absen:bersihkan {--force} {--hari=}` (dry-run tanpa `--force`); jadwal setiap 5 menit dan bulanan.

- [ ] **Step 1: Tulis tes monitoring yang gagal**

Buat `backend/tests/Feature/PeriksaKesehatanTest.php`:

```php
<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PeriksaKesehatanTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_status_ok_pada_pagi_hari_kerja_tanpa_absen(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-10-19 09:00:00', 'Asia/Jakarta'));

        $this->artisan('absen:periksa', ['--json' => true])
            ->assertExitCode(0)
            ->expectsOutputToContain('"status": "ok"');
    }

    public function test_memberi_peringatan_kalau_belum_ada_absen_setelah_jam_sepuluh(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-10-19 11:00:00', 'Asia/Jakarta'));

        $this->artisan('absen:periksa', ['--json' => true])
            ->assertExitCode(1)
            ->expectsOutputToContain('"status": "warning"');
    }

    public function test_jadwal_terdaftar(): void
    {
        $this->artisan('schedule:list')
            ->assertSuccessful()
            ->expectsOutputToContain('absen:periksa');
    }
}
```

- [ ] **Step 2: Tulis tes retensi yang gagal**

Buat `backend/tests/Feature/BersihkanDataTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BersihkanDataTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $pengguna;

    private Lokasi $lokasi;

    private Shift $shift;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-10-28 02:00:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $this->shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);
        $this->pengguna = Pengguna::create([
            'nama' => 'Siti', 'nip' => 'MGG501', 'pin_hash' => Hash::make('1357'),
            'peran' => 'magang', 'divisi' => 'Pendataan', 'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id, 'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12, 'aktif' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_dry_run_tidak_menghapus_apa_pun(): void
    {
        $absen = $this->absenLama();

        $this->artisan('absen:bersihkan')
            ->expectsOutputToContain('dry run')
            ->assertExitCode(0);

        Storage::disk('local')->assertExists($absen->foto_path);
        $this->assertNotNull($absen->fresh()->foto_path);
    }

    public function test_force_menghapus_foto_lama_dan_menyisakan_baris(): void
    {
        $absen = $this->absenLama();
        $baru = $this->absenLama(now()->subDays(10), 'absen/baru.jpg');
        Storage::disk('local')->put('absen/baru.jpg', 'x');

        $this->artisan('absen:bersihkan', ['--force' => true])->assertExitCode(0);

        Storage::disk('local')->assertMissing($absen->foto_path);
        Storage::disk('local')->assertExists('absen/baru.jpg');
        $this->assertNull($absen->fresh()->foto_path);
        $this->assertSame(2, Absen::count());
        $this->assertNotNull($baru->fresh()->foto_path);
    }

    public function test_force_menghapus_sesi_kedaluwarsa(): void
    {
        Sesi::create([
            'pengguna_id' => $this->pengguna->id,
            'token_hash' => hash('sha256', 'token-lama'),
            'expires_at' => now()->subDay(),
            'last_used_at' => now()->subDays(2),
            'created_at' => now()->subDays(2),
        ]);

        $this->artisan('absen:bersihkan', ['--force' => true])->assertExitCode(0);

        $this->assertSame(0, Sesi::count());
    }

    public function test_force_menghapus_audit_lama_dan_menyisakan_yang_baru(): void
    {
        Audit::create([
            'pengguna_id' => $this->pengguna->id,
            'aksi' => 'uji_lama',
            'rincian' => [],
            'created_at' => now()->subDays(800),
        ]);
        Audit::create([
            'pengguna_id' => $this->pengguna->id,
            'aksi' => 'uji_baru',
            'rincian' => [],
            'created_at' => now()->subDays(10),
        ]);

        $this->artisan('absen:bersihkan', ['--force' => true])->assertExitCode(0);

        $this->assertSame(1, Audit::count());
        $this->assertSame('uji_baru', Audit::firstOrFail()->aksi);
    }

    private function absenLama(?Carbon $waktu = null, string $path = 'absen/lama.jpg'): Absen
    {
        $waktu ??= now()->subDays(200);
        Storage::disk('local')->put($path, 'x');

        return Absen::create([
            'pengguna_id' => $this->pengguna->id,
            'tanggal' => $waktu->toDateString(),
            'tipe' => 'masuk',
            'waktu' => $waktu,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->pengguna->nama,
            'nip_salinan' => $this->pengguna->nip,
            'foto_path' => $path,
            'kiosk_id' => 'kiosk-uji',
            'ip' => '10.0.0.1',
            'created_at' => $waktu,
        ]);
    }
}
```

- [ ] **Step 3: Jalankan tes dan pastikan gagal**

Run:

```bash
cd backend
php artisan test --filter='PeriksaKesehatanTest|BersihkanDataTest'
```

Expected: FAIL karena perintah belum ada.

- [ ] **Step 4: Buat perintah monitoring**

Buat `backend/app/Console/Commands/PeriksaKesehatan.php`:

```php
<?php

namespace App\Console\Commands;

use App\Models\Absen;
use App\Models\Sesi;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PeriksaKesehatan extends Command
{
    protected $signature = 'absen:periksa {--json}';

    protected $description = 'Memeriksa database, penyimpanan, kapasitas disk, dan absen hari ini.';

    public function handle(): int
    {
        $hasil = [];
        $adaGalat = false;
        $adaPeringatan = false;

        try {
            DB::select('select 1');
            $hasil[] = ['nama' => 'database', 'status' => 'ok', 'pesan' => 'Terhubung.'];
        } catch (Throwable $e) {
            $hasil[] = ['nama' => 'database', 'status' => 'error', 'pesan' => 'Tidak bisa terhubung.'];
            $adaGalat = true;
        }

        try {
            Storage::disk('local')->put('.periksa-kesehatan', now()->toIso8601String());
            Storage::disk('local')->delete('.periksa-kesehatan');
            $hasil[] = ['nama' => 'penyimpanan', 'status' => 'ok', 'pesan' => 'Bisa ditulis.'];
        } catch (Throwable $e) {
            $hasil[] = ['nama' => 'penyimpanan', 'status' => 'error', 'pesan' => 'Tidak bisa ditulis.'];
            $adaGalat = true;
        }

        $bebas = @disk_free_space(storage_path());
        $total = @disk_total_space(storage_path());

        if ($bebas !== false && $total !== false && $total > 0) {
            $persenBebas = $bebas / $total * 100;
            $status = $persenBebas < 10 ? 'warning' : 'ok';
            $adaPeringatan = $adaPeringatan || $status === 'warning';
            $hasil[] = [
                'nama' => 'disk',
                'status' => $status,
                'pesan' => round($persenBebas, 1).'% bebas dari '.round($total / 1073741824, 1).' GB.',
            ];
        }

        $jumlahFoto = count(Storage::disk('local')->allFiles('absen'));
        $hasil[] = [
            'nama' => 'foto',
            'status' => 'ok',
            'pesan' => $jumlahFoto.' berkas di folder absen.',
        ];

        $absenHariIni = Absen::whereDate('tanggal', now()->toDateString())->count();
        $jam = now()->format('H:i');

        if (now()->isWeekday() && $jam >= '10:00' && $jam <= '17:00' && $absenHariIni === 0) {
            $hasil[] = [
                'nama' => 'absen_hari_ini',
                'status' => 'warning',
                'pesan' => 'Belum ada absen pada hari kerja setelah pukul 10.00.',
            ];
            $adaPeringatan = true;
        } else {
            $hasil[] = [
                'nama' => 'absen_hari_ini',
                'status' => 'ok',
                'pesan' => $absenHariIni.' absen hari ini.',
            ];
        }

        $hasil[] = [
            'nama' => 'sesi_aktif',
            'status' => 'ok',
            'pesan' => Sesi::where('expires_at', '>', now())->count().' sesi aktif.',
        ];

        $status = $adaGalat ? 'error' : ($adaPeringatan ? 'warning' : 'ok');

        if ($this->option('json')) {
            $this->line(json_encode([
                'status' => $status,
                'waktu' => now()->toIso8601String(),
                'pemeriksaan' => $hasil,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->line('status: '.$status);
            $this->table(['Pemeriksaan', 'Status', 'Pesan'], $hasil);
        }

        return $adaGalat ? 2 : ($adaPeringatan ? 1 : 0);
    }
}
```

- [ ] **Step 5: Buat perintah retensi**

Buat `backend/app/Console/Commands/BersihkanData.php`:

```php
<?php

namespace App\Console\Commands;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Sesi;
use App\Support\Foto;
use Illuminate\Console\Command;

class BersihkanData extends Command
{
    protected $signature = 'absen:bersihkan {--force} {--hari=}';

    protected $description = 'Menghapus foto lama, audit lama, dan sesi kedaluwarsa sesuai kebijakan retensi.';

    public function handle(): int
    {
        $hari = (int) ($this->option('hari') ?: config('absensi.foto_simpan_hari', 180));
        $batas = now()->subDays($hari);

        $foto = Absen::whereNotNull('foto_path')->where('waktu', '<', $batas);
        $jumlahFoto = (clone $foto)->count();
        $jumlahAudit = Audit::where('created_at', '<', now()->subDays(
            (int) config('absensi.audit_simpan_hari', 730)
        ))->count();
        $jumlahSesi = Sesi::where('expires_at', '<', now())->count();

        if (! $this->option('force')) {
            $this->line('dry run: tidak ada yang dihapus.');
            $this->line($jumlahFoto.' foto lebih lama dari '.$hari.' hari.');
            $this->line($jumlahAudit.' audit lebih lama dari batas audit.');
            $this->line($jumlahSesi.' sesi kedaluwarsa.');

            return 0;
        }

        $dihapus = 0;

        // Ambil id lebih dulu: `save()` mengubah `foto_path`, sehingga chunk
        // yang memakai kriteria sama bisa melewati baris.
        $idFoto = (clone $foto)->orderBy('id')->pluck('id');

        foreach ($idFoto->chunk(100) as $potongan) {
            foreach (Absen::whereIn('id', $potongan)->get() as $absen) {
                Foto::hapus($absen->foto_path);
                $absen->foto_path = null;
                $absen->save();
                $dihapus++;
            }
        }

        Audit::where('created_at', '<', now()->subDays(
            (int) config('absensi.audit_simpan_hari', 730)
        ))->delete();

        Sesi::where('expires_at', '<', now())->delete();

        $this->line($dihapus.' foto dihapus; baris absen dipertahankan.');
        $this->line($jumlahAudit.' audit dihapus.');
        $this->line($jumlahSesi.' sesi kedaluwarsa dihapus.');

        return 0;
    }
}
```

- [ ] **Step 6: Daftarkan jadwal**

Ganti isi `backend/routes/console.php`:

```php
<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('absen:periksa')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('absen:bersihkan --force')->monthlyOn(1, '02:00')->withoutOverlapping();
```

- [ ] **Step 7: Jalankan tes sampai lulus**

Run:

```bash
cd backend
php artisan test --filter='PeriksaKesehatanTest|BersihkanDataTest'
php artisan schedule:list
```

Expected: tes lulus; `schedule:list` menampilkan `absen:periksa` dan `absen:bersihkan --force`.

- [ ] **Step 8: Commit**

```bash
git add backend/app/Console/Commands/PeriksaKesehatan.php backend/app/Console/Commands/BersihkanData.php backend/routes/console.php backend/tests/Feature/PeriksaKesehatanTest.php backend/tests/Feature/BersihkanDataTest.php
git commit -m "feat: monitoring kesehatan dan retensi data otomatis"
```

---

### Task 10: Skrip backup, pemulihan, dan runbook

**Files:**
- Create: `backend/deploy/backup.sh`, `backend/deploy/restore.sh`, `docs/OPERASIONAL.md`
- Test: `bash -n` kedua skrip; latihan pemulihan di staging (Task 12)

**Interfaces:**
- Consumes: `mysqldump`, `mysql`, `tar`, `sha256sum`, folder `backend/storage/app/private/absen`, berkas kredensial MySQL 0600.
- Produces: backup harian `db-YYYYmmdd-HHMMSS.sql.gz`, `foto-YYYYmmdd-HHMMSS.tar.gz`, `SHA256SUMS-...`; retensi 14 hari; pemulihan dengan konfirmasi `PULIHKAN`.

- [ ] **Step 1: Buat skrip backup**

Buat `backend/deploy/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/aplikasiabsen/backend}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/absen}"
DB_NAME="${DB_NAME:-absen}"
DB_DEFAULTS_FILE="${DB_DEFAULTS_FILE:-/etc/absen-backup.cnf}"
SIMPAN_HARI="${SIMPAN_HARI:-14}"

if [ ! -r "$DB_DEFAULTS_FILE" ]; then
  echo "Berkas kredensial MySQL tidak bisa dibaca: $DB_DEFAULTS_FILE" >&2
  echo "Buat berkas 0600 berisi [client] host, user, dan password." >&2
  exit 1
fi

if [ ! -d "$APP_DIR/storage/app/private/absen" ]; then
  echo "Folder foto tidak ditemukan: $APP_DIR/storage/app/private/absen" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077
stamp="$(date +%Y%m%d-%H%M%S)"
db_file="$BACKUP_DIR/db-$stamp.sql.gz"
foto_file="$BACKUP_DIR/foto-$stamp.tar.gz"

mysqldump \
  --defaults-extra-file="$DB_DEFAULTS_FILE" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "$DB_NAME" | gzip -c > "$db_file"

tar czf "$foto_file" -C "$APP_DIR/storage/app/private" absen

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$db_file")" "$(basename "$foto_file")" > "SHA256SUMS-$stamp"
)

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-*.sql.gz' -mtime +"$SIMPAN_HARI" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'foto-*.tar.gz' -mtime +"$SIMPAN_HARI" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'SHA256SUMS-*' -mtime +"$SIMPAN_HARI" -delete

echo "Backup selesai: $stamp"
echo "Database: $db_file"
echo "Foto: $foto_file"
echo "Checksum: $BACKUP_DIR/SHA256SUMS-$stamp"
```

- [ ] **Step 2: Buat skrip pemulihan**

Buat `backend/deploy/restore.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Pemakaian: $0 <db.sql.gz> <foto.tar.gz> [--yes]" >&2
  exit 1
fi

DB_FILE="$1"
FOTO_FILE="$2"
shift 2

APP_DIR="${APP_DIR:-/var/www/aplikasiabsen/backend}"
DB_NAME="${DB_NAME:-absen}"
DB_DEFAULTS_FILE="${DB_DEFAULTS_FILE:-/etc/absen-backup.cnf}"
FOTO_DIR="$APP_DIR/storage/app/private"

if [ ! -r "$DB_FILE" ] || [ ! -r "$FOTO_FILE" ]; then
  echo "Berkas backup tidak bisa dibaca." >&2
  exit 1
fi

if [ ! -r "$DB_DEFAULTS_FILE" ]; then
  echo "Berkas kredensial MySQL tidak bisa dibaca: $DB_DEFAULTS_FILE" >&2
  exit 1
fi

if [ "${1:-}" != "--yes" ]; then
  echo "Tindakan ini menimpa database '$DB_NAME' dan folder foto."
  echo "Ketik PULIHKAN untuk melanjutkan:"
  read -r jawab
  if [ "$jawab" != "PULIHKAN" ]; then
    echo "Dibatalkan."
    exit 1
  fi
fi

gunzip -c "$DB_FILE" | mysql --defaults-extra-file="$DB_DEFAULTS_FILE" "$DB_NAME"
tar xzf "$FOTO_FILE" -C "$FOTO_DIR"
php "$APP_DIR/artisan" migrate --force

echo "Pemulihan selesai. Periksa aplikasi sebelum mengakhiri maintenance."
```

- [ ] **Step 3: Periksa sintaks**

Run:

```bash
bash -n backend/deploy/backup.sh
bash -n backend/deploy/restore.sh
chmod +x backend/deploy/backup.sh backend/deploy/restore.sh
```

Expected: tidak ada keluaran galat; kedua berkas dapat dieksekusi.

- [ ] **Step 4: Tulis runbook operasional**

Buat `docs/OPERASIONAL.md`:

````markdown
# Operasional — Aplikasi Absen

Panduan untuk PIC infrastruktur. Tidak memuat PIN, token, atau kata sandi.

## 1. Pemeriksaan harian

- Jalankan `php artisan absen:periksa` manual bila ada kecurigaan.
- Jadwal Laravel menjalankannya setiap 5 menit. Pastikan cron Laravel aktif:

```cron
* * * * * cd /var/www/aplikasiabsen/backend && php artisan schedule:run >> /dev/null 2>&1
```

- Periksa `storage/logs/laravel.log` untuk `ERROR`. Jangan menyalin isi log
  yang memuat data pribadi ke tiket publik.
- Pastikan `absen:periksa` melaporkan `status: ok`. `warning` berarti disk
  hampir penuh atau belum ada absen setelah pukul 10.00 pada hari kerja.

## 2. Kredensial backup

Buat `/etc/absen-backup.cnf` dengan hak akses 0600:

```ini
[client]
host=127.0.0.1
user=absen
password=GANTI_PASSWORD
```

Jangan menaruh berkas ini di repo. Jangan menulis kata sandi di crontab.

## 3. Backup

Jadwal harian pukul 01.00:

```cron
0 1 * * * cd /var/www/aplikasiabsen/backend && APP_DIR=/var/www/aplikasiabsen/backend BACKUP_DIR=/var/backups/absen /var/www/aplikasiabsen/backend/deploy/backup.sh >> /var/log/absen-backup.log 2>&1
```

Backup disimpan 14 hari dan terdiri dari database, foto, serta checksum.
Verifikasi mingguan:

```bash
cd /var/backups/absen
sha256sum -c "$(ls -t SHA256SUMS-* | head -1)"
```

## 4. Latihan pemulihan

Lakukan di staging, bukan produksi:

1. Siapkan database staging kosong dan salinan folder foto staging.
2. Jalankan `restore.sh` dengan `--yes` di staging.
3. Pastikan login admin, dashboard, laporan, dan satu foto lama bisa dibuka.
4. Catat tanggal, berkas backup yang dipakai, dan hasilnya di tiket rilis.

Pemulihan produksi hanya setelah aplikasi masuk maintenance:

```bash
php artisan down
DB=$(ls -t /var/backups/absen/db-*.sql.gz | head -1)
FOTO=$(ls -t /var/backups/absen/foto-*.tar.gz | head -1)
/var/www/aplikasiabsen/backend/deploy/restore.sh "$DB" "$FOTO"
php artisan up
```

Jangan menjalankan pemulihan produksi tanpa persetujuan pemilik aplikasi.

## 5. Rollback aplikasi

1. Simpan `.env` dan backup terbaru.
2. Checkout commit rilis sebelumnya.
3. `composer install --no-dev --optimize-autoloader`.
4. `npm ci && npm run build` dari akar, lalu salin `dist` ke `backend/public`.
5. `php artisan migrate --force` hanya kalau migrasi kompatibel mundur. Kalau
   tidak, pulihkan database dari backup.
6. `php artisan optimize:clear && php artisan optimize`.
7. Uji login, dashboard, kiosk, dan satu absen.

## 6. Insiden

| Insiden | Tindakan pertama |
|---|---|
| PIN diduga bocor | Nonaktifkan akun, reset PIN lewat Data Master, periksa audit dan anomali. |
| Foto bisa diakses publik | Periksa signed URL dan permission storage, putus akses, ganti kredensial bila perlu. |
| Database down | Hentikan kiosk, pulihkan dari backup, catat waktu kejadian. |
| Disk penuh | Jalankan `absen:bersihkan --force`, pindahkan backup lama, tambah kapasitas. |
| Absen ganda | Periksa `kunci_idempoten` dan log; jangan hapus baris tanpa persetujuan. |

Kontak insiden ada di password manager kantor, bukan di repo.
````

- [ ] **Step 5: Commit**

```bash
git add backend/deploy/backup.sh backend/deploy/restore.sh docs/OPERASIONAL.md
git commit -m "feat: skrip backup, pemulihan, dan runbook operasional"
```

---

### Task 11: Aksesibilitas navigasi, tabel, dan kiosk

**Files:**
- Modify: `src/kerangka.js:80-140`, `src/main.js:91-96`, `src/tabel.js:88-112`, `src/views/absen.js:145-173`, `src/views/absen.js:585-663`, `src/views/masuk.js:38`
- Modify: seluruh pemanggil `tabel` (sudah menambahkan `judul` di Task 2)
- Test: `npm test`, `npm run build`, manual keyboard dan pembaca layar

**Interfaces:**
- Consumes: `tabel` dengan `judul` dari Task 2.
- Produces: tautan "Lewati ke isi utama", `<main id="isi-utama" tabindex="-1">`, fokus pindah ke isi setelah rute berubah, dan pengumuman hasil kiosk lewat `aria-live`.

- [ ] **Step 1: Tambahkan tautan lewati dan target isi**

Di `src/kerangka.js`, tepat setelah `<div class="min-h-dvh lg:pl-[17rem]">`, sisipkan:

```html
<a href="#isi-utama"
   class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50
          focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm
          focus:font-medium focus:text-ink focus:shadow-naik">
  Lewati ke isi utama
</a>
```

Ubah elemen main:

```html
<main id="isi-utama" tabindex="-1" class="flex-1 px-4 py-6 outline-none sm:px-6">
```

Di `src/views/masuk.js:38`, lakukan hal yang sama pada `<main>` halaman masuk:

```html
<main id="isi-utama" tabindex="-1" class="flex min-h-dvh flex-col items-center justify-center px-5 py-8 outline-none">
```

- [ ] **Step 2: Pindahkan fokus setelah rute berubah**

Di `src/main.js`, setelah `bersihkan = view.mount(AKAR) ?? null;`, tambahkan:

```js
// Fokus ke isi supaya pembaca layar mengumumkan halaman baru, bukan tetap
// di tombol menu yang barusan ditekan. `preventScroll` menjaga posisi gulir.
AKAR.querySelector('#isi-utama')?.focus({ preventScroll: true });
```

- [ ] **Step 3: Beri target dan pengumuman di kiosk**

Di `src/views/absen.js`, ubah `<main class="flex min-h-dvh flex-col px-5 py-6 sm:px-8">` menjadi:

```html
<main id="isi-utama" tabindex="-1" class="flex min-h-dvh flex-col px-5 py-6 outline-none sm:px-8">
```

Tambahkan setelah `</footer>`:

```html
<div data-live class="sr-only" aria-live="polite" aria-atomic="true"></div>
```

Di `tampilkanHasil`, setelah `panggung.querySelector('[data-ulang]').addEventListener(...)`, tambahkan:

```js
const live = akar.querySelector('[data-live]');
if (live) live.textContent = [judul, nama, pesan].filter(Boolean).join('. ');
```

- [ ] **Step 4: Pastikan semua tabel punya caption**

Run:

```bash
grep -R -n "tabel({" src/views | cat
grep -R -n "judul: 'Daftar\|judul: 'Riwayat\|judul: 'Rekap\|judul: 'Rincian\|judul: 'Log audit\|judul: 'Daftar anomali" src/views | cat
```

Expected: setiap pemanggilan `tabel` diikuti `judul:` pada blok yang sama. Kalau ada yang terlewat, tambahkan.

- [ ] **Step 5: Tambahkan tes caption**

`src/tabel.test.js` dari Task 2 sudah menguji caption. Jalankan:

```bash
npm test
npm run build
```

Expected: lulus.

- [ ] **Step 6: Uji keyboard dan pembaca layar**

Langkah manual:

1. Buka aplikasi, tekan `Tab` pertama. Tautan "Lewati ke isi utama" harus terlihat dan memindahkan fokus ke isi.
2. Pindah menu dengan `Enter`; fokus harus berada di `<main>` dan pembaca layar mengumumkan judul halaman.
3. Di kiosk, selesaikan satu absen; pembaca layar harus mengumumkan "Absen masuk tercatat" tanpa harus menjelajah layar.
4. Semua tabel harus terbaca sebagai tabel dengan nama (caption), bukan sekadar kumpulan sel.
5. Uji dengan `prefers-reduced-motion` aktif; tidak ada animasi yang mengganggu.

Expected: seluruh langkah berhasil. Kalau pembaca layar tidak tersedia, catat di tiket rilis bahwa uji itu belum dilakukan dan jangan menandai M6 selesai.

- [ ] **Step 7: Commit**

```bash
git add src/kerangka.js src/main.js src/views/absen.js src/views/masuk.js src/tabel.js src/views/hari-libur.js src/views/izin-masuk.js src/views/lokasi.js src/views/magang.js src/views/riwayat.js src/views/shift.js src/views/laporan.js
git commit -m "fix: navigasi keyboard dan caption tabel untuk aksesibilitas"
```

---

### Task 12: Uji beban 50 magang dan latihan pemulihan staging

**Files:**
- Create: `backend/database/seeders/UjiBebanSeeder.php`
- Create: `scripts/uji-beban.mjs`
- Modify: `package.json` (skrip `uji:beban`)
- Modify: `backend/config/absensi.php`, `backend/.env.example`
- Test: `php artisan db:seed --class=UjiBebanSeeder` di staging; `node scripts/uji-beban.mjs`; latihan `restore.sh` di staging

**Interfaces:**
- Consumes: endpoint `POST /api/masuk`, `GET /api/admin/laporan`, `GET /api/admin/laporan/harian` dari M5; database staging.
- Produces: data 50 magang + absen satu bulan; laporan p95 ≤ 2000 ms; catatan latihan pemulihan.

- [ ] **Step 1: Tambahkan konfigurasi dan buat seeder uji beban**

Di `backend/config/absensi.php`, sebelum `'seed'`:

```php
'uji_beban_pin' => env('ABSEN_UJI_BEBAN_PIN'),
```

Di `backend/.env.example`, di bagian akhir:

```dotenv
# Hanya untuk staging; jangan diisi di produksi.
ABSEN_UJI_BEBAN_PIN=
```

Buat `backend/database/seeders/UjiBebanSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class UjiBebanSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'staging'])) {
            throw new RuntimeException('Seeder uji beban hanya untuk local/staging.');
        }

        $pin = (string) config('absensi.uji_beban_pin');

        if (strlen($pin) < 4 || strlen($pin) > 6 || ! ctype_digit($pin)) {
            throw new RuntimeException('Isi ABSEN_UJI_BEBAN_PIN dengan 4–6 angka di .env staging.');
        }

        $lokasi = Lokasi::firstOrCreate(
            ['nama' => 'Kantor Uji Beban'],
            [
                'alamat' => 'Jl. Uji Beban No. 1',
                'lintang' => -6.2246,
                'bujur' => 106.8094,
                'radius_m' => 50,
                'aktif' => true,
            ]
        );

        $shift = Shift::firstOrCreate(
            ['nama' => 'Reguler Uji Beban'],
            ['masuk' => '08:00', 'pulang' => '17:00', 'toleransi_menit' => 15, 'aktif' => true]
        );

        $awal = now()->startOfMonth();
        $akhir = now();

        for ($i = 1; $i <= 50; $i++) {
            $nip = sprintf('UJI%03d', $i);

            $pengguna = Pengguna::updateOrCreate(
                ['nip' => $nip],
                [
                    'nama' => 'Magang Uji '.$i,
                    'pin_hash' => Hash::make($pin),
                    'peran' => 'magang',
                    'divisi' => 'Pendataan',
                    'shift_id' => $shift->id,
                    'lokasi_id' => $lokasi->id,
                    'masuk_kerja' => $awal->toDateString(),
                    'cuti_kuota' => 12,
                    'aktif' => true,
                ]
            );

            for ($hari = $awal->copy(); $hari->lessThanOrEqualTo($akhir); $hari->addDay()) {
                if ($hari->isWeekend()) {
                    continue;
                }

                $tanggal = $hari->toDateString();

                foreach (['masuk', 'pulang'] as $tipe) {
                    $waktu = $hari->copy()->setTime(
                        $tipe === 'masuk' ? 7 : 17,
                        $tipe === 'masuk' ? 45 + ($i % 20) : 5 + ($i % 20),
                        0
                    );

                    Absen::firstOrCreate(
                        [
                            'pengguna_id' => $pengguna->id,
                            'tanggal' => $tanggal,
                            'tipe' => $tipe,
                        ],
                        [
                            'waktu' => $waktu,
                            'lokasi_id' => $lokasi->id,
                            'mode' => 'kantor',
                            'shift_id' => $shift->id,
                            'telat_menit' => $tipe === 'masuk' ? max(0, ($i % 20) - 15) : 0,
                            'nama_salinan' => $pengguna->nama,
                            'nip_salinan' => $pengguna->nip,
                            'foto_path' => null,
                            'kiosk_id' => 'kiosk-uji-beban',
                            'ip' => '10.10.0.1',
                            'created_at' => $waktu,
                        ]
                    );
                }
            }
        }

        $this->command?->info('50 magang uji beban siap. PIN tidak ditampilkan.');
    }
}
```

- [ ] **Step 2: Buat skrip pengukur**

Buat `scripts/uji-beban.mjs`:

```js
// Mengukur waktu balasan laporan admin pada data 50 magang. Token tidak pernah
// dicetak. Jalankan di staging, bukan produksi.
const PANGKAL = process.env.ABSEN_BASE_URL ?? 'http://127.0.0.1:8000';
const NIP = process.env.ABSEN_NIP;
const PIN = process.env.ABSEN_PIN;
const BULAN = process.env.ABSEN_BULAN;

if (!NIP || !PIN || !BULAN) {
  console.error('Isi ABSEN_NIP, ABSEN_PIN, dan ABSEN_BULAN (YYYY-MM).');
  process.exit(2);
}

async function minta(jalur, opsi = {}) {
  const pengawas = new AbortController();
  const timer = setTimeout(() => pengawas.abort(), 30_000);

  try {
    const res = await fetch(PANGKAL + jalur, { ...opsi, signal: pengawas.signal });
    const isi = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`Permintaan ${jalur} gagal (${res.status}): ${isi?.message ?? ''}`);
    }

    return isi;
  } finally {
    clearTimeout(timer);
  }
}

const masuk = await minta('/api/masuk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ nip: NIP, pin: PIN }),
});

const token = masuk.token;
if (!token) {
  console.error('Login tidak mengembalikan token.');
  process.exit(2);
}

const kepala = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
const waktuRekap = [];

for (let i = 0; i < 20; i++) {
  const mulai = performance.now();
  await minta(`/api/admin/laporan?bulan=${encodeURIComponent(BULAN)}`, { headers: kepala });
  waktuRekap.push(performance.now() - mulai);
}

const rekap = await minta(`/api/admin/laporan?bulan=${encodeURIComponent(BULAN)}`, { headers: kepala });
const contoh = rekap.data?.[0];

if (!contoh?.pengguna_id) {
  console.error('Laporan kosong; jalankan UjiBebanSeeder lebih dulu.');
  process.exit(2);
}

const waktuHarian = [];

for (let i = 0; i < 10; i++) {
  const mulai = performance.now();
  await minta(
    `/api/admin/laporan/harian?bulan=${encodeURIComponent(BULAN)}&pengguna_id=${contoh.pengguna_id}`,
    { headers: kepala },
  );
  waktuHarian.push(performance.now() - mulai);
}

function ringkas(nama, daftar) {
  const urut = [...daftar].sort((a, b) => a - b);
  const p95 = urut[Math.floor(urut.length * 0.95) - 1] ?? urut.at(-1);
  return {
    nama,
    jumlah: urut.length,
    p50_ms: Math.round(urut[Math.floor(urut.length * 0.5)]),
    p95_ms: Math.round(p95),
    maks_ms: Math.round(urut.at(-1)),
  };
}

const hasil = [ringkas('laporan', waktuRekap), ringkas('laporan_harian', waktuHarian)];
console.log(JSON.stringify(hasil, null, 2));

if (hasil.some((h) => h.p95_ms > 2000)) {
  console.error('GAGAL: p95 melebihi 2000 ms.');
  process.exit(1);
}
```

- [ ] **Step 3: Tambahkan skrip npm**

Di `package.json`:

```json
"uji:beban": "node scripts/uji-beban.mjs"
```

- [ ] **Step 4: Periksa sintaks**

Run:

```bash
node --check scripts/uji-beban.mjs
php -l backend/database/seeders/UjiBebanSeeder.php
```

Expected: tidak ada galat sintaks.

- [ ] **Step 5: Jalankan di staging**

Di staging dengan database terpisah dari produksi:

```bash
cd backend
php artisan config:clear
ABSEN_UJI_BEBAN_PIN=246810 php artisan db:seed --class=UjiBebanSeeder --force
cd ..

export ABSEN_BASE_URL=https://staging.example.com
export ABSEN_NIP=ADM001
read -rsp "PIN admin staging: " ABSEN_PIN && export ABSEN_PIN
export ABSEN_BULAN=2026-10
npm run uji:beban
unset ABSEN_PIN
```

Catatan: `php artisan config:clear` perlu dijalankan lebih dulu kalau config
staging sedang di-cache; tanpa itu `ABSEN_UJI_BEBAN_PIN` dari environment tidak
terbaca. Jangan menulis PIN staging di dokumentasi, tiket, atau log. Isi lewat
prompt `read -s` atau environment saat menjalankan perintah.

Expected: laporan p95 ≤ 2000 ms; catat angka p50/p95/maks di tiket rilis.

- [ ] **Step 6: Latihan pemulihan staging**

1. Jalankan `backup.sh` di staging dengan `BACKUP_DIR=/tmp/absen-backup`.
2. Siapkan database staging kosong dan folder foto staging kosong.
3. Jalankan `restore.sh <db> <foto> --yes` dengan `APP_DIR` menunjuk salinan staging.
4. Login admin, buka dashboard, laporan, dan satu foto lama. Pastikan semuanya ada.
5. Catat hasil di tiket rilis. Jangan menjalankan langkah ini di produksi.

Expected: data dan foto pulih; tidak ada kehilangan baris.

- [ ] **Step 7: Commit**

```bash
git add backend/database/seeders/UjiBebanSeeder.php scripts/uji-beban.mjs package.json package-lock.json backend/config/absensi.php backend/.env.example
git commit -m "test: seeder dan pengukur beban 50 magang"
```

---

### Task 13: Daftar periksa rilis, regresi akhir, dan status M6

**Files:**
- Create: `docs/RILIS.md`
- Modify: `docs/milestones/M6-hardening-rilis.md`
- Modify: `docs/README.md`
- Modify: `backend/README.md`
- Test: seluruh suite frontend/backend, build, pemeriksaan rahasia, header staging

**Interfaces:**
- Consumes: seluruh task M5 dan M6.
- Produces: daftar rilis yang ditandatangani; status milestone yang hanya berubah menjadi **Selesai** setelah semua bukti ada.

- [ ] **Step 1: Tulis daftar periksa rilis**

Buat `docs/RILIS.md`:

```markdown
# Daftar Periksa Rilis — Aplikasi Absen

Rilis tidak boleh dilakukan sebelum seluruh butir wajib tercentang. Setiap
butir harus menyebut bukti: perintah, berkas, atau tangkapan layar di tiket.

## 1. Pra-rilis

- [ ] `npm test` lulus.
- [ ] `npm run build` lulus dan `scripts/periksa-build.mjs` tidak menemukan
      akun demo/mode tiruan.
- [ ] `cd backend && php artisan test` lulus seluruhnya (M5 + M6).
- [ ] `cd backend && composer audit` dan `npm audit --audit-level=high` tidak
      menemukan kerentanan tinggi/kritis. Temuan lain dicatat dan diterima
      pemilik.
- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_FORCE_HTTPS=true`.
- [ ] `ADMIN_PIN` produksi diisi lewat environment, bukan repo; seeder hanya
      dijalankan sekali.
- [ ] `ABSEN_IP_KANTOR` kosong atau berisi IP kantor yang benar.
- [ ] `ABSEN_FOTO_SIMPAN_HARI=180`, `ABSEN_AUDIT_SIMPAN_HARI=730`.
- [ ] NTP aktif dan `date` menunjukkan `Asia/Jakarta`.
- [ ] Cron `schedule:run` aktif; `php artisan schedule:list` menampilkan
      `absen:periksa` dan `absen:bersihkan`.
- [ ] Backup harian terjadwal dan satu backup manual baru saja dibuat.
- [ ] Latihan pemulihan staging berhasil (tanggal: ______).
- [ ] Uji beban 50 magang: laporan p95 ______ ms (target ≤ 2000).
- [ ] Uji kiosk nyata: kamera, GPS, keyboard, layar sentuh, jaringan putus,
      dan kirim ulang.
- [ ] Uji seluruh rute frontend dengan `VITE_USE_MOCK=false` untuk admin dan
      magang.
- [ ] Aksesibilitas: tautan lewati, fokus setelah rute, caption tabel, dan
      pengumuman kiosk diuji.

## 2. Rilis

- [ ] Salin `dist` ke `backend/public` dari akar proyek.
- [ ] `composer install --no-dev --optimize-autoloader` di backend.
- [ ] `php artisan migrate --force` (bukan `migrate:fresh`, bukan seeder rutin).
- [ ] `php artisan optimize`.
- [ ] Reload PHP-FPM.
- [ ] Verifikasi `https://<domain>/up` dan `https://<domain>/api/kiosk/lokasi`.
- [ ] Verifikasi header CSP, `X-Frame-Options`, `Referrer-Policy`,
      `Permissions-Policy`, dan HSTS.
- [ ] Login admin, buka dashboard, kiosk, laporan, audit, dan anomali.

## 3. Pasca-rilis

- [ ] Satu absen uji tercatat dan fotonya bisa dibuka lewat signed URL.
- [ ] `absen:periksa` melaporkan `status: ok`.
- [ ] Log tidak memuat PIN, token, atau `pin_hash`.
- [ ] Backup malam pertama berhasil.
- [ ] Pengguna menerima pengumuman: cara absen, menghubungi admin saat PIN
      bermasalah, dan cara mengajukan izin.

## 4. Rollback

- [ ] Commit rilis sebelumnya diketahui.
- [ ] Backup sebelum rilis tersedia.
- [ ] Langkah rollback di `docs/OPERASIONAL.md` sudah dibaca PIC.
- [ ] Rencana komunikasi ke pengguna disiapkan.

## 5. Persetujuan

| Peran | Nama | Tanggal | Tanda tangan |
|---|---|---|---|
| Pemilik aplikasi |  |  |  |
| PIC infrastruktur |  |  |  |
| Perwakilan pengguna |  |  |  |

Rilis hanya boleh dilanjutkan setelah ketiga tanda tangan ada.
```

- [ ] **Step 2: Jalankan regresi lengkap**

Run:

```bash
npm test
npm run build
cd backend && php artisan test && composer audit
cd ..
npm audit --audit-level=high
```

Expected: semua lulus. Kalau audit menemukan kerentanan tinggi/kritis, perbarui
dependensi atau catat risiko yang diterima pemilik di tiket rilis; jangan
mengabaikan tanpa catatan.

- [ ] **Step 3: Periksa tidak ada rahasia di build dan repo**

Run:

```bash
grep -R -n -E "ADM001|1111|tiruan\.|absen-tiruan" dist || true
git grep -n -E "ADMIN_PIN=[^[:space:]]|pin_hash" -- ':!backend/tests' ':!docs' || true
```

Expected: tidak ada akun demo/mode tiruan di `dist`; tidak ada PIN produksi di
repo. Kecocokan `pin_hash` di kode model/controller wajar; yang dilarang adalah
nilai PIN mentah.

- [ ] **Step 4: Verifikasi header di staging**

Run:

```bash
curl -sSI https://staging.example.com/ | grep -iE "content-security-policy|x-frame-options|referrer-policy|permissions-policy|strict-transport-security"
```

Expected: kelima header muncul. Catat hasilnya di tiket rilis.

- [ ] **Step 5: Perbarui status milestone hanya jika bukti lengkap**

Di `docs/milestones/M6-hardening-rilis.md`:

- Ubah `Status | **Belum**` menjadi `Status | **Selesai**` **hanya jika**
  seluruh butir `docs/RILIS.md` wajib sudah tercentang dan ditandatangani.
- Centang butir yang benar-benar sudah dijalankan. Jangan mencentang butir yang
  hanya direncanakan.
- Tambahkan di bagian "Berikutnya":

```markdown
Seluruh pekerjaan M6 selesai pada 28 Oktober 2026. Bukti: `docs/RILIS.md`,
laporan CI, hasil uji beban, dan tiket latihan pemulihan staging.
```

Di `docs/README.md`, ubah baris M6 menjadi:

```markdown
| M6 — Hardening, QA & rilis | **Selesai** | Kebijakan, CI, monitoring, backup, audit/anomali, dan uji rilis lengkap. |
```

Di `backend/README.md`, ubah judul dan ringkasan:

```markdown
# Aplikasi Absen — Backend
```

dan ganti paragraf pembuka:

```markdown
Backend Laravel untuk Aplikasi Absen. Seluruh endpoint pada `KONTRAK-API.md`
sudah tersedia, termasuk riwayat, izin/cuti, shift, hari libur, audit, dan
anomali. Petunjuk produksi ada di `docs/OPERASIONAL.md` dan `docs/RILIS.md`.
```

- [ ] **Step 6: Pastikan dokumentasi tidak memuat placeholder**

Run:

```bash
grep -R -n -E "TBD|TODO|FIXME|isi nanti" docs backend/README.md PANDUAN-PERBAIKAN.md || true
```

Expected: tidak ada. Baris tanda tangan kosong di `docs/RILIS.md` dan
`docs/KEBIJAKAN-PRODUKSI.md` bukan placeholder; itu formulir persetujuan.

- [ ] **Step 7: Commit akhir**

```bash
git add docs/RILIS.md docs/milestones/M6-hardening-rilis.md docs/README.md backend/README.md
git commit -m "docs: daftar rilis dan status M6"
```

---

## Self-Review

**Spec coverage:**

| Butir M6 | Task |
|---|---|
| Keputusan kiosk/IP dan retensi | 1 |
| Audit ulang `PANDUAN-PERBAIKAN.md` | 1 |
| Audit viewer | 7, 8 |
| Allowlist IP sebagai penanda | 1, 6 |
| Monitoring | 9, 10 |
| Backup dan pemulihan | 10, 12 |
| NTP dan zona waktu | 13 |
| Anomali | 6, 8 |
| Runbook, rollback, kontak | 1, 10 |
| Tes backend penuh | 3, 13 |
| Uji manual rute/peran | 13 |
| E2E staging | 13 |
| Uji kiosk nyata | 13 |
| Kasus gagal | 5, 13 |
| Uji beban 50 magang | 12 |
| CI | 3 |
| HTTPS/header | 13 |
| Build tanpa mock | 2, 13 |
| Seeder tidak dipakai rutin | 3, 13 |
| Tanda tangan rilis | 13 |

**Placeholder scan:** Tidak ada `TBD`, `TODO`, atau langkah "implementasikan
nanti". Baris tanda tangan pada dokumen persetujuan adalah formulir yang memang
harus diisi manusia, bukan placeholder teknis.

**Type/signature consistency:** `kunci_idempoten` konsisten antara kontrak,
migrasi, validasi, controller, dan frontend. `idempoten` selalu boolean.
`Anomali::kumpulkan` mengembalikan array dengan kunci yang sama untuk semua
jenis. `tabel({judul, kolom, baris, kosong})` dipakai di seluruh pemanggil.
`absen:bersihkan` memakai opsi `--force` dan `--hari` yang sama di tes, jadwal,
dan dokumentasi.

**Dependency check:** Task 2 harus selesai sebelum CI Task 3. Task 4 harus
selesai sebelum Task 5. Task 6 harus selesai sebelum Task 8. Task 9 memakai
konfigurasi Task 6. Task 12 dan 13 memerlukan M5 selesai dan staging tersedia.

**Batas yang disengaja:** Tidak ada endpoint menghapus audit, tidak ada ekspor
PDF, tidak ada penggantian PIN mandiri, dan tidak ada pemblokiran absen
berdasarkan IP. Semua itu sudah diputuskan di Task 1 dan tidak boleh
ditambahkan diam-diam saat implementasi.

---

## Execution Handoff

Rencana ini selesai setelah Task 13 dan seluruh bukti di `docs/RILIS.md` ada.
Jangan menandai M6 selesai hanya karena kode sudah ditulis.
