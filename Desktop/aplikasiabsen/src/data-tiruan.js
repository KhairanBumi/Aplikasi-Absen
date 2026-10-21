// Data tiruan yang dipakai saat MODE_TIRUAN aktif.
//
// Isinya SENGAJA kosong, kecuali satu akun admin. Aplikasi ini dipakai untuk
// anak magang, dan anak magang belum punya riwayat absen apa pun — jadi daftar
// yang kosong di awal bukan kekurangan, melainkan keadaan yang benar. Admin
// mengisi sendiri daftar anak magangnya lewat layar Data Master.
//
// Berkas ini dulu membangkitkan 50 orang, ~5.700 baris absen, dan 127
// pengajuan izin. Semuanya dihapus. Angka karangan memenuhi layar dengan
// riwayat orang yang tidak ada, dan yang diuji jadi data karangannya, bukan
// aplikasinya.
//
// Lokasi, shift, dan hari libur TETAP ada. Ketiganya bukan data orang, dan
// formulir tambah anak magang membutuhkannya: tanpa satu pun shift, tidak ada
// yang bisa dipilih saat menambah orang pertama.

// ── Waktu ───────────────────────────────────────────────────────────────────
// Semua waktu dibangun dari komponen tanggal plus offset "+07:00" yang ditulis
// eksplisit. Ini menutup satu kelas bug: kalau kita bersandar pada zona waktu
// perangkat, laptop yang salah setel akan menggeser seluruh riwayat absen.
// (Komputer di proyek ini memang masih disetel Europe/Berlin.)

const dua = (n) => String(n).padStart(2, '0');

/** Komponen tanggal & jam menurut Asia/Jakarta, apa pun zona waktu perangkat. */
function bagianJakarta(waktu = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const o = {};
  for (const p of f.formatToParts(waktu)) o[p.type] = p.value;
  return {
    tahun: +o.year,
    bulan: +o.month,
    tanggal: +o.day,
    jam: +o.hour % 24,
    menit: +o.minute,
    detik: +o.second,
  };
}

const tanggalISO = (b) => `${b.tahun}-${dua(b.bulan)}-${dua(b.tanggal)}`;

const waktuISO = (b, jam, menit, detik = 0) =>
  `${tanggalISO(b)}T${dua(jam)}:${dua(menit)}:${dua(detik)}+07:00`;

/**
 * Waktu sekarang dalam bentuk ISO lengkap, offset +07:00 disertakan.
 *
 * Ada supaya tidak ada yang memanggil `waktuISO(b)` tanpa jam dan menit.
 * Panggilan begitu menghasilkan "2026-10-19Tundefined:undefined:00+07:00" —
 * string yang tetap berawalan tanggal yang benar, jadi urutannya kelihatan
 * baik-baik saja dan yang rusak cuma tanggal yang ditampilkan.
 */
function sekarangISO() {
  const b = bagianJakarta();
  return waktuISO(b, b.jam, b.menit, b.detik);
}

/** Geser komponen tanggal sejumlah hari. Murni UTC, jadi tidak ada pergeseran zona. */
function geserHari(b, n) {
  const d = new Date(Date.UTC(b.tahun, b.bulan - 1, b.tanggal));
  d.setUTCDate(d.getUTCDate() + n);
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, tanggal: d.getUTCDate() };
}

/** "08:00" -> 480 menit sejak tengah malam. */
function bacaJam(teks) {
  const [j, m] = String(teks).split(':').map(Number);
  return j * 60 + m;
}

// ── Data acuan ──────────────────────────────────────────────────────────────

/**
 * Tiga divisi tempat anak magang ditempatkan.
 *
 * Ditulis di sini, bukan dikarang di dalam layar, karena tiga hal berbeda
 * membacanya: formulir tambah, pemeriksaan di mock saat menyimpan, dan
 * dokumen kontrak. Daftar yang disalin ke tiga tempat cepat atau lambat akan
 * berbeda isinya.
 *
 * Daftar ini ikut dikirim `GET /admin/magang` supaya formulir membangun
 * pilihannya dari server. Menambah divisi keempat nanti cukup mengubah satu
 * baris di sini dan satu baris di backend.
 */
export const DIVISI = ['Pendataan', 'Perhitungan', 'Management Data'];

