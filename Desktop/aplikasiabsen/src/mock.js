// Penjawab permintaan tiruan. Hanya dipakai saat MODE_TIRUAN aktif, supaya
// tampilan bisa dikerjakan dan didemokan sebelum backend teman Anda selesai.
//
// Isinya juga menjadi acuan PANDUAN-BACKEND.md — bentuk balasan yang saya
// karang di sini adalah bentuk yang saya minta dari backend. Datanya sendiri
// ada di `data-tiruan.js`; berkas ini hanya menangani permintaan.

import * as data from './data-tiruan.js';

/** Satu tempat untuk melihat seluruh isi "database" tiruan. */
export const toko = {
  pengguna: data.pengguna,
  lokasi: data.lokasi,
  shift: data.shift,
  hariLibur: data.hariLibur,
  absen: data.absen,
  izin: data.izin,
  sesi: data.sesi,
  perangkat: data.perangkat,
  audit: data.audit,
};

// ── Simpanan lokal ──────────────────────────────────────────────────────────
//
// Sejak data bawaan dikosongkan, satu-satunya isi aplikasi ini adalah yang Anda
// isi sendiri: daftar anak magangnya, PIN-nya, jam absennya. Kalau semuanya
// hilang setiap kali halaman dimuat ulang, mengisi daftar itu tidak ada
// gunanya — karena itu toko disimpan di localStorage.
//
// Ini HANYA berlaku di mode tiruan. PIN ikut tersimpan apa adanya di sini, dan
// itu tidak apa-apa untuk data karangan di komputer sendiri; backend asli wajib
// menyimpannya sebagai hash dan tidak pernah mengirimkannya kembali ke browser.
//
// Angka di kunci adalah versi bentuk data. Kalau suatu saat data bawaannya
// berubah banyak, naikkan angkanya: simpanan lama akan diabaikan begitu saja,
// bukan dipaksa dibaca lalu menghasilkan tampilan yang aneh.
const KUNCI_SIMPAN = 'absen-tiruan-2';

// Riwayat absen yang disimpan dipangkas. Tanpa batas, isinya tumbuh terus dan
// suatu saat penyimpanan gagal — dan pada titik itu yang hilang bisa seluruh
// isian, bukan cuma yang paling lama.
const HARI_SIMPAN = 120;

function simpan() {
  try {
    const batas = data.tanggalISO(data.geserHari(data.hariIni, -HARI_SIMPAN));
    localStorage.setItem(
      KUNCI_SIMPAN,
      JSON.stringify({
        pengguna: toko.pengguna,
        lokasi: toko.lokasi,
        shift: toko.shift,
        hariLibur: toko.hariLibur,
        izin: toko.izin,
        sesi: toko.sesi,
        perangkat: toko.perangkat,
        audit: toko.audit,
        // Foto dibuang saat menyimpan. Satu foto sekitar 60 KB setelah base64,
        // sedangkan localStorage hanya muat sekitar 5 MB — beberapa ratus absen
        // saja sudah memenuhinya, dan begitu penuh seluruh isian berikutnya
        // ikut gagal tersimpan. Yang perlu bertahan adalah jam dan statusnya;
        // foto tetap tampil tepat setelah orang absen, sebelum halaman ditutup.
        absen: toko.absen
          .filter((a) => a.tanggal >= batas)
          .map((a) => (a.foto ? { ...a, foto: null } : a)),
      }),
    );
  } catch {
    // Penyimpanan penuh atau diblokir. Aplikasi tetap jalan dengan data di
    // memori; yang hilang cuma sifatnya yang tahan muat ulang.
  }
}

function muatSimpanan() {
  try {
    const teks = localStorage.getItem(KUNCI_SIMPAN);
    if (!teks) return null;
    const isi = JSON.parse(teks);
    // Tanpa satu pun pengguna, simpanan itu tidak bisa dipakai: tidak ada yang
    // bisa masuk untuk memperbaikinya.
    if (!Array.isArray(isi?.pengguna) || isi.pengguna.length === 0) return null;
    return isi;
  } catch {
    return null;
  }
}

const simpanan = muatSimpanan();
if (simpanan) Object.assign(toko, simpanan);

const JEDA = 250; // ms, meniru waktu jaringan supaya status "memproses" kelihatan
const tunggu = () => new Promise((t) => setTimeout(t, JEDA));

const dua = (n) => String(n).padStart(2, '0');

/**
 * Buang apa pun yang tidak boleh sampai ke browser.
 *
 * `pin` sekarang satu-satunya rahasia yang dimiliki magang: dipakai untuk absen
 * di kiosk sekaligus untuk masuk ke aplikasi. PIN yang bocor ke localStorage
 * sama saja dengan tidak punya PIN — dan localStorage PC kiosk dipakai bersama.
 *
 * `sandi` sudah tidak dipakai lagi, tapi salinan lama di localStorage bisa
 * masih menyimpannya, jadi tetap ikut dibuang.
 */
function tanpaRahasia(u) {
  const { sandi, pin, pin_hash, ...aman } = u;
  return aman;
}

function galat(pesan, status, kode = null) {
  const g = new Error(pesan);
  g.status = status;
  if (kode) g.kode = kode;
  return g;
}

// ── PIN & token ────────────────────────────────────────────────────────────
//
// Mode tiruan tidak boleh menyimpan PIN terbaca atau token yang bisa ditebak.
// Backend asli wajib memakai Argon2id/bcrypt; di sini SHA-256 dengan salt tetap
// sudah cukup untuk memastikan bentuk datanya benar dan tidak ada rahasia yang
// ikut ke localStorage.

const encoder = new TextEncoder();

function keHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashTeks(teks) {
  const isi = await crypto.subtle.digest('SHA-256', encoder.encode(String(teks)));
  return `sha256$${keHex(isi)}`;
}

const hashPin = (pin) => hashTeks(`absen-tiruan-pin-v1:${pin}`);
const pinCocok = async (pin, hash) => Boolean(hash) && (await hashPin(pin)) === hash;
const hashToken = (token) => hashTeks(`absen-tiruan-token-v1:${token}`);

const UMUR_SESI = 12 * 60 * 60 * 1000; // 12 jam

function tokenAcak() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let teks = '';
  for (const x of b) teks += String.fromCharCode(x);
  return btoa(teks).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buatToken(penggunaId) {
  // Sesi lama orang yang sama dicabut: satu login aktif per akun, dan token
  // yang dipegang perangkat lain langsung tidak berlaku.
  toko.sesi = toko.sesi.filter((s) => s.pengguna_id !== penggunaId);
  const token = tokenAcak();
  toko.sesi.push({
    token_hash: await hashToken(token),
    pengguna_id: penggunaId,
    expires_at: Date.now() + UMUR_SESI,
  });
  return token;
}

async function dariToken(token) {
  if (!token) return null;
  const hash = await hashToken(token);
  const sesi = toko.sesi.find((s) => s.token_hash === hash);
  if (!sesi) return null;

  if (!Number.isFinite(sesi.expires_at) || sesi.expires_at <= Date.now()) {
    toko.sesi = toko.sesi.filter((s) => s !== sesi);
    return null;
  }

  return toko.pengguna.find((u) => u.id === sesi.pengguna_id) ?? null;
}

/**
 * PIN lama di localStorage (dari versi mock sebelumnya) diubah menjadi hash
 * sekali saat modul dipakai. Setelah itu tidak ada lagi `pin` di data.
 */
let janjiMigrasiPin = null;

function pastikanPin() {
  janjiMigrasiPin ??= migrasiPin();
  return janjiMigrasiPin;
}

async function migrasiPin() {
  let berubah = false;
  for (const u of toko.pengguna) {
    if (typeof u.pin === 'string') {
      if (!u.pin_hash) u.pin_hash = await hashPin(u.pin);
      delete u.pin;
      berubah = true;
    }
    if ('sandi' in u) {
      delete u.sandi;
      berubah = true;
    }
  }
  if (berubah) simpan();
}

/**
 * Pembatasan percobaan PIN. Kuncinya sama dengan yang diminta backend:
 * jenis endpoint + NIP + IP. Di mode tiruan IP-nya tetap, karena browser tidak
 * punya REMOTE_ADDR; backend asli wajib membaca IP dari koneksi, bukan header
 * X-Forwarded-For mentah.
 */
const IP_TIRUAN = '127.0.0.1';
const BATAS_GAGAL = 5;
const JEDA_GAGAL = 60_000;
const percobaan = new Map();

const kunciPercobaan = (jenis, nip) => `${jenis}:${nip}:${IP_TIRUAN}`;

function periksaBatas(kunci) {
  const catatan = percobaan.get(kunci);
  if (!catatan) return;
  if (Date.now() - catatan.mulai >= JEDA_GAGAL) {
    percobaan.delete(kunci);
    return;
  }
  if (catatan.gagal >= BATAS_GAGAL) {
    throw galat('Terlalu banyak percobaan. Coba lagi dalam 60 detik.', 429, 'terlalu_banyak');
  }
}

function catatGagal(kunci) {
  let catatan = percobaan.get(kunci);
  if (!catatan || Date.now() - catatan.mulai >= JEDA_GAGAL) {
    catatan = { gagal: 0, mulai: Date.now() };
  }
  catatan.gagal += 1;
  percobaan.set(kunci, catatan);

  // Percobaan gagal kelima langsung dijawab 429, bukan menunggu percobaan
  // keenam. Setelah 60 detik hitungannya kembali dari nol.
  if (catatan.gagal >= BATAS_GAGAL) {
    throw galat('Terlalu banyak percobaan. Coba lagi dalam 60 detik.', 429, 'terlalu_banyak');
  }
}

const lupakanGagal = (kunci) => percobaan.delete(kunci);

/**
 * Pintu masuk semua endpoint admin. Dipisah supaya tidak ada satu pun endpoint
 * admin yang lupa memeriksa peran — itu kesalahan yang paling mudah terjadi
 * kalau pemeriksaannya ditulis ulang di tiap blok.
 */
async function adminSaja(token) {
  const aku = await dariToken(token);
  if (!aku) throw galat('Sesi tidak ditemukan. Silakan masuk lagi.', 401, 'sesi_habis');
  if (!aku.aktif) throw galat('Akun Anda sudah dinonaktifkan.', 403, 'akun_nonaktif');
  if (aku.peran !== 'admin') throw galat('Halaman ini hanya untuk admin.', 403, 'tidak_berhak');
  return aku;
}

/** Nomor urut berikutnya untuk koleksi ber-`id`. */
const idBaru = (koleksi) => koleksi.reduce((n, x) => Math.max(n, x.id), 0) + 1;

/**
 * Jejak tindakan admin. Tidak ditampilkan di layar mana pun (belum ada layar
 * audit), tetapi disimpan supaya perubahan PIN, keputusan cuti, dan perubahan
 * data master bisa ditelusuri. Jangan pernah menulis PIN ke sini.
 */
function catatAudit(aku, aksi, rincian = {}) {
  toko.audit.push({
    id: idBaru(toko.audit),
    pengguna_id: aku?.id ?? null,
    nama: aku?.nama ?? null,
    aksi,
    rincian,
    waktu: data.sekarangISO(),
    ip: IP_TIRUAN,
  });
}

