// Latar aplikasi: gradasi Feral dari gradient.json.
//
// Resepnya sama dengan ekspor gradient.js — mode AIR, empat stop, pembagi
// 0.25/0.5/0.75, grain 33. Kanvas dipakai, bukan CSS gradient, karena ekspor
// aslinya juga kanvas: warna dan butirnya jadi persis, bukan mirip.
import resep from '../gradient.json';

// Titik pusat orb (persen) dan radiusnya, dari mode AIR di gradient.js.
// PUSAT adalah `mesh` pada resep ekspor; urutannya mengikuti urutan stop.
// Orb terakhir digambar paling bawah.
const PUSAT = [
  [29.4974, 78.3189],
  [77.2604, 18.3331],
  [63.285, 78.0255],
  [24, 16],
];
const RADIUS = [
  [72, 58],
  [56, 72],
  [78, 62],
  [50, 44],
];

const WARNA = resep.stops.map((s) => s.hex);
const PEMBAGI = resep.dividers;
const BLUR = 64; // fieldBlur di ekspor gradient.js
const GRAIN = Math.max(0, Math.min(100, resep.noise)) / 100 * 0.5;

let kanvas = null;
let konteks = null;
let antre = 0;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

// Lebar orb tidak seragam: stop yang ruangnya lebih lebar di resep juga
// mendapat orb yang lebih besar. Rumusnya dari gradient.js (Zt + Ds).
function skalaStop(i) {
  const batas = [0, ...PEMBAGI, 1];
  const bagian = (batas[i + 1] - batas[i]) * WARNA.length;
  return Math.min(1.45, Math.max(0.55, Math.sqrt(bagian)));
}

function gambar() {
  // Ukur wadahnya, bukan kanvas: kanvas punya transform 1.32, dan
  // getBoundingClientRect ikut menghitung transform itu.
  const kotak = kanvas.parentElement.getBoundingClientRect();
  const lebar = Math.max(1, Math.round(kotak.width));
  const tinggi = Math.max(1, Math.round(kotak.height));
  const skala = Math.min(1, 2048 / Math.max(lebar, tinggi));

  kanvas.width = Math.round(lebar * skala);
  kanvas.height = Math.round(tinggi * skala);
  konteks.clearRect(0, 0, kanvas.width, kanvas.height);

  // Dasar: stop pertama. Di resep ini dialah yang paling terang, jadi sama
  // dengan Ps() di gradient.js yang memilih stop berluminansi tertinggi.
  konteks.fillStyle = WARNA[0];
  konteks.fillRect(0, 0, kanvas.width, kanvas.height);

  WARNA.map((warna, i) => [warna, i])
    .reverse()
    .forEach(([warna, i]) => {
      const [cx, cy] = PUSAT[i % PUSAT.length];
      const [rx, ry] = RADIUS[i % RADIUS.length];
      const b = skalaStop(i);
      const radiusX = (rx * b) / 100 * kanvas.width;
      const radiusY = (ry * b) / 100 * kanvas.height;
      const [r, g, b2] = rgb(warna);

      konteks.save();
      konteks.translate((cx / 100) * kanvas.width, (cy / 100) * kanvas.height);
      konteks.scale(1, radiusY / radiusX);

      const gradasi = konteks.createRadialGradient(0, 0, 0, 0, 0, radiusX);
      gradasi.addColorStop(0, `rgba(${r},${g},${b2},1)`);
      gradasi.addColorStop(0.22, `rgba(${r},${g},${b2},1)`);
      gradasi.addColorStop(0.72, `rgba(${r},${g},${b2},0)`);
      gradasi.addColorStop(1, `rgba(${r},${g},${b2},0)`);
      konteks.fillStyle = gradasi;
      konteks.fillRect(
        -(cx / 100) * kanvas.width,
        -(cy / 100) * kanvas.height * (radiusX / radiusY),
        kanvas.width,
        kanvas.height * (radiusX / radiusY),
      );
      konteks.restore();
    });
}

// Butir film 256px, sama seperti grain di gradient.js: rata-rata dua acak
// supaya sebarannya tidak terlalu ekstrem.
function butir() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const data = ctx.createImageData(256, 256);
  const d = data.data;

  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round((Math.random() + Math.random()) / 2 * 255);
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }

  ctx.putImageData(data, 0, 0);
  return c.toDataURL();
}

function jadwal() {
  if (antre) return;
  antre = requestAnimationFrame(() => {
    antre = 0;
    gambar();
  });
}

export function pasangLatar() {
  const wadah = document.createElement('div');
  wadah.className = 'latar-feral';
  wadah.setAttribute('aria-hidden', 'true');

  kanvas = document.createElement('canvas');
  konteks = kanvas.getContext('2d');
  kanvas.style.filter = `blur(${BLUR}px)`;

  const lapisButir = document.createElement('div');
  lapisButir.className = 'latar-butir';
  lapisButir.style.backgroundImage = `url(${butir()})`;
  lapisButir.style.opacity = GRAIN;

  wadah.append(kanvas, lapisButir);
  document.body.prepend(wadah);

  gambar();
  addEventListener('resize', jadwal);
}
