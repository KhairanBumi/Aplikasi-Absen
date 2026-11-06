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
- Lokasi perangkat diambil bila tersedia. Kalau layanan lokasi perangkat mati,
  absen luar tetap dapat dikirim tanpa koordinat dan ditandai
  (`lokasi_tersedia: false`, `lokasi_meragukan: true`) untuk diperiksa admin.
  Akurasi kasar juga ditandai, bukan ditolak. Radius area kantor bawaan 250 m;
  jarak tidak pernah menolak dinas luar.
- Perangkat kiosk baru didaftarkan PIC infrastruktur saat pemasangan lewat
  prosedur deploy. Belum ada layar admin untuk mendaftarkan perangkat pada
  rilis ini. Identitas perangkat diisi lewat `VITE_KIOSK_ID` saat build kiosk
  itu, atau `localStorage` bila build dipakai bersama; **bukan** lewat URL yang
  bisa dibagikan.

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
