# Dokumentasi Aplikasi Absen

Dokumentasi kerja aplikasi absen magang. Satu berkas per milestone berisi
tujuan, pekerjaan yang sudah selesai, status, langkah berikutnya, dan kriteria
penerimaan. Dokumen ini **tidak menggantikan** `KONTRAK-API.md`; bentuk
request/response tetap mengikuti kontrak tersebut.

Status per **29 Oktober 2026**.

## Daftar dokumen

| Dokumen | Isi |
|---|---|
| [PRD](PRD.md) | Latar belakang, pengguna, kebutuhan fungsional, aturan bisnis, NFR, arsitektur, status implementasi, risiko, dan metrik. |
| [M1 — Fondasi frontend & autentikasi](milestones/M1-fondasi-frontend.md) | Router, hak akses, sesi, lapisan API, kerangka UI, dan pengamanan build. |
| [M2 — Kiosk absen](milestones/M2-kiosk-absen.md) | Absen publik dengan NIP + PIN, lokasi, GPS, selfie, dan reset otomatis. |
| [M3 — Dashboard & data master](milestones/M3-dashboard-data-master.md) | Beranda admin, anak magang, lokasi, shift, dan hari libur. |
| [M4 — Izin, riwayat, rekap & laporan](milestones/M4-izin-riwayat-laporan.md) | Pengajuan izin, persetujuan admin, riwayat magang, rekap bulanan, dan ekspor CSV. |
| [M5 — Integrasi backend](milestones/M5-integrasi-backend.md) | Kecocokan frontend dengan backend, endpoint yang sudah ada, dan sisa Fase 2. |
| [M6 — Hardening, QA & rilis](milestones/M6-hardening-rilis.md) | Keamanan produksi, pengujian menyeluruh, operasional, dan kesiapan rilis. |
| [Daftar periksa rilis](RILIS.md) | Butir pra-rilis, rilis, pasca-rilis, rollback, dan tanda tangan persetujuan. |
| [Template milestone](template-milestone.md) | Kerangka untuk menulis milestone atau tugas baru. |

## Status ringkas

| Milestone | Status | Catatan |
|---|---|---|
| M1 — Fondasi frontend & autentikasi | **Selesai** | Seluruh layar memakai satu router, satu daftar menu, dan satu lapisan API. |
| M2 — Kiosk absen | **Selesai** | Frontend dan endpoint kiosk sudah tersedia. |
| M3 — Dashboard & data master | **Selesai** | Backend shift dan hari libur sudah tersedia. |
| M4 — Izin, riwayat, rekap & laporan | **Selesai (frontend)** | Seluruh endpoint backend sudah tersedia; verifikasi staging ada di M5. |
| M5 — Integrasi backend | **Selesai** | Seluruh endpoint, tes backend, dan uji staging dengan `VITE_USE_MOCK=false` lulus. |
| M6 — Hardening, QA & rilis | **Berjalan** | Kebijakan, CI, monitoring, backup, audit/anomali, aksesibilitas, dan uji beban lokal selesai. Uji perangkat kiosk, latihan pemulihan, header staging, dan tanda tangan rilis belum. |

**Kesimpulan:** frontend sudah memuat seluruh layar dan alur sesuai
`KONTRAK-API.md`, dan M5 sudah lulus uji staging. Aplikasi **belum siap
produksi** karena butir rilis M6 yang tersisa — uji perangkat kiosk, latihan
pemulihan, header staging, dan tanda tangan — belum selesai.

## Arti status

| Status | Arti |
|---|---|
| **Belum** | Belum dikerjakan. |
| **Berjalan** | Sebagian sudah dikerjakan, belum memenuhi seluruh kriteria penerimaan. |
| **Selesai** | Seluruh kriteria penerimaan terpenuhi dan sudah diverifikasi. |
| **Selesai (frontend)** | Tampilan dan alurnya selesai serta sudah dicoba terhadap mock/kontrak. Endpoint backend yang dipakai bisa belum tersedia. |

Status `Selesai (frontend)` sengaja dipakai supaya kemajuan tampilan tidak
disamakan dengan kesiapan backend. Jangan menandai sebuah milestone `Selesai`
hanya karena layarnya berjalan di mode tiruan.

## Cara memperbarui dokumentasi

1. Salin [template milestone](template-milestone.md) menjadi
   `milestones/M<n>-<nama-singkat>.md`.
2. Isi tujuan, pekerjaan, bukti verifikasi, langkah berikutnya, dan kriteria
   penerimaan. Tandai kotak hanya kalau sudah benar-benar diperiksa.
3. Perbarui tabel **Status ringkas** di berkas ini.
4. Catat tanggal pembaruan dan bukti yang dipakai (perintah, rute, atau berkas).
5. Kalau perilaku berubah, perbarui `KONTRAK-API.md` **lebih dulu**, baru kode
   dan dokumentasi. Kontrak yang menang atas dokumen ini.
6. Jangan menulis PIN, token, NIP asli, atau data pribadi ke dokumentasi.

Satu milestone boleh memiliki beberapa tugas. Rinciannya ditulis sebagai daftar
centang di dalam berkas milestone, bukan sebagai berkas terpisah, sampai tugas
itu cukup besar untuk punya tujuan dan kriteria sendiri.

## Sumber kebenaran

Urutan acuan saat ada ketidakcocokan:

1. `KONTRAK-API.md` — bentuk request/response dan aturan yang mengikat.
2. `PANDUAN-BACKEND-V2.md` — rencana dan definisi selesai Fase 2.
3. Kode yang berjalan — keadaan yang sebenarnya saat ini.
4. Dokumen di folder ini — ringkasan dan riwayat pekerjaan.

Kalau kode berbeda dari dokumen, jangan diam-diam mengubah salah satunya.
Catat perbedaannya di milestone terkait, lalu putuskan apakah kode atau
kontrak yang perlu diperbaiki.

## Menjalankan cepat

Frontend:

```bash
npm install
npm run dev
```

Mode tiruan aktif otomatis di development. Untuk memakai backend asli:

```dotenv
VITE_USE_MOCK=false
```

Build produksi selalu memakai backend asli, walaupun `VITE_USE_MOCK` masih
bernilai `true`. `npm run build` juga menjalankan pemeriksaan yang menolak akun
demo atau kunci mock di dalam `dist`.

Backend ada di `backend/`; langkah instalasi dan seed ada di
`backend/README.md`.

## Riwayat pembaruan

| Tanggal | Perubahan |
|---|---|
| 28 Oktober 2026 | Dokumentasi awal: PRD, M1–M6, dan template milestone. |
| 28 Oktober 2026 | Endpoint Fase 2 selesai dan diregresi (138 tes, 991 assertion); status M3/M5 diperbarui. |
| 28 Oktober 2026 | Uji staging M5 dengan `VITE_USE_MOCK=false` lulus; status M5 menjadi **Selesai**. |
