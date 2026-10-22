import './style.css';
import { pengguna, segarkanSesi } from './api.js';
import { pasangLatar } from './latar.js';
import { semuaButir } from './menu.js';

// Latar Feral dipasang lebih dulu supaya kaca di layar pertama sudah punya
// sesuatu untuk dibiaskan sejak frame pertama.
pasangLatar();

// Layar yang punya berkas sendiri. Menu yang belum punya layar memakai berkas
// bersama `segera.js`, jadi tidak ada tautan menu yang menabrak.
const MUAT = {
  '#/masuk': () => import('./views/masuk.js'),
  '#/beranda': () => import('./views/beranda.js'),
  '#/absen': () => import('./views/absen.js'),
  '#/izin-masuk': () => import('./views/izin-masuk.js'),
  '#/izin': () => import('./views/izin.js'),
  '#/riwayat': () => import('./views/riwayat.js'),
  '#/laporan': () => import('./views/laporan.js'),
  '#/magang': () => import('./views/magang.js'),
  '#/lokasi': () => import('./views/lokasi.js'),
  '#/shift': () => import('./views/shift.js'),
  '#/hari-libur': () => import('./views/hari-libur.js'),
};

// Rute dan hak akses diturunkan dari daftar menu — satu sumber saja, supaya
// daftar rute dan isi sidebar tidak mungkin saling melenceng.
const rute = new Map([['#/masuk', MUAT['#/masuk']]]);
const peran = new Map();

for (const b of semuaButir()) {
  rute.set(b.jalur, MUAT[b.jalur] ?? (() => import('./views/segera.js')));
  // `publik` berarti rutenya tidak butuh sesi sama sekali. Kiosk memakainya:
  // PC kiosk tidak boleh menyimpan token admin di localStorage-nya.
  if (!b.publik) peran.set(b.jalur, b.peran ?? ['admin', 'magang']);
}

const AKAR = document.getElementById('akar');
let bersihkan = null;
let urutan = 0;

/**
 * Halaman pertama setelah masuk.
 *
 * Bukan satu alamat untuk semua orang: anak magang tidak punya beranda sama
 * sekali — isinya cuma rekap absennya sendiri dan pengajuan izin, dan keduanya
 * sudah punya layar. Mendaratkannya di beranda berarti satu lompatan tambahan
 * ke layar yang memang bukan untuk dia.
 */
function berandaUntuk() {
  const aku = pengguna();
  if (!aku) return '#/masuk';
  return aku.peran === 'admin' ? '#/beranda' : '#/riwayat';
}

async function buka() {
  const saya = ++urutan;

  let jalur = location.hash.split('?')[0];
  if (!rute.has(jalur)) {
    jalur = berandaUntuk();
    history.replaceState(null, '', jalur); // replaceState tidak memicu hashchange, jadi tidak ada lompatan
  }

  const view = (await rute.get(jalur)()).default;

  // Kalau pengguna menekan tombol lain sebelum layar ini selesai dimuat,
  // biarkan permintaan yang lebih baru yang menang.
  if (saya !== urutan) return;

  const perlu = peran.get(jalur); // rute yang tidak terdaftar berarti publik
  const aktif = pengguna();

  if (perlu && !(aktif && perlu.includes(aktif.peran))) {
    // Sudah masuk tapi membuka menu milik peran lain: antar ke halaman
    // pertamanya sendiri, bukan ke layar masuk. Melempar orang yang sudah
    // masuk ke sana cuma membuat dia melihat formulir yang akan langsung
    // dialihkan lagi.
    location.replace(berandaUntuk());
    return;
  }

  // Sudah masuk tapi membuka halaman masuk: tidak ada gunanya, langsung antar.
  // Sengaja hanya `#/masuk`. Dulu aturannya "semua rute publik", dan itu
  // melempar admin keluar dari layar kiosk.
  if (jalur === '#/masuk' && aktif) {
    location.replace(berandaUntuk());
    return;
  }

  bersihkan?.();
  bersihkan = null;

  document.title = view.judul ? `${view.judul} — Aplikasi Absen` : 'Aplikasi Absen';
  AKAR.replaceChildren();
  bersihkan = view.mount(AKAR) ?? null;
}

addEventListener('hashchange', buka);

// Sesi yang tersimpan bisa sudah tidak cocok dengan server — data diri diubah,
// atau akunnya dinonaktifkan. Diperiksa dulu sebelum layar pertama dipasang,
// supaya yang tampil bukan salinan basi dari localStorage.
(async () => {
  try {
    await segarkanSesi();
  } catch {
    // Kegagalan jaringan bukan alasan mengeluarkan orang dari aplikasinya, dan
    // juga bukan alasan berhenti di layar kosong. api.js yang memutuskan kapan
    // sesi dihapus; sisa galat di sini cukup diabaikan.
  }
  buka();
})();