/** NIP selalu disimpan huruf besar: "kry001" dan "KRY001" adalah orang yang sama. */
const rapikanNip = (teks) => String(teks ?? '').trim().toUpperCase();

/** Nama lokasi, shift, dan magang dibandingkan tanpa membedakan huruf besar-kecil. */
const samaNama = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

const JALUR_ID = {
  magang: /^\/admin\/magang\/(\d+)$/,
  lokasi: /^\/admin\/lokasi\/(\d+)$/,
  shift: /^\/admin\/shift\/(\d+)$/,
  'hari-libur': /^\/admin\/hari-libur\/(\d+)$/,
};

/**
 * Kalau tanggalnya bukan hari kerja, kembalikan alasannya. Kalau hari kerja,
 * kembalikan null.
 *
 * Ini bukan hiasan. Tanpa pemeriksaan ini, dashboard yang dibuka pada hari
 * Sabtu melaporkan "48 magang belum absen" — angka yang benar secara
 * hitungan tapi menyesatkan secara arti, dan admin akan mengira seluruh kantor
 * membolos.
 */
function keteranganLibur(tanggal) {
  const minggu = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
  if (minggu === 0) return 'Hari Minggu';
  if (minggu === 6) return 'Hari Sabtu';
  return toko.hariLibur.find((h) => h.tanggal === tanggal)?.keterangan ?? null;
}

/** Tanggal kerja terdekat pada atau setelah tanggal ini. */
function hariKerjaBerikut(b) {
  let h = b;
  for (let i = 0; i < 10; i++) {
    if (!keteranganLibur(data.tanggalISO(h))) return h;
    h = data.geserHari(h, 1);
  }
  return b;
}

/** Jumlah hari kerja dalam sebulan, dihitung dari tanggal bergabung kalau perlu. */
function hariKerjaBulan(bulan, sejak) {
  const [tahun, bln] = bulan.split('-').map(Number);
  const jumlahHari = new Date(Date.UTC(tahun, bln, 0)).getUTCDate();
  const bulanIni = data.tanggalISO(data.hariIni).slice(0, 7);

  // Bulan berjalan hanya dihitung sampai hari ini. Bulan yang belum lewat
  // dihitung penuh.
  const batas = bulan === bulanIni ? data.hariIni.tanggal : bulan < bulanIni ? jumlahHari : 0;
  const mulai = sejak && sejak.slice(0, 7) === bulan ? Number(sejak.slice(8, 10)) : 1;

  const libur = new Set(toko.hariLibur.map((h) => h.tanggal));
  let n = 0;
  for (let d = Math.max(mulai, 1); d <= batas; d++) {
    const minggu = new Date(Date.UTC(tahun, bln - 1, d)).getUTCDay();
    if (minggu === 0 || minggu === 6) continue;
    if (libur.has(`${bulan}-${dua(d)}`)) continue;
    n += 1;
  }
  return n;
}

/**
 * Daftar tanggal kerja dalam sebuah rentang, inklusif.
 * Sabtu, Minggu, dan hari libur keluar dari daftar.
 *
 * Dipakai untuk semua hitungan izin, cuti, alpha, dan laporan. Sengaja
 * mengembalikan tanggalnya, bukan cuma jumlahnya: laporan bulanan perlu tahu
 * tanggal mana saja yang tertutup izin, dan menghitung ulang di tempat lain
 * berarti ada dua definisi "hari kerja" yang bisa saling melenceng.
 *
 * Batas 400 hari ada supaya rentang yang salah tulis tidak mengunci server
 * dalam perulangan tanpa ujung.
 */
function hariKerjaRentang(mulai, selesai) {
  const hasil = [];
  let h = new Date(`${mulai}T00:00:00Z`);
  const akhir = new Date(`${selesai}T00:00:00Z`);
  if (Number.isNaN(h.getTime()) || Number.isNaN(akhir.getTime())) return hasil;

  for (let i = 0; i < 400 && h <= akhir; i++) {
    const tgl = h.toISOString().slice(0, 10);
    if (!keteranganLibur(tgl)) hasil.push(tgl);
    h = new Date(h.getTime() + 86400000);
  }
  return hasil;
}

/** Jumlah hari kerja dalam rentang, inklusif. */
const hariKerjaAntara = (mulai, selesai) => hariKerjaRentang(mulai, selesai).length;

/**
 * Cuti tahun berjalan: jatah, terpakai, menunggu, sisa.
 *
 * Dihitung dalam HARI KERJA, bukan hari kalender. Cuti Jumat sampai Senin itu
 * dua hari, bukan empat — Sabtu dan Minggu tidak diambil dari jatah siapa pun.
 * Satu definisi di sini dipakai oleh layar Izin & Cuti, beranda magang, dan
 * pemeriksaan saat mengajukan; kalau salah satunya menghitung sendiri, sisa
 * cuti di dua layar akan berbeda dan tidak ada yang bisa dipercaya.
 */
function kuotaCuti(penggunaId) {
  const tahun = data.tanggalISO(data.hariIni).slice(0, 4);
  const jatah = toko.pengguna.find((u) => u.id === penggunaId)?.cuti_kuota ?? 0;

  const hitung = (status) =>
    toko.izin
      .filter(
        (z) =>
          z.pengguna_id === penggunaId &&
          z.jenis === 'cuti' &&
          z.status === status &&
          z.mulai.slice(0, 4) === tahun,
      )
      .reduce((n, z) => n + hariKerjaAntara(z.mulai, z.selesai), 0);

  const terpakai = hitung('disetujui');
  const menunggu = hitung('menunggu');
  // Pengajuan yang masih menunggu ikut memotong jatah. Kalau tidak, satu orang
  // bisa mengajukan beberapa cuti untuk tanggal yang sama dan baru ketahuan
  // saat admin menyetujui yang terakhir.
  return { jatah, terpakai, menunggu, sisa: Math.max(0, jatah - terpakai - menunggu) };
}

/**
 * Pengajuan yang menutupi rentang yang sama, yang belum ditolak.
 *
 * Yang berstatus `menunggu` ikut dihitung: kalau tidak, satu orang bisa
 * mengirim tiga pengajuan untuk tanggal yang sama dan admin baru sadar saat
 * menyetujui yang ketiga.
 */
function pengajuanBentrok(penggunaId, mulai, selesai, kecualiId = null) {
  return (
    toko.izin.find(
      (z) =>
        z.pengguna_id === penggunaId &&
        z.id !== kecualiId &&
        z.status !== 'ditolak' &&
        z.mulai <= selesai &&
        z.selesai >= mulai,
    ) ?? null
  );
}

/**
 * Satu baris per hari kerja untuk satu orang dalam satu bulan.
 *
 * Satu baris per hari, bukan per catatan absen: yang dibaca orang adalah
 * "tanggal 5 masuk 07:58, pulang 17:04", bukan dua baris terpisah yang harus
 * disatukan sendiri di kepala.
 */
function riwayatBulan(penggunaId, bulan) {
  const orang = toko.pengguna.find((u) => u.id === penggunaId);
  if (!orang) return [];

  const [tahun, bln] = bulan.split('-').map(Number);
  const jumlahHari = new Date(Date.UTC(tahun, bln, 0)).getUTCDate();
  const bulanIni = data.tanggalISO(data.hariIni).slice(0, 7);
  const batas = bulan === bulanIni ? data.hariIni.tanggal : bulan < bulanIni ? jumlahHari : 0;
  const hariIniStr = data.tanggalISO(data.hariIni);
  const namaLokasi = (id) => toko.lokasi.find((l) => l.id === id)?.nama ?? '—';

  const baris = [];
  for (let d = 1; d <= batas; d++) {
    const tgl = `${bulan}-${dua(d)}`;
    if (orang.masuk_kerja > tgl) continue;

    const libur = keteranganLibur(tgl);
    const catatan = toko.absen.filter((a) => a.pengguna_id === penggunaId && a.tanggal === tgl);
    const masuk = catatan.find((a) => a.tipe === 'masuk') ?? null;
    const pulang = catatan.find((a) => a.tipe === 'pulang') ?? null;

    const izin = toko.izin.find(
      (z) =>
        z.pengguna_id === penggunaId &&
        z.status === 'disetujui' &&
        z.mulai <= tgl &&
        z.selesai >= tgl,
    );

    let status;
    if (libur) status = 'libur';
    // Absen menang atas izin. Kalau orangnya ternyata masuk juga, harinya
    // dihitung hadir — bukan dobel sebagai hadir DAN cuti. Rekap bulanan yang
    // menjumlahkan keduanya akan melaporkan angka yang lebih besar daripada
    // jumlah hari kerja, dan itu tidak bisa dijelaskan ke siapa pun.
    else if (masuk) status = masuk.telat_menit > 0 ? 'telat' : 'tepat';
    else if (izin) status = izin.jenis;
    else status = tgl === hariIniStr ? 'belum' : 'alpha';

    baris.push({
      tanggal: tgl,
      keterangan_libur: libur,
      // Jam dikirim apa adanya dalam bentuk ISO lengkap. Pemformatan adalah
      // urusan tampilan — server yang mengirim "07:58" untuk satu kolom dan
      // ISO untuk kolom lain akan memaksa frontend menebak mana yang mana.
      masuk: masuk?.waktu ?? null,
      pulang: pulang?.waktu ?? null,
      telat_menit: masuk?.telat_menit ?? 0,
      status,
      keterangan_izin: izin?.jenis ?? null,
      alasan_izin: izin?.alasan ?? null,
      // Label lokasi disusun di sini, bukan di layar: satu tempat untuk dua
      // layar yang memakainya (riwayat magang dan rincian laporan admin).
      // `lokasi` tetap label yang dibaca manusia; `lokasi_kantor` adalah nama
      // titik kantor yang dipakai server untuk menghitung jarak.
      lokasi: masuk ? (masuk.mode === 'luar' ? 'Dinas luar' : namaLokasi(masuk.lokasi_id)) : null,
      lokasi_kantor: masuk ? namaLokasi(masuk.lokasi_id) : null,
      mode: masuk?.mode ?? 'kantor',
      lintang: masuk?.lintang ?? null,
      bujur: masuk?.bujur ?? null,
      akurasi: masuk?.akurasi ?? null,
      // Jarak dihitung SERVER saat absen dan disimpan. Frontend hanya
      // menampilkannya; jangan menghitung ulang di browser.
      jarak_m: masuk?.jarak_m ?? null,
      // Alamat hasil reverse geocoding saat absen. `null` kalau layanan peta
      // sedang tidak bisa dihubungi; frontend lalu menampilkan koordinat.
      lokasi_teks: masuk?.lokasi_teks ?? null,
      lokasi_meragukan: masuk?.lokasi_meragukan ?? false,
      foto: masuk?.foto ?? null,
    });
  }
  return baris;
}

