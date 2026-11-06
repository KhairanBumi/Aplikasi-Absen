// Splash boot sengaja tidak memakai Motion: elemennya harus sudah terlihat
// sebelum CSS aplikasi dan modul rute selesai dimuat. Berkas ini hanya
// memutuskan kapan splash boleh pergi.
const ID_SPLASH = 'pemuat-awal';
// Rangkaian berakhir di 2.000 ms; 500 ms berikutnya untuk melihat lockup
// yang sudah utuh sebelum splash memudar.
const MIN_TAMPIL = 2500;
const DURASI_KELUAR = 250;
const BATAS_LAMBAT = 10_000;

let status = typeof document === 'undefined' || !document.getElementById(ID_SPLASH)
  ? 'selesai'
  : 'tampil';
let janjiSelesai = null;
let timerLambat = null;

function splash() {
  return document.getElementById(ID_SPLASH);
}

function hentikanTimer() {
  if (timerLambat === null) return;
  clearTimeout(timerLambat);
  timerLambat = null;
}

function bukaKunciGulir() {
  document.documentElement.classList.remove('pemuat-aktif');
}

function mulaiTimerLambat() {
  if (status !== 'tampil' || timerLambat !== null) return;

  timerLambat = setTimeout(() => {
    timerLambat = null;
    if (status !== 'tampil') return;

    const petunjuk = document.querySelector('.pemuat-lambat');
    if (petunjuk) petunjuk.hidden = false;
  }, BATAS_LAMBAT);
}

export function selesaikanPemuat() {
  if (janjiSelesai) return janjiSelesai;

  const elemen = splash();
  if (!elemen) {
    status = 'selesai';
    bukaKunciGulir();
    return Promise.resolve();
  }

  status = 'selesai';
  hentikanTimer();

  janjiSelesai = (async () => {
    // performance.now() dihitung dari awal navigasi, jadi splash yang sudah
    // tampil lebih lama tidak perlu ditahan lagi.
    const sisa = Math.max(0, MIN_TAMPIL - performance.now());
    if (sisa > 0) await new Promise((tunggu) => setTimeout(tunggu, sisa));

    if (status !== 'selesai') return;

    elemen.classList.add('pemuat-selesai');
    const redam =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise((tunggu) => setTimeout(tunggu, redam ? 0 : DURASI_KELUAR));

    if (status !== 'selesai') return;

    elemen.remove();
    bukaKunciGulir();
  })();

  return janjiSelesai;
}

export function gagalPemuat() {
  const elemen = splash();
  if (!elemen) return;

  status = 'gagal';
  hentikanTimer();
  elemen.classList.add('pemuat-gagal');

  const blok = elemen.querySelector('.pemuat-galat');
  if (blok) blok.hidden = false;

  const ulang = elemen.querySelector('[data-pemuat-ulang]');
  if (ulang) requestAnimationFrame(() => ulang.focus({ preventScroll: true }));
}

if (typeof document !== 'undefined') {
  document
    .querySelector('[data-pemuat-ulang]')
    ?.addEventListener('click', () => location.reload());
  mulaiTimerLambat();
}