// `aktif` ada di sini bukan untuk kelengkapan. Lokasi dan shift dirujuk oleh
// baris absen yang sudah terjadi; menghapus "Gudang Cikarang" berarti absen
// orang-orang yang bekerja di sana kehilangan tempatnya. Menutup lokasi
// artinya menonaktifkannya, bukan menghapusnya.
export const lokasi = [
  {
    id: 1,
    nama: 'Kantor Pusat',
    alamat: 'Jl. Jenderal Sudirman No. 1, Jakarta',
    aktif: true,
    // Titik kantor dipakai SERVER untuk menghitung jarak absen dan menjadi
    // pembanding saat magang absen "dinas luar". Jangan pernah menghitung jarak
    // di browser: angka dari klien bisa diubah sebelum dikirim.
    //
    // Koordinat di bawah HANYA CONTOH, bukan hasil pencarian di Google Maps.
    // Admin wajib menggantinya lewat Data Master → Lokasi Kantor dengan titik
    // kantor yang sebenarnya. `radius_m` adalah pembanding area kantor; absen
    // dinas luar tetap diterima di luar radius.
    lintang: -6.2246,
    bujur: 106.8094,
    radius_m: 50,
  },
  {
    id: 2,
    nama: 'Gudang Cikarang',
    alamat: 'Jl. Industri Raya No. 8, Cikarang',
    aktif: true,
    lintang: -6.2843,
    bujur: 107.166,
    radius_m: 50,
  },
];

// Satu shift saja: 08.00 sampai 17.00, Senin sampai Jumat.
//
// Dulu ada tiga — Reguler, Pagi, Siang — karena data karangan butuh variasi jam
// supaya laporannya terlihat hidup. Kantornya tidak begitu: semua orang masuk
// dan pulang di jam yang sama, jadi dua shift tambahan itu bukan cuma mubazir,
// tapi menyesatkan — rekapnya jadi terlihat seperti ada tiga kelompok orang.
//
// `toleransi_menit` inilah yang membedakan "tepat waktu" dan "telat". Tanpa
// angka ini, orang yang masuk 07:59:59 dianggap sama dengan yang masuk 08:45.
export const shift = [
  { id: 1, nama: 'Reguler', masuk: '08:00', pulang: '17:00', toleransi_menit: 15, aktif: true },
];

// Hanya hari libur yang tanggalnya pasti. Daftar lengkap hari raya keagamaan
// berubah tiap tahun dan itu urusan admin lewat layar Hari Libur — menebaknya
// di sini hanya akan menghasilkan tanggal yang salah.
//
// Sabtu dan Minggu tidak ada di sini, dan memang tidak boleh ada. Keduanya libur
// dengan sendirinya karena dihitung dari hari dalam seminggu (`keteranganLibur`
// di mock.js) — menuliskannya sebagai baris di bawah tidak menambah apa pun.
export const hariLibur = [
  { id: 1, tanggal: '2026-01-01', keterangan: 'Tahun Baru Masehi' },
  { id: 2, tanggal: '2026-05-01', keterangan: 'Hari Buruh Internasional' },
  { id: 3, tanggal: '2026-08-17', keterangan: 'Hari Kemerdekaan RI' },
  { id: 4, tanggal: '2026-12-25', keterangan: 'Hari Raya Natal' },
];

// ── Satu-satunya akun bawaan ────────────────────────────────────────────────

// Admin harus ada sebelum apa pun bisa diisi: tanpa satu pun akun yang bisa
// masuk, tidak ada cara menambah anak magang pertama. Karena itu akun inilah
// yang dipertahankan, dan hanya ini.
//
// PIN disimpan sebagai hash, sama seperti yang wajib dilakukan backend asli.
// Nilai di bawah adalah SHA-256 dari PIN akun demo dengan salt khusus mode
// tiruan; PIN mentahnya tidak pernah ikut ke bundle produksi.
export const pengguna = [
  {
    id: 1,
    nama: 'Budi Santoso',
    email: 'admin@kantor.id',
    pin_hash: 'sha256$38305ecf098321474df4a37bcfa8f3aeb7ff0840671a223c4bbbfe87952c54d7',
    peran: 'admin',
    nip: 'ADM001',
    divisi: 'Management Data',
    shift_id: 1,
    lokasi_id: 1,
    masuk_kerja: '2020-01-01',
    cuti_kuota: 12,
    aktif: true,
    foto: null,
  },
];

// Kosong dan memang kosong. Barisnya tetap ada supaya bentuk datanya terlihat
// di satu tempat bersama yang lain, dan supaya `toko` di mock.js tidak perlu
// tahu berkas mana yang punya koleksi apa.
export const absen = [];
export const izin = [];

// Tabel pendukung yang hanya hidup di mode tiruan. Bentuknya sengaja sama
// dengan yang diminta backend asli: sesi menyimpan hash token (bukan token
// mentah), perangkat menyimpan pendaftaran kiosk, dan audit menyimpan jejak
// tindakan admin.
export const sesi = [];
export const perangkat = [];
export const audit = [];

const hariIni = bagianJakarta();

export {
  hariIni,
  tanggalISO,
  waktuISO,
  sekarangISO,
  bagianJakarta,
  bacaJam,
  geserHari,
};