/**
 * Rekap satu bulan untuk seluruh magang.
 *
 * Magang yang sudah dinonaktifkan tetap muncul kalau dia punya catatan di
 * bulan itu: orang yang berhenti tanggal 10 harus tetap terlihat di laporan
 * bulan berjalan, kalau tidak, kehadirannya selama sepuluh hari hilang dari
 * rekap dan angka gaji ikut salah.
 */
function rekapBulan(bulan) {
  const adaCatatan = new Set(
    toko.absen.filter((a) => a.tanggal.slice(0, 7) === bulan).map((a) => a.pengguna_id),
  );

  const baris = [];
  for (const orang of toko.pengguna) {
    const adaCatatanBulanIni = adaCatatan.has(orang.id);

    // Dua alasan seseorang tidak muncul di rekap bulanan, dan keduanya harus
    // punya catatan kosong di bulan itu:
    //
    // - Akunnya sudah dinonaktifkan. Orang yang berhenti tanggal 10 harus tetap
    //   terlihat di laporan bulan berjalan; kalau tidak, kehadirannya selama
    //   sepuluh hari hilang dari rekap dan angkanya ikut salah.
    // - Akunnya admin. Admin mengurus aplikasinya, bukan diabsen — sama seperti
    //   di dashboard. Tanpa pengecualian ini, setiap bulan ada satu baris dengan
    //   belasan hari "tanpa catatan" yang tidak bisa dijelaskan ke siapa pun.
    //
    // Admin yang ternyata ikut absen tetap muncul, karena `adaCatatanBulanIni`.
    if (!adaCatatanBulanIni && (!orang.aktif || orang.peran === 'admin')) continue;

    const hari = riwayatBulan(orang.id, bulan);
    const hitung = (status) => hari.filter((h) => h.status === status).length;
    const hadir = hitung('tepat') + hitung('telat');

    baris.push({
      pengguna_id: orang.id,
      nip: orang.nip,
      nama: orang.nama,
      divisi: orang.divisi,
      nik: orang.nik,
      shift: toko.shift.find((s) => s.id === orang.shift_id)?.nama ?? '—',
      aktif: orang.aktif,
      hari_kerja: hari.filter((h) => h.status !== 'libur' && h.status !== 'belum').length,
      hadir,
      telat: hitung('telat'),
      telat_menit: hari.reduce((n, h) => n + h.telat_menit, 0),
      izin: hitung('izin'),
      cuti: hitung('cuti'),
      sakit: hitung('sakit'),
      alpha: hitung('alpha'),
      // Jumlah absen di luar kantor, supaya admin tahu siapa yang perlu
      // dibuka rinciannya. `luar_kasar` = yang akurasi GPS-nya rendah.
      luar: hari.filter((h) => h.mode === 'luar' && h.masuk).length,
      luar_kasar: hari.filter(
        (h) =>
          h.mode === 'luar' &&
          h.masuk &&
          (h.lokasi_meragukan || !Number.isFinite(h.akurasi) || h.akurasi > 50),
      ).length,
    });
  }

  return baris.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

/**
 * Periksa isian magang, kembalikan barisnya yang sudah bersih.
 *
 * Urutan pemeriksaan sengaja: kelengkapan dulu, baru keunikan. Pesan "NIP
 * sudah dipakai" untuk NIP yang memang kosong hanya membingungkan.
 *
 * `idSendiri` dipakai saat mengubah, supaya barisnya tidak dianggap bentrok
 * dengan dirinya sendiri.
 */
async function periksaMagang(isian, { baru, idSendiri = null }) {
  const nama = String(isian.nama ?? '').trim();
  const nip = rapikanNip(isian.nip);
  const email = String(isian.email ?? '').trim().toLowerCase();
  const nik = String(isian.nik ?? '').trim();
  const masukKerja = String(isian.masuk_kerja ?? '').trim();

  if (!nama) throw galat('Nama magang belum diisi.', 422);
  if (!nip) throw galat('NIP belum diisi.', 422);
  // Email bukan lagi nama pengguna saat masuk — itu NIP. Jadi kolomnya boleh
  // kosong, dan yang diperiksa cuma bentuknya kalau memang diisi.
  if (email && !email.includes('@')) throw galat('Email belum diisi dengan benar.', 422);
  // NIK bukan kunci apa pun di aplikasi ini — dia cuma data diri, dipakai saat
  // datanya diteruskan ke urusan lain (BPJS, kontrak). Karena itu boleh kosong,
  // tapi kalau diisi bentuknya dijaga: 16 angka.
  if (nik && !/^\d{16}$/.test(nik)) throw galat('NIK harus 16 angka.', 422);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(masukKerja)) throw galat('Tanggal masuk belum diisi.', 422);

  const lain = (cocok) => toko.pengguna.some((u) => u.id !== idSendiri && cocok(u));
  if (lain((u) => u.nip.toUpperCase() === nip)) {
    throw galat(`NIP ${nip} sudah dipakai magang lain.`, 409);
  }
  if (email && lain((u) => String(u.email ?? '').toLowerCase() === email)) {
    throw galat(`Email ${email} sudah dipakai magang lain.`, 409);
  }

  const shiftId = Number(isian.shift_id);
  if (!toko.shift.some((s) => s.id === shiftId)) throw galat('Shift belum dipilih.', 422);

  const lokasiId = Number(isian.lokasi_id);
  if (!toko.lokasi.some((l) => l.id === lokasiId)) throw galat('Lokasi kerja belum dipilih.', 422);

  // Divisi diambil dari daftar tetap, bukan diketik bebas. Kolom bebas
  // menghasilkan "Management Data", "manajemen data", dan "Mgmt Data" hidup
  // berdampingan pada orang yang berbeda — dan hitungan per divisi jadi tidak
  // bisa dijumlahkan, padahal itu yang ditanyakan admin.
  const divisi = String(isian.divisi ?? '').trim();
  if (!data.DIVISI.includes(divisi)) {
    throw galat(`Divisi harus salah satu dari: ${data.DIVISI.join(', ')}.`, 422);
  }

  const hasil = {
    nama,
    nip,
    email,
    nik,
    divisi,
    peran: isian.peran === 'admin' ? 'admin' : 'magang',
    shift_id: shiftId,
    lokasi_id: lokasiId,
    masuk_kerja: masukKerja,
    cuti_kuota: Math.max(0, Math.round(Number(isian.cuti_kuota) || 0)),
  };

  // PIN itu rahasia, dan pada formulir "ubah" kolomnya boleh dikosongkan —
  // artinya "biarkan yang lama". Karena itu yang kosong tidak ikut
  // dikembalikan, bukan ditimpa jadi kosong. Tanpa aturan ini, mengubah nama
  // seseorang akan sekaligus mengosongkan PIN-nya, dan dia tidak bisa
  // absen lagi besok pagi — sekaligus tidak bisa masuk aplikasi.
  const pin = String(isian.pin ?? '').trim();
  if (pin) {
    if (!/^\d{4,6}$/.test(pin)) throw galat('PIN harus 4 sampai 6 angka.', 422);
    const hash = await hashPin(pin);
    if (toko.pengguna.some((u) => u.id !== idSendiri && u.pin_hash === hash)) {
      throw galat('PIN itu sudah dipakai magang lain. PIN kembar membuat absen tidak jelas milik siapa.', 409);
    }
    hasil.pin_hash = hash;
  } else if (baru) {
    throw galat('PIN belum diisi.', 422);
  }

  return hasil;
}

// ── Jarak absen & alamat ────────────────────────────────────────────────────
//
// Ini bagian yang MENIRU PEKERJAAN SERVER. Di backend asli, perhitungan ini
// wajib terjadi di server — bukan di browser. Angka lintang/bujur datang dari
// klien dan bisa diubah sebelum dikirim, jadi browser tidak boleh menjadi
// hakim jarak. Di mode tiruan, mock.js berperan sebagai server.
//
// "Dinas luar" TIDAK ditolak karena jauh dari kantor: justru itu tujuannya.
// Server mencatat jaraknya sebagai keterangan, lalu admin melihat titik dan
// alamatnya. Yang tetap diperiksa adalah akurasi GPS — titik yang terlalu kasar
// tidak berguna untuk melacak orang.
//
// Rumus Haversine dipakai karena Bumi bulat; untuk jarak beberapa puluh meter
// selisihnya dengan rumus yang lebih rumit tidak terasa, tetapi rumus ini tetap
// benar untuk jarak jauh dan tidak butuh API berbayar.

const RADIUS_BAWAAN = 50; // meter, pembanding "masih di area kantor"
// Di atas ini, titik GPS dianggap terlalu kasar untuk dijadikan dasar
// pencatatan. PC kiosk tanpa GPS bisa melaporkan ratusan meter; untuk mode
// "kantor" angkanya hanya ditandai, sedangkan untuk "luar" titiknya ditolak
// karena tujuannya memang melacak posisi.
const AKURASI_MAKS = 150; // meter

const radian = (derajat) => (derajat * Math.PI) / 180;

function jarakMeter(lintang1, bujur1, lintang2, bujur2) {
  const R = 6371000; // jari-jari Bumi, meter
  const dLat = radian(lintang2 - lintang1);
  const dBujur = radian(bujur2 - bujur1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radian(lintang1)) * Math.cos(radian(lintang2)) * Math.sin(dBujur / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Angka koordinat dari isian formulir; `null` kalau kosong. */
function bacaKoordinat(nilai, batas, label) {
  if (nilai === null || nilai === undefined || String(nilai).trim() === '') return null;
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || Math.abs(angka) > batas) {
    throw galat(`${label} harus berupa angka antara -${batas} dan ${batas}.`, 422);
  }
  return Number(angka.toFixed(6));
}

/**
 * Validasi titik absen "dinas luar".
 *
 * Jarak TIDAK dipakai untuk menolak: magang yang sedang bertugas di luar
 * kantor memang jauh. Yang diperiksa adalah titik kantor tersedia (sebagai
 * pembanding jarak) dan akurasi GPS wajar untuk dicatat.
 *
 * Mengembalikan angka yang disimpan di baris absen, bukan keputusan tampilan.
 */
function periksaLokasiLuar({ lokasi, lintang, bujur, akurasi }) {
  if (!lokasi) {
    throw galat('Lokasi kiosk tidak ditemukan. Hubungi admin kantor.', 422);
  }
  if (!Number.isFinite(lokasi.lintang) || !Number.isFinite(lokasi.bujur)) {
    throw galat(
      `Titik kantor "${lokasi.nama}" belum diatur. Admin perlu mengisi lintang dan bujur lokasi itu di Data Master.`,
      422,
    );
  }
  if (!Number.isFinite(akurasi) || akurasi < 0) {
    throw galat(
      'Akurasi GPS tidak terkirim. Nyalakan lokasi presisi di perangkat ini, lalu ambil lokasi ulang.',
      422,
    );
  }
  if (akurasi > AKURASI_MAKS) {
    throw galat(
      `Akurasi GPS ±${Math.round(akurasi)} m terlalu rendah untuk mencatat posisi Anda. ` +
        'Nyalakan GPS/lokasi presisi, tunggu sampai akurasinya membaik, lalu coba lagi.',
      422,
    );
  }

  const jarak = Math.round(jarakMeter(lintang, bujur, lokasi.lintang, lokasi.bujur));

  return {
    jarak_m: jarak,
    akurasi: Math.round(akurasi),
    // Bukan penolakan, tetapi admin perlu tahu bahwa angkanya kasar. Nilai ini
    // ditampilkan sebagai catatan kecil, bukan dipakai menghakimi sendiri.
    lokasi_meragukan: akurasi > 50,
  };
}

// ── Alamat dari koordinat (reverse geocoding) ───────────────────────────────
//
// Nominatim (OpenStreetMap) dipakai karena gratis, tanpa kunci API, dan boleh
// dipanggil dari browser maupun server. Kebijakannya: maksimal satu permintaan
// per detik, hasilnya disimpan, dan aplikasinya memperkenalkan diri lewat
// Referer/User-Agent. Di backend asli, panggil dari server dan simpan hasilnya
// di kolom `lokasi_teks` — jangan membebani Nominatim tiap kali halaman dibuka.
//
// Kalau layanan peta tidak bisa dihubungi, absen TETAP diterima. `lokasi_teks`
// dibiarkan null dan frontend menampilkan koordinat + tautan peta.

const KUNCI_GEOKODE = 'absen-geokode-1';
const GEOKODE_JEDA = 1100; // ms, sedikit di atas batas 1 permintaan/detik
const GEOKODE_BATAS = 300; // jumlah cache yang disimpan

let rantaiGeokode = Promise.resolve();
let geokodeTerakhir = 0;

function bacaCacheGeokode() {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_GEOKODE) ?? '{}');
    return isi && typeof isi === 'object' ? isi : {};
  } catch {
    return {};
  }
}

