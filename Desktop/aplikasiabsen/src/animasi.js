// Animasi gerak memakai Motion (vanilla). Aturannya satu: gerak hanya boleh
// memperjelas perubahan, bukan menahan orang menunggu. Karena itu durasinya
// pendek, dan semua animasi dimatikan saat sistem meminta gerak dikurangi.
//
// Semua kontrol animasi yang dibuat lewat `panggung()` dikumpulkan supaya bisa
// dihentikan saat layar ditinggalkan. Animasi yang masih berjalan di elemen
// yang sudah dilepas memang tidak terlihat, tapi tetap memegang referensi.

import { animate } from 'motion';

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
    /** Muncul berurutan untuk sederet elemen, dibatasi agar daftar panjang
     *  tidak membuat baris terakhir baru muncul setelah beberapa detik. */
    beruntun(elemen, { jarak = 0.05, maks = 10, ...opsi } = {}) {
      const daftar = [...elemen].slice(0, maks);
      daftar.forEach((el, i) => {
        muncul(el, { ...opsi, delay: (opsi.delay ?? 0) + i * jarak });
      });
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
  // Kontrol lama harus berhenti walau pengguna meminta gerak dikurangi;
  // kalau tidak, animasi rute sebelumnya bisa menahan elemen yang sudah lepas.
  kontrolHalaman?.stop();
  kontrolHalaman = null;

  if (!akar || kurangiGerak()) return;

  const isi = akar.querySelector('[data-isi]') ?? akar.firstElementChild;
  if (!isi) return;

  kontrolHalaman = animate(
    isi,
    { opacity: [0, 1], y: [10, 0] },
    { duration: 0.3, ease: EASE },
  );
}

/**
 * Animasi muncul saat elemen masuk viewport.
 *
 * MutationObserver dipakai karena hampir semua layar menggambar ulang isinya
 * setelah data datang. Dengan begitu kartu yang baru dibuat tetap ikut
 * diamati tanpa setiap layar harus memanggil animasi sendiri.
 */
export function pengamatMuncul(akar) {
  if (!akar || kurangiGerak()) return () => {};

  const sudah = new WeakSet();
  const kontrol = new Set();
  let aktif = true;

  const pengamat = new IntersectionObserver(
    (entri) => {
      for (const entriIni of entri) {
        if (!entriIni.isIntersecting) continue;
        pengamat.unobserve(entriIni.target);

        const el = entriIni.target;
        if (!aktif || !el.isConnected) continue;

        const urut = Number(el.dataset.munculUrut ?? 0);
        const animasi = animate(
          el,
          { opacity: [0, 1], y: [18, 0] },
          { duration: 0.52, delay: Math.min(0.2, urut * 0.035), ease: EASE },
        );
        kontrol.add(animasi);
        animasi.finished
          .then(() => kontrol.delete(animasi))
          .catch(() => kontrol.delete(animasi));
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );

  function amati() {
    if (!aktif) return;

    akar.querySelectorAll('.kaca-kartu, .kaca-lembut, [data-muncul]').forEach((el, i) => {
      if (sudah.has(el) || el.closest('[data-animasi-manual], [data-menu]')) return;
      // Jangan menyembunyikan elemen yang sedang tidak ditampilkan; IO tidak
      // akan pernah memanggilnya sampai media query berubah.
      if (!el.getClientRects().length) return;

      sudah.add(el);
      el.dataset.munculUrut = String(i % 6);
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      pengamat.observe(el);
    });
  }

  const mutasi = new MutationObserver(amati);
  mutasi.observe(akar, { childList: true, subtree: true });
  amati();

  return () => {
    aktif = false;
    pengamat.disconnect();
    mutasi.disconnect();
    for (const animasi of kontrol) animasi.stop();
    kontrol.clear();
    // Elemen yang belum sempat masuk viewport tidak boleh tertinggal transparan.
    akar.querySelectorAll('.kaca-kartu, .kaca-lembut, [data-muncul]').forEach((el) => {
      if (el.style.opacity === '0') {
        el.style.opacity = '';
        el.style.transform = '';
      }
    });
  };
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
