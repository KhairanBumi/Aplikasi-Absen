// Animasi gerak memakai Motion (vanilla). Aturannya satu: gerak hanya boleh
// memperjelas perubahan, bukan menahan orang menunggu. Karena itu durasinya
// pendek, dan semua animasi dimatikan saat sistem meminta gerak dikurangi.
//
// Semua kontrol animasi yang dibuat lewat `panggung()` dikumpulkan supaya bisa
// dihentikan saat layar ditinggalkan. Animasi yang masih berjalan di elemen
// yang sudah dilepas memang tidak terlihat, tapi tetap memegang referensi.

import { animate, stagger } from 'motion';

const EASE = [0.22, 1, 0.36, 1]; // sama dengan --ease-apple di style.css

export function kurangiGerak() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Panggung animasi milik satu layar. `berhenti()` wajib dipanggil di cleanup
 * layar; tanpa itu animasi yang belum selesai terus hidup setelah elemennya
 * dilepas.
 */
export function panggung() {
  const berjalan = new Set();

  function muncul(elemen, { y = 12, x = 0, scale = 1, delay = 0, durasi = 0.5 } = {}) {
    if (!elemen || kurangiGerak()) return null;

    const kontrol = animate(
      elemen,
      { opacity: [0, 1], x: [x, 0], y: [y, 0], scale: [scale, 1] },
      { duration: durasi, delay, ease: EASE },
    );

    berjalan.add(kontrol);
    kontrol.finished
      .then(() => berjalan.delete(kontrol))
      .catch(() => berjalan.delete(kontrol));

    return kontrol;
  }

  /** Angka naik dari 0 ke `nilai`; teks akhir tetap persis `nilai`. */
  function hitung(elemen, nilai, { durasi = 0.8, delay = 0 } = {}) {
    if (!elemen || !Number.isFinite(nilai)) return null;
    if (kurangiGerak()) {
      elemen.textContent = String(nilai);
      return null;
    }

    const kontrol = animate(0, nilai, {
      duration: durasi,
      delay,
      ease: EASE,
      onUpdate: (v) => {
        elemen.textContent = String(Math.round(v));
      },
    });

    berjalan.add(kontrol);
    kontrol.finished
      .then(() => berjalan.delete(kontrol))
      .catch(() => berjalan.delete(kontrol));

    return kontrol;
  }

  return {
    muncul,
    hitung,
    /** Muncul berurutan untuk sederet elemen. */
    beruntun(elemen, { jarak = 0.06, ...opsi } = {}) {
      return muncul(elemen, { ...opsi, delay: stagger(jarak, { startDelay: opsi.delay ?? 0 }) });
    },
    berhenti() {
      for (const kontrol of berjalan) kontrol.stop();
      berjalan.clear();
    },
  };
}

// Transisi antar-layar. Satu kontrol saja karena hanya satu layar yang aktif.
let kontrolHalaman = null;

export function animasiHalaman(akar) {
  if (!akar || kurangiGerak()) return;

  kontrolHalaman?.stop();
  const isi = akar.querySelector('[data-isi]') ?? akar.firstElementChild;
  if (!isi) return;

  kontrolHalaman = animate(
    isi,
    { opacity: [0, 1], y: [8, 0] },
    { duration: 0.34, ease: EASE },
  );
}

/** Animasi sekali pakai untuk elemen yang tidak perlu dilacak. */
export function pop(elemen, { scale = 1.06, durasi = 0.45 } = {}) {
  if (!elemen || kurangiGerak()) return null;
  return animate(
    elemen,
    { opacity: [0, 1], scale: [scale, 1] },
    { duration: durasi, ease: EASE },
  );
}

/** Menggambar garis SVG dari kosong ke penuh — dipakai ikon hasil kiosk. */
export function coretJalur(jalur, { durasi = 0.45, delay = 0.1 } = {}) {
  if (!jalur || kurangiGerak()) return null;
  return animate(
    jalur,
    { pathLength: [0, 1], opacity: [0, 1] },
    { duration: durasi, delay, ease: EASE },
  );
}