function simpanCacheGeokode(cache) {
  try {
    const kunci = Object.keys(cache);
    if (kunci.length > GEOKODE_BATAS) {
      for (const k of kunci.slice(0, kunci.length - GEOKODE_BATAS)) delete cache[k];
    }
    localStorage.setItem(KUNCI_GEOKODE, JSON.stringify(cache));
  } catch {
    // Cache gagal disimpan bukan alasan menggagalkan absen.
  }
}

/** Susun alamat pendek dari balasan Nominatim, bukan `display_name` yang panjang. */
function teksAlamat(isi) {
  const a = isi?.address ?? {};
  const jalan = a.road ? `${a.road}${a.house_number ? ` ${a.house_number}` : ''}` : null;
  const tempat = a.amenity || a.building || a.shop || a.office || a.tourism || null;
  const daerah =
    a.village || a.suburb || a.neighbourhood || a.city_district || a.town || a.hamlet || null;
  const kota = a.city || a.county || a.municipality || a.state || null;
  const bagian = [jalan || tempat, daerah, kota]
    .map((b) => String(b ?? '').trim())
    .filter(Boolean);

  return [...new Set(bagian)].join(', ') || isi?.display_name || null;
}

function geokodeTerbalik(lintang, bujur) {
  const kunci = `${Number(lintang).toFixed(4)},${Number(bujur).toFixed(4)}`;
  const tersimpan = bacaCacheGeokode();
  if (Object.prototype.hasOwnProperty.call(tersimpan, kunci)) {
    return Promise.resolve(tersimpan[kunci]);
  }

  const kerja = async () => {
    // Antrekan permintaan supaya tidak melewati batas 1 permintaan/detik.
    const jeda = GEOKODE_JEDA - (Date.now() - geokodeTerakhir);
    if (jeda > 0) await new Promise((selesai) => setTimeout(selesai, jeda));
    geokodeTerakhir = Date.now();

    const kendali = new AbortController();
    const batas = setTimeout(() => kendali.abort(), 3000);
    try {
      const alamat = new URL('https://nominatim.openstreetmap.org/reverse');
      alamat.searchParams.set('format', 'jsonv2');
      alamat.searchParams.set('lat', String(lintang));
      alamat.searchParams.set('lon', String(bujur));
      alamat.searchParams.set('zoom', '18');
      alamat.searchParams.set('addressdetails', '1');
      alamat.searchParams.set('accept-language', 'id');

      const jawab = await fetch(alamat, {
        signal: kendali.signal,
        headers: { Accept: 'application/json' },
      });
      if (!jawab.ok) return null;

      const teks = teksAlamat(await jawab.json());
      if (teks) {
        const cache = bacaCacheGeokode();
        cache[kunci] = teks;
        simpanCacheGeokode(cache);
      }
      return teks;
    } catch {
      // Layanan peta sedang tidak bisa dihubungi. Bukan alasan menolak absen.
      return null;
    } finally {
      clearTimeout(batas);
    }
  };

  const hasil = rantaiGeokode.then(kerja, kerja);
  rantaiGeokode = hasil.catch(() => {});
  return hasil;
}

function periksaLokasi(isian, { idSendiri = null } = {}) {
  const nama = String(isian.nama ?? '').trim();
  if (!nama) throw galat('Nama lokasi belum diisi.', 422);
  if (toko.lokasi.some((l) => l.id !== idSendiri && samaNama(l.nama, nama))) {
    throw galat(`Lokasi "${nama}" sudah ada.`, 409);
  }

  const lintang = bacaKoordinat(isian.lintang, 90, 'Lintang');
  const bujur = bacaKoordinat(isian.bujur, 180, 'Bujur');
  if (lintang === null || bujur === null) {
    throw galat(
      'Titik kantor wajib diisi. Tanpa lintang dan bujur, server tidak bisa menghitung jarak absen.',
      422,
    );
  }

  const radius = Number(isian.radius_m ?? RADIUS_BAWAAN);
  if (!Number.isFinite(radius) || radius < 1 || radius > 5000) {
    throw galat('Radius area kantor harus antara 1 dan 5000 meter.', 422);
  }

  return {
    nama,
    alamat: String(isian.alamat ?? '').trim(),
    aktif: String(isian.aktif) !== 'false',
    lintang,
    bujur,
    radius_m: Math.round(radius),
  };
}

function periksaShift(isian, { idSendiri = null } = {}) {
  const nama = String(isian.nama ?? '').trim();
  const masuk = String(isian.masuk ?? '').trim();
  const pulang = String(isian.pulang ?? '').trim();
  const bentukJam = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!nama) throw galat('Nama shift belum diisi.', 422);
  if (!bentukJam.test(masuk) || !bentukJam.test(pulang)) {
    throw galat('Jam masuk dan jam pulang harus diisi.', 422);
  }
  // Sengaja tidak memeriksa pulang harus lebih besar dari masuk: shift malam
  // yang mulai 22.00 dan berakhir 06.00 itu wajar.
  if (masuk === pulang) throw galat('Jam masuk dan jam pulang tidak boleh sama.', 422);
  if (toko.shift.some((s) => s.id !== idSendiri && samaNama(s.nama, nama))) {
    throw galat(`Shift "${nama}" sudah ada.`, 409);
  }

  const toleransi = Math.round(Number(isian.toleransi_menit));
  if (!Number.isFinite(toleransi) || toleransi < 0 || toleransi > 120) {
    throw galat('Toleransi keterlambatan harus antara 0 dan 120 menit.', 422);
  }

  return { nama, masuk, pulang, toleransi_menit: toleransi, aktif: String(isian.aktif) !== 'false' };
}

function periksaLibur(isian, { idSendiri = null } = {}) {
  const tanggal = String(isian.tanggal ?? '').trim();
  const keterangan = String(isian.keterangan ?? '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw galat('Tanggal belum diisi dengan benar.', 422);
  if (!keterangan) throw galat('Keterangan belum diisi.', 422);
  if (toko.hariLibur.some((h) => h.id !== idSendiri && h.tanggal === tanggal)) {
    throw galat('Tanggal itu sudah terdaftar sebagai hari libur.', 409);
  }
  return { tanggal, keterangan };
}

/**
 * Penjawab permintaan tiruan yang sebenarnya.
 *
 * Dipisah dari `tanggapi` di bawah cuma supaya penyimpanan ke localStorage
 * terjadi di satu tempat untuk semua endpoint yang mengubah data. Permintaan
 * yang gagal tidak menyimpan apa-apa: galatnya dilempar, dan baris penyimpanan
 * tidak pernah tercapai.
 */
async function tanggapiAsli(metode, jalur, dataKirim, token) {
  await tunggu();

  const tanpaKueri = jalur.split('?')[0];
  const kueri = new URLSearchParams(jalur.split('?')[1] ?? '');

  // ── masuk / keluar ───────────────────────────────────────────────────────

  if (metode === 'POST' && tanpaKueri === '/masuk') {
    // Masuk memakai NIP + PIN, bukan email + kata sandi.
    //
    // Dua alasan. Pertama, PIN sudah dihafal untuk absen di kiosk, jadi satu
    // rahasia cukup untuk dua pintu — dan tidak ada kata sandi yang perlu
    // dikarang admin setiap kali membuat akun. Kedua, anak magang belum tentu
    // punya email kantor; NIP selalu ada karena itu yang dipakai absen.
    //
    // Pesannya sengaja tidak membedakan mana yang salah, sama seperti kiosk:
    // "NIP tidak ditemukan" akan memetakan daftar NIP satu per satu.
    const nip = rapikanNip(dataKirim?.nip);
    const pin = String(dataKirim?.pin ?? '');
    const kunci = kunciPercobaan('login', nip);
    periksaBatas(kunci);

    const cocok = toko.pengguna.find((u) => u.nip.toUpperCase() === nip);
    const pinBenar = cocok ? await pinCocok(pin, cocok.pin_hash) : false;
    if (!cocok || !pinBenar) {
      catatGagal(kunci);
      throw galat('NIP atau PIN salah.', 401, 'kredensial_salah');
    }

    // Sampai layar Data Magang ada, tidak ada cara menonaktifkan siapa pun,
    // jadi pemeriksaan ini tidak pernah terpakai. Sekarang ada, dan tanpa ini
    // tombol "Nonaktifkan" cuma menghias: orangnya masih bisa masuk seperti
    // biasa. Pemeriksaan di /saya/profil tidak menolong — itu baru berjalan
    // saat aplikasi dibuka berikutnya, bukan saat dia menekan Masuk.
    if (!cocok.aktif) {
      throw galat('Akun Anda sudah dinonaktifkan. Hubungi admin kantor.', 403, 'akun_nonaktif');
    }

    lupakanGagal(kunci);
    return { token: await buatToken(cocok.id), pengguna: tanpaRahasia(cocok) };
  }

  if (metode === 'POST' && tanpaKueri === '/keluar') {
    // Token dicabut di sisi server, bukan cuma dihapus dari localStorage
    // browser. Token yang sama setelah logout harus ditolak 401.
    if (token) {
      const hash = await hashToken(token);
      toko.sesi = toko.sesi.filter((s) => s.token_hash !== hash);
    }
    return { ok: true };
  }

  // ── kiosk ────────────────────────────────────────────────────────────────
  //
  // Endpoint ini yang paling perlu dijaga di backend asli. Di sini pun saya
  // tulis kunci atasnya: NIP dan PIN dibandingkan bersamaan, dan pesan
  // galatnya sengaja tidak membedakan mana yang salah. Kalau backend menjawab
  // "NIP tidak ditemukan", orang bisa memetakan NIP magang satu per satu.

  if (metode === 'GET' && tanpaKueri === '/kiosk/lokasi') {
    const diminta = Number(kueri.get('lokasi'));
    const idPerangkat = String(kueri.get('perangkat') ?? '').trim();
    const aktif = toko.lokasi.filter((l) => l.aktif);
    // Lokasi yang ditutup tidak lagi bisa dipakai kiosk. Kalau alamat kiosk
    // menyebut lokasi yang sudah ditutup, dia jatuh ke lokasi aktif pertama
    // alih-alih menerima absen di lokasi yang tidak dipakai lagi.
    const lokasi = aktif.find((l) => l.id === diminta) ?? aktif[0] ?? toko.lokasi[0];

    if (!idPerangkat) return { id: lokasi.id, nama: lokasi.nama };

    // Perangkat adalah identitas kiosk. Di backend asli pendaftarannya
    // dilakukan admin; di mode tiruan perangkat pertama yang membuka alamat
    // kiosk otomatis terikat ke lokasi itu, dan setelah terikat tidak bisa
    // dipindah hanya dengan mengubah ?lokasi= di URL.
    let perangkat = toko.perangkat.find((p) => p.id === idPerangkat);
    if (!perangkat) {
      perangkat = {
        id: idPerangkat,
        lokasi_id: lokasi.id,
        aktif: true,
        dibuat: data.sekarangISO(),
      };
      toko.perangkat.push(perangkat);
      simpan();
    }

    if (perangkat.aktif === false) {
      throw galat(
        'Perangkat kiosk ini dinonaktifkan. Hubungi admin kantor untuk mendaftarkannya kembali.',
        403,
        'tidak_berhak',
      );
    }

    const terpasang = aktif.find((l) => l.id === perangkat.lokasi_id) ?? lokasi;
    return { id: terpasang.id, nama: terpasang.nama, kiosk_id: perangkat.id };
  }

  if (metode === 'POST' && tanpaKueri === '/kiosk/absen') {
    const nip = rapikanNip(dataKirim?.nip);
    const pin = String(dataKirim?.pin ?? '');
    const kunci = kunciPercobaan('kiosk', nip);
    periksaBatas(kunci);

    const orang = toko.pengguna.find((u) => u.nip.toUpperCase() === nip);
    const pinBenar = orang ? await pinCocok(pin, orang.pin_hash) : false;
    if (!orang || !pinBenar) {
      catatGagal(kunci);
      throw galat('NIP atau PIN salah.', 401, 'kredensial_salah');
    }

    // Magang yang sudah dinonaktifkan tidak boleh absen lagi. Pesannya
    // dipisah dari "NIP atau PIN salah" karena di titik ini dia memang sudah
    // terbukti tahu PIN-nya sendiri — yang menghalangi bukan tebakan yang
    // salah, melainkan statusnya.
    if (!orang.aktif) {
      throw galat('Akun Anda sudah dinonaktifkan. Hubungi admin kantor.', 403, 'akun_nonaktif');
    }

    lupakanGagal(kunci);

    const foto = String(dataKirim?.foto ?? '');
    const bentukFoto = /^data:image\/(jpeg|png);base64,/.exec(foto);
    if (!bentukFoto) {
      throw galat('Foto wajib disertakan dan harus berupa JPEG atau PNG.', 422);
    }
    // Label MIME gampang dipalsukan, jadi periksa magic bytes-nya juga.
    // 12 byte pertama cukup untuk membedakan JPEG dan PNG.
    let kepala = '';
    try {
      kepala = atob(foto.slice(bentukFoto[0].length, bentukFoto[0].length + 16));
    } catch {
      kepala = '';
    }
    const kode = (i) => kepala.charCodeAt(i);
    const jpeg = kode(0) === 0xff && kode(1) === 0xd8 && kode(2) === 0xff;
    const png =
      kode(0) === 0x89 && kode(1) === 0x50 && kode(2) === 0x4e && kode(3) === 0x47;
    if (!jpeg && !png) {
      throw galat('Berkas foto tidak sah. Ambil ulang fotonya.', 422);
    }
    // Batas ukuran body/foto. Angka ini longgar untuk foto kamera yang sudah
    // diperkecil frontend, tapi tetap mencegah payload raksasa.
    if (foto.length > 3 * 1024 * 1024) {
      throw galat('Foto terlalu besar. Ambil ulang dengan resolusi lebih kecil.', 413);
    }

    // Di perusahaan atau di luar. Nilai asing dianggap "kantor": baris absen
    // lama tidak punya kolom ini sama sekali.
    const mode = dataKirim?.mode === 'luar' ? 'luar' : 'kantor';

    // Lokasi ditentukan perangkat kiosk, bukan oleh `lokasi_id` kiriman klien.
    // Klien hanya boleh meminta lokasi yang memang terikat ke perangkat itu.
    const kioskId = String(dataKirim?.kiosk_id ?? '').trim();
    const perangkat = toko.perangkat.find((p) => p.id === kioskId);
    if (!perangkat || perangkat.aktif === false) {
      throw galat(
        'Perangkat kiosk belum terdaftar atau sudah dinonaktifkan. Hubungi admin kantor.',
        403,
        'tidak_berhak',
      );
    }

    const diminta = Number(dataKirim?.lokasi_id);
    if (Number.isFinite(diminta) && diminta !== perangkat.lokasi_id) {
      throw galat(
        'Lokasi kiosk tidak cocok dengan perangkat ini. Muat ulang halaman kiosk.',
        403,
        'tidak_berhak',
      );
    }

    const lokasiId = perangkat.lokasi_id;
    const lokasiAbsen = toko.lokasi.find((l) => l.id === lokasiId) ?? null;

    // "Dinas luar" wajib membawa koordinat — itu satu-satunya isi dari pilihan
    // tersebut, dan admin perlu tahu di mana orangnya bertugas. Tanpa aturan
    // ini, "di luar" cuma tulisan tanpa keterangan.
    //
    // Jarak dihitung DI SINI, di sisi server, lalu DISIMPAN sebagai keterangan.
    // Jarak tidak dipakai menolak: orang yang sedang dinas luar memang jauh.
    // Frontend hanya mengirim titik mentah; `jarak_m` kiriman klien diabaikan.
    const koordinat = {
      lintang: null,
      bujur: null,
      akurasi: null,
      jarak_m: null,
      lokasi_teks: null,
    };
    let lokasiMeragukan = false;

    const angka = (nilai) =>
      nilai === null || nilai === undefined || nilai === '' ? NaN : Number(nilai);
    const lintang = angka(dataKirim?.lintang);
    const bujur = angka(dataKirim?.bujur);
    const akurasi = angka(dataKirim?.akurasi);
    const adaTitik = Number.isFinite(lintang) && Number.isFinite(bujur);

    if (mode === 'luar' && !adaTitik) {
      throw galat('Koordinat lokasi tidak sah. Ambil ulang lokasinya.', 422);
    }

    if (adaTitik) {
      if (Math.abs(lintang) > 90 || Math.abs(bujur) > 180) {
        throw galat('Koordinat lokasi tidak sah. Ambil ulang lokasinya.', 422);
      }

      koordinat.lintang = Number(lintang.toFixed(6));
      koordinat.bujur = Number(bujur.toFixed(6));

      if (mode === 'luar') {
        const putusan = periksaLokasiLuar({
          lokasi: lokasiAbsen,
          lintang: koordinat.lintang,
          bujur: koordinat.bujur,
          akurasi: Number.isFinite(akurasi) ? akurasi : null,
        });

        koordinat.akurasi = putusan.akurasi;
        koordinat.jarak_m = putusan.jarak_m;
        lokasiMeragukan = putusan.lokasi_meragukan;
      } else if (Number.isFinite(akurasi) && akurasi >= 0) {
        // Koordinat untuk mode "kantor" tidak wajib. Kalau kiosk tetap
        // mengirimnya, catat saja dan jangan tolak: PC tanpa GPS bisa
        // meleset ratusan meter. Yang menahan absen dari rumah adalah
        // pembatasan IP/Wi-Fi, bukan angka ini.
        koordinat.akurasi = Math.round(akurasi);
        if (
          lokasiAbsen &&
          Number.isFinite(lokasiAbsen.lintang) &&
          Number.isFinite(lokasiAbsen.bujur)
        ) {
          koordinat.jarak_m = Math.round(
            jarakMeter(koordinat.lintang, koordinat.bujur, lokasiAbsen.lintang, lokasiAbsen.bujur),
          );
        }
        lokasiMeragukan = akurasi > 50;
      }

      // Alamat manusiawi dari Nominatim. Kalau gagal, absen tetap jalan dan
      // admin masih melihat koordinat + tautan peta.
      koordinat.lokasi_teks = await geokodeTerbalik(koordinat.lintang, koordinat.bujur);
    }

    const tanggal = data.tanggalISO(data.hariIni);
    const catatanHariIni = toko.absen.filter(
      (a) => a.pengguna_id === orang.id && a.tanggal === tanggal,
    );

    if (catatanHariIni.some((a) => a.tipe === 'pulang')) {
      throw galat(`${orang.nama} sudah absen pulang hari ini.`, 409);
    }

    // Tipe ditentukan server, bukan dipilih magang. Magang tidak bisa salah
    // menekan "pulang" di pagi hari, dan tidak ada tombol untuk disalahgunakan.
    const tipe = catatanHariIni.some((a) => a.tipe === 'masuk') ? 'pulang' : 'masuk';

    // Keterlambatan dihitung SEKALI saat absen, lalu disimpan. Kalau dihitung
    // ulang tiap kali laporan dibuka, jadwal shift yang diubah besok akan
    // mengubah status telat kemarin — dan itu tidak bisa dipertanggungjawabkan.
    const giliran = toko.shift.find((s) => s.id === orang.shift_id);
    const sekarang = data.bagianJakarta();
    const menitSekarang = sekarang.jam * 60 + sekarang.menit;
    const batasTelat = giliran ? data.bacaJam(giliran.masuk) + giliran.toleransi_menit : 0;
    const telatMenit = tipe === 'masuk' && giliran ? Math.max(0, menitSekarang - batasTelat) : 0;

    const catatan = {
      id: toko.absen.reduce((n, a) => Math.max(n, a.id), 0) + 1,
      pengguna_id: orang.id,
      nip: orang.nip,
      nama: orang.nama,
      tipe,
      waktu: data.waktuISO(sekarang, sekarang.jam, sekarang.menit, sekarang.detik),
      tanggal,
      lokasi_id: lokasiId,
      mode,
      ...koordinat,
      lokasi_meragukan: lokasiMeragukan,
      shift_id: orang.shift_id,
      telat_menit: telatMenit,
      foto,
      // Jejak audit minimum. Backend asli membaca IP dari koneksi dan
      // user-agent dari header, bukan dari body kiriman klien.
      ip: IP_TIRUAN,
      user_agent: 'tiruan',
      kiosk_id: perangkat.id,
    };
    toko.absen.push(catatan);

    return {
      tipe: catatan.tipe,
      nama: catatan.nama,
      nip: catatan.nip,
      waktu: catatan.waktu,
      lokasi_id: catatan.lokasi_id,
      telat_menit: catatan.telat_menit,
      // Dikirim balik supaya layar kiosk bisa menenangkan magang: di mana
      // titiknya tercatat dan seberapa akurat angka itu. Angkanya tetap
      // dihitung server.
      mode: catatan.mode,
      jarak_m: catatan.jarak_m,
      akurasi: catatan.akurasi,
      lokasi_teks: catatan.lokasi_teks,
      lokasi_meragukan: catatan.lokasi_meragukan,
    };
  }

  // ── dashboard admin ──────────────────────────────────────────────────────

  if (metode === 'GET' && tanpaKueri === '/admin/dashboard') {
    await adminSaja(token);

    const tanggal = kueri.get('tanggal') || data.tanggalISO(data.hariIni);
    const libur = keteranganLibur(tanggal);

    // Magang yang bergabung setelah tanggal itu belum ikut dihitung —
    // kalau tidak, dashboard bulan lalu akan melaporkan puluhan "belum absen".
    const berlaku = toko.pengguna.filter((u) => u.aktif && u.masuk_kerja <= tanggal);

    const catatan = toko.absen.filter((a) => a.tanggal === tanggal);
    const masuk = catatan.filter((a) => a.tipe === 'masuk');

    const izinHariItu = toko.izin.filter(
      (z) => z.status === 'disetujui' && z.mulai <= tanggal && z.selesai >= tanggal,
    );

    const idMasuk = new Set(masuk.map((a) => a.pengguna_id));
    const idIzin = new Set(izinHariItu.map((z) => z.pengguna_id));

    // Siapa yang diharapkan absen hari ini — dan itu bukan semua orang.
    //
    // Akun admin tidak ikut dihitung: dia ada untuk mengurus aplikasinya, bukan
    // untuk diabsen. Sejak daftar bawaan dikosongkan, akun admin adalah
    // satu-satunya akun yang pasti ada, jadi kalau ikut dihitung, dashboard
    // setiap pagi melaporkan satu orang "belum absen" yang memang tidak akan
    // pernah absen — dan admin tidak punya cara menghilangkannya dari layar
    // mana pun.
    //
    // Pengecualiannya satu, dan itu yang membuat aturan ini bukan sekadar
    // "sembunyikan admin": admin yang ternyata tetap absen atau izin hari ini
    // tetap ikut terhitung, supaya orangnya tidak hilang dari angka.
    const diharapkan = berlaku.filter(
      (u) => u.peran === 'magang' || idMasuk.has(u.id) || idIzin.has(u.id),
    );

    const orangDari = (id) => berlaku.find((u) => u.id === id) ?? null;
    const namaShift = (id) => toko.shift.find((s) => s.id === id)?.nama ?? '—';
    const namaLokasi = (id) => toko.lokasi.find((l) => l.id === id)?.nama ?? null;

    const terlambat = masuk
      .filter((a) => a.telat_menit > 0)
      .sort((a, b) => b.telat_menit - a.telat_menit)
      .map((a) => ({
        id: a.pengguna_id,
        // Nama diambil dari data magang, bukan dari salinan di baris absen.
        // Salinan itu beku sejak jam absen, jadi orang yang baru diperbaiki
        // ejaan namanya akan tetap tampil dengan nama lama di dashboard.
        nama: orangDari(a.pengguna_id)?.nama ?? a.nama,
        nip: orangDari(a.pengguna_id)?.nip ?? a.nip,
        divisi: orangDari(a.pengguna_id)?.divisi ?? '—',
        shift: namaShift(a.shift_id),
        waktu: a.waktu,
        telat_menit: a.telat_menit,
        foto: a.foto,
      }));

    // Pada hari libur daftar ini dikosongkan dengan sengaja. Tidak ada yang
    // "belum absen" kalau memang tidak ada yang diharapkan masuk.
    const belumMasuk = libur
      ? []
      : diharapkan
          .filter((u) => !idMasuk.has(u.id) && !idIzin.has(u.id))
          .map((u) => ({
            id: u.id,
            nama: u.nama,
            nip: u.nip,
            divisi: u.divisi,
            shift: namaShift(u.shift_id),
          }));

    const daftarIzin = izinHariItu.map((z) => ({
      id: z.id,
      nama: z.nama,
      nip: z.nip,
      divisi: z.divisi,
      jenis: z.jenis,
      mulai: z.mulai,
      selesai: z.selesai,
      alasan: z.alasan,
    }));

    // Urut dari yang paling baru. Dibatasi enam karena tiap baris bisa membawa
    // foto, dan dashboard tidak perlu memuat seratus foto wajah.
    const aktivitas = [...catatan]
      .sort((a, b) => (a.waktu < b.waktu ? 1 : a.waktu > b.waktu ? -1 : 0))
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        nama: orangDari(a.pengguna_id)?.nama ?? a.nama,
        nip: orangDari(a.pengguna_id)?.nip ?? a.nip,
        tipe: a.tipe,
        waktu: a.waktu,
        foto: a.foto,
        // `lokasi` tetap label singkat untuk kompatibilitas; rincian di
        // bawahnya yang membuat admin tahu di mana orangnya sebenarnya.
        lokasi: a.mode === 'luar' ? 'Dinas luar' : namaLokasi(a.lokasi_id),
        lokasi_kantor: namaLokasi(a.lokasi_id),
        mode: a.mode ?? 'kantor',
        lintang: a.lintang ?? null,
        bujur: a.bujur ?? null,
        akurasi: a.akurasi ?? null,
        jarak_m: a.jarak_m ?? null,
        lokasi_teks: a.lokasi_teks ?? null,
        lokasi_meragukan: a.lokasi_meragukan ?? false,
      }));

    return {
      tanggal,
      hari_kerja: libur === null,
      keterangan_libur: libur,
      ringkasan: {
        total: diharapkan.length,
        sudah_masuk: idMasuk.size,
        belum_masuk: belumMasuk.length,
        izin: idIzin.size,
        telat: terlambat.length,
      },
      terlambat,
      belum_masuk: belumMasuk,
      izin: daftarIzin,
      aktivitas,
    };
  }

  // ── data master ──────────────────────────────────────────────────────────
  //
  // Empat layar data master memakai pola yang sama: daftar, tambah, ubah.
  //
  // Magang dan lokasi sengaja TIDAK punya endpoint hapus. Keduanya dirujuk
  // oleh baris absen yang sudah terjadi: menghapus "Gudang Cikarang" membuat
  // absen orang yang bekerja di sana kehilangan tempatnya, dan menghapus
  // magang membuat riwayat kehadirannya menggantung. Menutup lokasi atau
  // memberhentikan orang berarti menonaktifkannya.
  //
  // Hari libur dan shift boleh dihapus, tapi syaratnya berbeda. Hari libur
  // tidak dirujuk siapa pun — dia cuma penanda tanggal, dan tanggal yang salah
  // tulis justru harus bisa dibuang. Shift boleh dibuang selama belum ada yang
  // memakainya; begitu ada orang atau baris absen yang menunjuk ke sana,
  // menghapusnya meninggalkan lubang, dan yang berlaku adalah Nonaktifkan.

  if (metode === 'GET' && tanpaKueri === '/admin/magang') {
    await adminSaja(token);
    return {
      // Seluruh magang dikirim sekaligus, tanpa halaman dan tanpa penyaring.
      // Daftarnya masih puluhan dan penyaringan bisa dilakukan di browser
      // seketika. Kalau suatu saat jumlahnya ratusan, tambahkan ?cari= dan
      // ?halaman= di sini — bukan di layarnya.
      data: toko.pengguna.map((u) => ({
        ...tanpaRahasia(u),
        shift: toko.shift.find((s) => s.id === u.shift_id)?.nama ?? null,
        lokasi: toko.lokasi.find((l) => l.id === u.lokasi_id)?.nama ?? null,
      })),
      // Daftar divisi yang sah ikut dikirim, bukan ditulis ulang di layar.
      // Layar membangun pilihan formulirnya dari sini, jadi menambah divisi
      // keempat nanti tidak perlu menyentuh frontend sama sekali.
      divisi: data.DIVISI,
    };
  }

  if (metode === 'POST' && tanpaKueri === '/admin/magang') {
    const aku = await adminSaja(token);

    const baru = {
      id: idBaru(toko.pengguna),
      ...(await periksaMagang(dataKirim ?? {}, { baru: true })),
      aktif: true,
      // Diisi lewat halaman Profil Saya. Sampai itu ada, foto tetap kosong
      // dan dashboard menampilkan inisial.
      foto: null,
    };

    toko.pengguna.push(baru);
    catatAudit(aku, 'tambah_magang', { pengguna_id: baru.id, nip: baru.nip });
    return tanpaRahasia(baru);
  }

  const idMagang = JALUR_ID.magang.exec(tanpaKueri)?.[1];
  if (metode === 'PUT' && idMagang) {
    const aku = await adminSaja(token);
    const orang = toko.pengguna.find((u) => u.id === Number(idMagang));
    if (!orang) throw galat('Magang tidak ditemukan.', 404);

    const isian = dataKirim ?? {};

    // Dua penjagaan yang kedengarannya berlebihan sampai kejadian: admin
    // menurunkan perannya sendiri, atau menonaktifkan akunnya sendiri, lalu
    // terkunci di luar dan tidak ada admin lain yang bisa mengembalikannya.
    if (orang.id === aku.id && isian.peran && isian.peran !== 'admin') {
      throw galat('Anda tidak bisa menurunkan peran Anda sendiri. Minta admin lain yang melakukannya.', 422);
    }
    if (orang.id === aku.id && String(isian.aktif) === 'false') {
      throw galat('Anda tidak bisa menonaktifkan akun Anda sendiri.', 422);
    }

    // Isian digabung dengan baris yang sudah ada SEBELUM diperiksa.
    //
    // Endpoint ubah bersifat menambal: kolom yang tidak dikirim berarti
    // "biarkan seperti semula". Tanpa penggabungan ini, tombol Nonaktifkan
    // yang cuma mengirim { aktif: false } akan ditolak karena nama dan NIP
    // dianggap kosong — dan penonaktifan diam-diam tidak pernah terjadi.
    const gabung = { ...orang, ...isian };
    Object.assign(orang, await periksaMagang(gabung, { baru: false, idSendiri: orang.id }));

    // Menonaktifkan akun tidak menyentuh riwayat absennya sama sekali. Yang
    // berhenti adalah hak masuknya, bukan catatan kehadirannya selama bekerja.
    orang.aktif = String(gabung.aktif) !== 'false';

    catatAudit(aku, isian.pin ? 'reset_pin' : 'ubah_magang', {
      pengguna_id: orang.id,
      nip: orang.nip,
      aktif: orang.aktif,
    });
    return tanpaRahasia(orang);
  }

  if (metode === 'GET' && tanpaKueri === '/admin/lokasi') {
    await adminSaja(token);
    return {
      // Jumlah magang aktifnya ikut dikirim supaya admin tahu akibatnya
      // sebelum menutup sebuah lokasi.
      data: toko.lokasi.map((l) => ({
        ...l,
        jumlah_magang: toko.pengguna.filter((u) => u.aktif && u.lokasi_id === l.id).length,
      })),
    };
  }

  if (metode === 'POST' && tanpaKueri === '/admin/lokasi') {
    const aku = await adminSaja(token);
    const baru = { id: idBaru(toko.lokasi), ...periksaLokasi(dataKirim ?? {}) };
    toko.lokasi.push(baru);
    catatAudit(aku, 'tambah_lokasi', { lokasi_id: baru.id, nama: baru.nama });
    return baru;
  }

  const idLokasi = JALUR_ID.lokasi.exec(tanpaKueri)?.[1];
  if (metode === 'PUT' && idLokasi) {
    const aku = await adminSaja(token);
    const lokasi = toko.lokasi.find((l) => l.id === Number(idLokasi));
    if (!lokasi) throw galat('Lokasi tidak ditemukan.', 404);
    Object.assign(lokasi, periksaLokasi({ ...lokasi, ...(dataKirim ?? {}) }, { idSendiri: lokasi.id }));
    catatAudit(aku, 'ubah_lokasi', { lokasi_id: lokasi.id, nama: lokasi.nama });
    return lokasi;
  }

  if (metode === 'GET' && tanpaKueri === '/admin/shift') {
    await adminSaja(token);
    return {
      data: toko.shift.map((s) => ({
        ...s,
        jumlah_magang: toko.pengguna.filter((u) => u.aktif && u.shift_id === s.id).length,
      })),
    };
  }

  if (metode === 'POST' && tanpaKueri === '/admin/shift') {
    const aku = await adminSaja(token);
    const baru = { id: idBaru(toko.shift), ...periksaShift(dataKirim ?? {}) };
    toko.shift.push(baru);
    catatAudit(aku, 'tambah_shift', { shift_id: baru.id, nama: baru.nama });
    return baru;
  }

  const idShift = JALUR_ID.shift.exec(tanpaKueri)?.[1];
  if (metode === 'PUT' && idShift) {
    const aku = await adminSaja(token);
    const giliran = toko.shift.find((s) => s.id === Number(idShift));
    if (!giliran) throw galat('Shift tidak ditemukan.', 404);
    Object.assign(giliran, periksaShift({ ...giliran, ...(dataKirim ?? {}) }, { idSendiri: giliran.id }));
    catatAudit(aku, 'ubah_shift', { shift_id: giliran.id, nama: giliran.nama });
    return giliran;
  }

  if (metode === 'DELETE' && idShift) {
    await adminSaja(token);
    const i = toko.shift.findIndex((s) => s.id === Number(idShift));
    if (i < 0) throw galat('Shift tidak ditemukan.', 404);

    // Tiga penjagaan, semuanya demi hal yang sama: jangan sampai ada yang
    // menunjuk ke shift yang sudah tidak ada.
    //
    // Yang pertama menjaga aplikasinya sendiri. Formulir tambah magang wajib
    // memilih shift; kalau daftar shift sampai kosong, tidak ada orang baru
    // yang bisa dibuat dan tidak ada jalan kembali lewat layar.
    if (toko.shift.length <= 1) {
      throw galat(
        'Ini satu-satunya shift. Tanpa shift, tidak ada yang bisa dipilih saat menambah anak magang.',
        409,
      );
    }

    // Yang kedua dan ketiga menjaga datanya. Pesannya menyebut jumlah, karena
    // "tidak bisa dihapus" saja membuat admin menebak-nebak harus beresin apa
    // dulu — dan tebakan yang paling wajar adalah mengira aplikasinya rusak.
    const dipakai = toko.pengguna.filter((u) => u.shift_id === Number(idShift));
    if (dipakai.length) {
      throw galat(
        `Shift ini masih dipakai ${dipakai.length} orang. Pindahkan mereka ke shift lain dulu, atau nonaktifkan shift ini.`,
        409,
      );
    }

    const jejak = toko.absen.filter((a) => a.shift_id === Number(idShift)).length;
    if (jejak) {
      throw galat(
        `Shift ini dipakai ${jejak} catatan absen. Menghapusnya membuat riwayat itu kehilangan jam kerjanya — nonaktifkan saja.`,
        409,
      );
    }

    toko.shift.splice(i, 1);
    return { ok: true };
  }

  if (metode === 'GET' && tanpaKueri === '/admin/hari-libur') {
    await adminSaja(token);
    // Dikirim terurut. Daftar tanggal yang tidak berurut membuat admin harus
    // memindai seluruh baris untuk tahu hari libur berikutnya kapan.
    return { data: [...toko.hariLibur].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1)) };
  }

  if (metode === 'POST' && tanpaKueri === '/admin/hari-libur') {
    await adminSaja(token);
    const baru = { id: idBaru(toko.hariLibur), ...periksaLibur(dataKirim ?? {}) };
    toko.hariLibur.push(baru);
    return baru;
  }

  const idLibur = JALUR_ID['hari-libur'].exec(tanpaKueri)?.[1];
  if (metode === 'PUT' && idLibur) {
    await adminSaja(token);
    const libur = toko.hariLibur.find((h) => h.id === Number(idLibur));
    if (!libur) throw galat('Hari libur tidak ditemukan.', 404);
    Object.assign(libur, periksaLibur({ ...libur, ...(dataKirim ?? {}) }, { idSendiri: libur.id }));
    return libur;
  }

  if (metode === 'DELETE' && idLibur) {
    await adminSaja(token);
    const i = toko.hariLibur.findIndex((h) => h.id === Number(idLibur));
    if (i < 0) throw galat('Hari libur tidak ditemukan.', 404);
    toko.hariLibur.splice(i, 1);
    return { ok: true };
  }

  // ── pengajuan izin ────────────────────────────────────────────────────────
  //
  // Satu tabel untuk dua peran: magang mengajukan, admin memutuskan. Yang
  // berbeda cuma penyaringnya.
  //
  // Kata `jenis` di sini berisi 'cuti' | 'izin' | 'sakit'. Itu tiga hal yang
  // berbeda dan jangan disatukan jadi satu status: 'cuti' memotong jatah,
  // 'izin' dan 'sakit' tidak. Menyatukannya membuat sisa cuti tidak bisa
  // dipercaya, dan justru itu yang paling sering ditanyakan magang.

  if (metode === 'GET' && tanpaKueri === '/admin/izin') {
    await adminSaja(token);
    const minta = kueri.get('status') || 'menunggu';

    const semua = toko.izin.map((z) => {
      const orang = toko.pengguna.find((u) => u.id === z.pengguna_id);
      return {
        ...z,
        // Nama dan divisi diambil dari data magang, bukan dari salinan di
        // baris pengajuannya — aturan yang sama dengan dashboard: perbaikan
        // ejaan nama harus langsung terlihat di mana-mana.
        nama: orang?.nama ?? z.nama,
        nip: orang?.nip ?? z.nip,
        divisi: orang?.divisi ?? z.divisi,
        aktif: orang?.aktif ?? false,
        hari_kerja: hariKerjaAntara(z.mulai, z.selesai),
      };
    });

    return {
      data: semua
        .filter((z) => minta === 'semua' || z.status === minta)
        // Terbaru di atas. Admin membuka layar ini untuk memutuskan, bukan
        // untuk membaca arsip dari awal.
        .sort((a, b) => (a.diajukan < b.diajukan ? 1 : -1)),
      // Jumlah seluruh status, bukan cuma yang sedang ditampilkan: angka inilah
      // yang dipakai tab, dan tab yang menghitung sendiri dari daftar yang
      // sudah tersaring akan selalu menulis 0 untuk status yang tidak dibuka.
      jumlah: {
        menunggu: semua.filter((z) => z.status === 'menunggu').length,
        disetujui: semua.filter((z) => z.status === 'disetujui').length,
        ditolak: semua.filter((z) => z.status === 'ditolak').length,
        semua: semua.length,
      },
    };
  }

  const idPutusan = /^\/admin\/izin\/(\d+)\/(setujui|tolak)$/.exec(tanpaKueri);
  if (metode === 'POST' && idPutusan) {
    const aku = await adminSaja(token);

    const z = toko.izin.find((x) => x.id === Number(idPutusan[1]));
    if (!z) throw galat('Pengajuan tidak ditemukan.', 404);

    // Tanpa penjagaan ini, menekan Setujui dua kali akan mencatat keputusan
    // kedua di atas yang pertama, dan tidak ada cara tahu mana yang berlaku.
    if (z.status !== 'menunggu') {
      throw galat(
        `Pengajuan ini sudah ${z.status === 'disetujui' ? 'disetujui' : 'ditolak'} sebelumnya.`,
        409,
      );
    }

    const aksi = idPutusan[2];
    const catatan = String(dataKirim?.catatan ?? '').trim();

    if (aksi === 'tolak') {
      // Alasan penolakan wajib. Magang melihatnya di layar Izin & Cuti, dan
      // penolakan tanpa alasan akan ditanyakan ulang ke admin — atau, lebih
      // buruk, dianggap tidak pernah diajukan.
      if (catatan.length < 4) {
        throw galat('Alasan penolakan perlu diisi supaya magangnya tahu kenapa.', 422);
      }
      z.status = 'ditolak';
    } else {
      const hariKerja = hariKerjaRentang(z.mulai, z.selesai);
      if (hariKerja.length === 0) {
        throw galat('Rentang pengajuan ini tidak memuat hari kerja. Tidak ada yang perlu disetujui.', 422);
      }

      const lain = pengajuanBentrok(z.pengguna_id, z.mulai, z.selesai, z.id);
      if (lain && lain.status === 'disetujui') {
        throw galat('Sudah ada pengajuan lain yang disetujui pada tanggal yang sama.', 409);
      }

      // Jatah diperiksa lagi di sini, bukan cuma saat mengajukan. Bisa ada dua
      // pengajuan yang masing-masing muat, tapi jumlahnya melebihi jatah kalau
      // keduanya disetujui. Kalau pemeriksaannya cuma di sisi magang, yang
      // tahu masalahnya justru bukan yang bisa memutuskan.
      //
      // Jangan membandingkan `hariKerja.length` dengan `kuota.sisa`: `sisa`
      // sudah dipotong oleh pengajuan yang sedang akan disetujui ini. Yang
      // benar adalah total yang sudah disetujui + seluruh yang masih menunggu
      // (termasuk pengajuan ini) tidak boleh melebihi jatah.
      if (z.jenis === 'cuti') {
        const kuota = kuotaCuti(z.pengguna_id);
        const total = kuota.terpakai + kuota.menunggu;
        if (total > kuota.jatah) {
          throw galat(
            `Jatah cuti magang ini ${kuota.jatah} hari, sedangkan total cuti yang sudah disetujui dan masih menunggu menjadi ${total} hari (pengajuan ini ${hariKerja.length} hari).`,
            422,
          );
        }
      }

      z.status = 'disetujui';
    }

    z.catatan_admin = catatan || null;
    z.diputuskan = data.sekarangISO();
    catatAudit(aku, z.status === 'disetujui' ? 'setujui_izin' : 'tolak_izin', {
      izin_id: z.id,
      pengguna_id: z.pengguna_id,
      mulai: z.mulai,
      selesai: z.selesai,
    });
    return z;
  }

  if (metode === 'GET' && tanpaKueri === '/saya/izin') {
    const aku = await dariToken(token);
    if (!aku) throw galat('Sesi tidak ditemukan. Silakan masuk lagi.', 401, 'sesi_habis');
    if (!aku.aktif) throw galat('Akun Anda sudah dinonaktifkan.', 403, 'akun_nonaktif');

    return {
      data: toko.izin
        .filter((z) => z.pengguna_id === aku.id)
        .sort((a, b) => (a.diajukan < b.diajukan ? 1 : -1))
        .map((z) => ({ ...z, hari_kerja: hariKerjaAntara(z.mulai, z.selesai) })),
      kuota: kuotaCuti(aku.id),
    };
  }

  if (metode === 'POST' && tanpaKueri === '/saya/izin') {
    const aku = await dariToken(token);
    if (!aku) throw galat('Sesi tidak ditemukan. Silakan masuk lagi.', 401, 'sesi_habis');
    if (!aku.aktif) throw galat('Akun Anda sudah dinonaktifkan.', 403, 'akun_nonaktif');

    const isian = dataKirim ?? {};
    const jenis = ['cuti', 'izin', 'sakit'].includes(isian.jenis) ? isian.jenis : null;
    if (!jenis) throw galat('Jenis pengajuan belum dipilih.', 422);

    const tanggal = /^\d{4}-\d{2}-\d{2}$/;
    const mulai = String(isian.mulai ?? '').trim();
    const selesai = String(isian.selesai ?? '').trim();
    if (!tanggal.test(mulai) || !tanggal.test(selesai)) {
      throw galat('Tanggal mulai dan tanggal selesai belum diisi.', 422);
    }
    if (selesai < mulai) throw galat('Tanggal selesai tidak boleh sebelum tanggal mulai.', 422);

    // Yang diperiksa `selesai`, bukan `mulai`. Sakit biasanya baru dilaporkan
    // setelah sembuh, jadi pengajuan untuk kemarin dan hari ini harus tetap
    // bisa dibuat. Yang tidak masuk akal adalah pengajuan yang seluruhnya
    // sudah lewat.
    const hariIniStr = data.tanggalISO(data.hariIni);
    if (selesai < hariIniStr) {
      throw galat('Pengajuan untuk tanggal yang sudah lewat tidak bisa dibuat.', 422);
    }

    const alasan = String(isian.alasan ?? '').trim();
    if (alasan.length < 4) throw galat('Alasan belum diisi.', 422);

    const hariKerja = hariKerjaRentang(mulai, selesai);
    if (hariKerja.length === 0) {
      throw galat('Rentang itu tidak memuat hari kerja. Sabtu, Minggu, dan hari libur tidak dihitung.', 422);
    }

    // Hari yang sudah ada catatan absennya tidak bisa diajukan sebagai izin.
    //
    // Bukan sekadar kerapian. Laporan bulanan menghitung hari yang punya absen
    // masuk sebagai hadir, jadi cuti yang disetujui untuk hari itu akan
    // memotong jatah tanpa pernah muncul sebagai cuti di laporan mana pun.
    // Angka yang tidak bisa dipertemukan dengan catatannya akan ditanyakan
    // ulang oleh magangnya, dan tidak ada yang bisa menjawab.
    const sudahAbsen = hariKerja.filter((t) =>
      toko.absen.some((a) => a.pengguna_id === aku.id && a.tanggal === t),
    );
    if (sudahAbsen.length > 0) {
      throw galat(
        `Anda sudah punya catatan absen pada ${sudahAbsen.join(', ')}. Hari yang sudah Anda masuki tidak bisa diajukan sebagai izin atau cuti.`,
        409,
      );
    }

    const bentrok = pengajuanBentrok(aku.id, mulai, selesai);
    if (bentrok) {
      throw galat(
        `Sudah ada pengajuan ${bentrok.status === 'disetujui' ? 'yang disetujui' : 'yang masih menunggu'} pada tanggal itu.`,
        409,
      );
    }

    if (jenis === 'cuti') {
      const kuota = kuotaCuti(aku.id);
      if (hariKerja.length > kuota.sisa) {
        throw galat(
          `Sisa cuti Anda ${kuota.sisa} hari, sedangkan yang diajukan ${hariKerja.length} hari.`,
          422,
        );
      }
    }

    const baru = {
      id: toko.izin.reduce((n, z) => Math.max(n, z.id), 0) + 1,
      pengguna_id: aku.id,
      nip: aku.nip,
      nama: aku.nama,
      divisi: aku.divisi,
      jenis,
      mulai,
      selesai,
      alasan,
      status: 'menunggu',
      diajukan: data.sekarangISO(),
      catatan_admin: null,
      diputuskan: null,
    };

    toko.izin.push(baru);
    return { ...baru, hari_kerja: hariKerja.length };
  }

  // ── riwayat absen magang ────────────────────────────────────────────────

  if (metode === 'GET' && tanpaKueri === '/saya/absen') {
    const aku = await dariToken(token);
    if (!aku) throw galat('Sesi tidak ditemukan. Silakan masuk lagi.', 401, 'sesi_habis');
    if (!aku.aktif) throw galat('Akun Anda sudah dinonaktifkan.', 403, 'akun_nonaktif');

    const bulan = kueri.get('bulan') || data.tanggalISO(data.hariIni).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw galat('Bulan tidak dikenali.', 422);

    const hari = riwayatBulan(aku.id, bulan);
    const hitung = (status) => hari.filter((h) => h.status === status).length;
    const hadir = hitung('tepat') + hitung('telat');

    return {
      bulan,
      hari_kerja: hariKerjaBulan(bulan, aku.masuk_kerja),
      ringkasan: {
        hadir,
        tepat: hitung('tepat'),
        telat: hitung('telat'),
        telat_menit: hari.reduce((n, h) => n + h.telat_menit, 0),
        izin: hitung('izin') + hitung('cuti') + hitung('sakit'),
        alpha: hitung('alpha'),
      },
      data: hari,
    };
  }

  // ── keamanan akun sendiri ─────────────────────────────────────────────────
  //
  // Tidak ada lagi endpoint untuk mengganti PIN atau kata sandi sendiri.
  //
  // PIN sekarang dipegang admin: dia yang menyetelnya saat akun dibuat, dan
  // dia yang mereset kalau lupa. Membiarkan magang menggantinya sendiri tidak
  // menambah keamanan — orang yang cuma melihat PIN di kiosk tidak bisa
  // menggantinya, karena endpoint itu butuh login dulu — dan yang tersisa cuma
  // jalur "lupa PIN baru" yang ujungnya tetap ke meja admin.
  //
  // Kata sandi dihapus seluruhnya: masuk memakai NIP + PIN. Satu rahasia untuk
  // dua pintu, dan tidak ada kata sandi yang perlu dikarang admin tiap kali
  // membuat akun. PIN disetel lewat `POST /admin/magang` dan
  // `PUT /admin/magang/{id}`, bukan dari sini.

  // ── laporan bulanan ───────────────────────────────────────────────────────

  if (metode === 'GET' && tanpaKueri === '/admin/laporan') {
    await adminSaja(token);

    const bulan = kueri.get('bulan') || data.tanggalISO(data.hariIni).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw galat('Bulan tidak dikenali.', 422);

    const baris = rekapBulan(bulan);
    const jumlah = (kolom) => baris.reduce((n, r) => n + r[kolom], 0);

    return {
      bulan,
      hari_kerja: hariKerjaBulan(bulan),
      ringkasan: {
        magang: baris.length,
        hadir: jumlah('hadir'),
        telat: jumlah('telat'),
        telat_menit: jumlah('telat_menit'),
        izin: jumlah('izin') + jumlah('cuti') + jumlah('sakit'),
        alpha: jumlah('alpha'),
      },
      data: baris,
    };
  }

  if (metode === 'GET' && tanpaKueri === '/admin/laporan/harian') {
    await adminSaja(token);

    const bulan = kueri.get('bulan') || data.tanggalISO(data.hariIni).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) throw galat('Bulan tidak dikenali.', 422);

    const orang = toko.pengguna.find((u) => u.id === Number(kueri.get('pengguna_id')));
    if (!orang) throw galat('Magang tidak ditemukan.', 404);

    return { bulan, pengguna: tanpaRahasia(orang), data: riwayatBulan(orang.id, bulan) };
  }

  // ── profil sesi berjalan ─────────────────────────────────────────────────
  //
  // Dipanggil aplikasi setiap kali dibuka. Sesi tersimpan di localStorage
  // memuat salinan data pengguna, dan salinan itu bisa sudah tidak cocok lagi
  // dengan server — data diri diubah, atau akunnya dinonaktifkan. Tanpa
  // pemeriksaan ini, aplikasi akan terus menampilkan data lama.

  if (metode === 'GET' && tanpaKueri === '/saya/profil') {
    const aku = await dariToken(token);
    if (!aku) throw galat('Sesi sudah tidak berlaku. Silakan masuk lagi.', 401, 'sesi_habis');
    if (!aku.aktif) throw galat('Akun Anda sudah dinonaktifkan.', 403, 'akun_nonaktif');

    // Cukup baris pengguna, tanpa tambahan. Dulu di sini ada `shift`, `lokasi`,
    // dan `sisa_cuti` untuk layar Profil Saya — layar itu sudah dihapus, dan
    // sisa cuti dikirim sudah jadi lewat `GET /saya/izin`.
    return tanpaRahasia(aku);
  }

  // Sengaja gagal berisik: lebih baik ketahuan daripada diam-diam mengembalikan
  // data kosong dan tampilan terlihat "berhasil" padahal belum dibuat.
  throw galat(`Endpoint tiruan belum dibuat: ${metode} ${jalur}`, 404);
}

/**
 * Pintu masuk tunggal dari `api.js`.
 *
 * Setiap permintaan yang bukan `GET` mengubah isi toko, jadi setiap yang
 * berhasil disimpan. Permintaan `GET` tidak pernah mengubah apa pun dan tidak
 * perlu menulis ulang penyimpanan — dashboard yang menyegarkan sendiri akan
 * menulis localStorage tiap beberapa detik kalau tidak dibedakan.
 */
export async function tanggapi(metode, jalur, dataKirim, token) {
  // PIN lama dari simpanan versi sebelumnya diubah menjadi hash sebelum
  // endpoint mana pun membacanya.
  await pastikanPin();
  const hasil = await tanggapiAsli(metode, jalur, dataKirim, token);
  if (String(metode).toUpperCase() !== 'GET') simpan();
  return hasil;
}
