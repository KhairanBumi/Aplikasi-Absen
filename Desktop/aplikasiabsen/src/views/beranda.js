// Beranda admin: berapa yang sudah absen hari ini, siapa yang telat, siapa
// yang belum, dan aktivitas terbaru.
//
// Hanya admin. Anak magang tidak punya beranda sama sekali — layar pertamanya
// Riwayat Absen, yang sudah memuat rekap bulanannya sendiri. Dulu berkas ini
// punya cabang `dashboardMagang()`; cabang itu dihapus bersama
// `GET /saya/ringkasan` yang cuma dipakai di sana.
//
// Bentuk balasan `GET /admin/dashboard` ada di KONTRAK-API.md.

import { api, pengguna, MODE_TIRUAN } from '../api.js';
import { esc, jam, tanggalPanjang, jamBerjalan, inisial } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, TOMBOL_NAV, kartuAngka } from '../tabel.js';

const IKON_KIRI = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M14.5 6.5 9 12l5.5 5.5" />
  </svg>`;

const IKON_KANAN = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M9.5 6.5 15 12l-5.5 5.5" />
  </svg>`;

const IKON_BENAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round" class="size-7" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>`;

/** Sapaan menurut jam kantor, bukan jam perangkat. */
function sapaan() {
  const jamKini = Number(
    new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }),
  );
  if (jamKini < 11) return 'Selamat pagi';
  if (jamKini < 15) return 'Selamat siang';
  if (jamKini < 19) return 'Selamat sore';
  return 'Selamat malam';
}

/** Foto kalau ada, inisial kalau tidak. Riwayat yang dibangkitkan tidak berfoto. */
function avatar(nama, foto, kelas = 'size-9') {
  if (foto) {
    return `<img src="${esc(foto)}" alt=""
                 class="block ${kelas} shrink-0 rounded-full object-cover ring-1 ring-ink/8" />`;
  }
  return `<span class="grid ${kelas} shrink-0 place-items-center rounded-full bg-merek/10
                       text-xs font-semibold text-merek">${esc(inisial(nama))}</span>`;
}

function gantiHari(tanggal, n) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari dari hari ini, untuk label "Hari ini" / "Kemarin" / "3 hari lalu". */
function labelHari(tanggal, hariIni) {
  const beda = Math.round(
    (Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${tanggal}T00:00:00Z`)) / 86400000,
  );
  if (beda === 0) return 'Hari ini';
  if (beda === 1) return 'Kemarin';
  if (beda > 1) return `${beda} hari lalu`;
  if (beda === -1) return 'Besok';
  return `${Math.abs(beda)} hari lagi`;
}

function barisKosong(teks) {
  return `
    <p class="flex items-center gap-2.5 rounded-2xl bg-white/55 px-4 py-3.5 text-sm text-muted
              ring-1 ring-ink/8">
      <span class="text-emerald-600">${IKON_BENAR}</span>
      ${esc(teks)}
    </p>`;
}

/**
 * Pesan untuk daftar "belum absen" yang kosong.
 *
 * Tiga keadaan berbeda, dan yang ketiga mudah terlewat: daftar yang kosong
 * karena memang belum ada anak magang sama sekali bukan kabar baik. Sejak data
 * bawaan dikosongkan, itu justru tampilan pertama yang dilihat admin — dan
 * "semua anak magang sudah absen" di atas daftar yang belum pernah diisi bukan
 * cuma membingungkan, tapi membuat dia mengira pekerjaannya sudah selesai.
 */
function pesanBelumAbsen(libur, total) {
  if (libur) return 'Hari libur.';
  if (total === 0) return 'Belum ada anak magang. Tambahkan lewat menu Data Master.';
  return 'Semua anak magang sudah absen.';
}

// ── Admin ───────────────────────────────────────────────────────────────────

function dashboardAdmin(isi, p) {
  const hariIni = new Date().toISOString().slice(0, 10);
  let aktif = hariIni;
  let hidup = true;

  isi.innerHTML = `
    <section class="relative overflow-hidden rounded-[1.75rem] bg-merek p-6 shadow-naik-besar
                    ring-1 ring-white/20 ring-inset sm:p-8">
      <div class="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full bg-white/15 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-fuchsia-300/25 blur-3xl"></div>

      <div class="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div class="min-w-0">
          <p class="text-sm font-medium text-white/90">${esc(sapaan())}</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            ${esc(p.nama)}
          </h2>
          <p class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
            <span>${esc(p.divisi || p.peran)}</span>
            <span aria-hidden="true" class="text-white/45">·</span>
            <span class="font-mono">${esc(p.nip)}</span>
          </p>
        </div>

        <div class="shrink-0">
          <p data-jam class="angka-rata text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            --.--.--
          </p>
          <p data-tanggal class="mt-1.5 text-xs text-white/90">—</p>
        </div>
      </div>
    </section>

    <div class="${KARTU} mt-6 flex items-center justify-between gap-3 p-2.5">
      <button type="button" data-mundur class="${TOMBOL_NAV}" aria-label="Hari sebelumnya">
        ${IKON_KIRI}
      </button>

      <div class="min-w-0 text-center">
        <p data-judul-tanggal class="truncate text-sm font-medium text-ink">—</p>
        <p data-label-tanggal class="text-xs text-muted">—</p>
      </div>

      <button type="button" data-maju class="${TOMBOL_NAV}" aria-label="Hari berikutnya">
        ${IKON_KANAN}
      </button>
    </div>

    <div data-isi-dashboard class="mt-6">
      <p class="py-16 text-center text-sm text-muted">Memuat data kehadiran…</p>
    </div>`;

  const kotak = isi.querySelector('[data-isi-dashboard]');
  const elJudul = isi.querySelector('[data-judul-tanggal]');
  const elLabel = isi.querySelector('[data-label-tanggal]');
  const tombolMaju = isi.querySelector('[data-maju]');

  async function muat(tanggal) {
    aktif = tanggal;
    elJudul.textContent = tanggalPanjang(`${tanggal}T00:00:00+07:00`);
    elLabel.textContent = labelHari(tanggal, hariIni);
    tombolMaju.disabled = tanggal >= hariIni;

    kotak.innerHTML = `<p class="py-16 text-center text-sm text-muted">Memuat data kehadiran…</p>`;

    let d;
    try {
      d = await api.get(`/admin/dashboard?tanggal=${encodeURIComponent(tanggal)}`);
    } catch (galat) {
      if (!hidup) return;
      kotak.innerHTML = `
        <div class="${KARTU}">
          <p class="font-medium text-ink">Data kehadiran tidak bisa dimuat</p>
          <p class="mt-1.5 text-sm text-muted">${esc(galat.message)}</p>
        </div>`;
      return;
    }

    // Pengguna sudah berpindah tanggal lain selagi menunggu jawaban.
    if (!hidup || aktif !== tanggal) return;

    const r = d.ringkasan;
    const libur = d.keterangan_libur;

    kotak.innerHTML = `
      ${
        libur
          ? `<p class="mb-4 flex items-center gap-2.5 rounded-2xl bg-sky-500/10 px-4 py-3.5 text-sm
                     text-ink ring-1 ring-sky-500/20">
               <span class="font-medium">${esc(libur)}.</span>
               <span class="text-muted">Tidak ada absensi yang diharapkan hari ini.</span>
             </p>`
          : ''
      }

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        ${kartuAngka('Sudah absen', String(r.sudah_masuk), `dari ${r.total} anak magang`)}
        ${kartuAngka(
          'Belum absen',
          libur ? '—' : String(r.belum_masuk),
          libur ? 'hari libur' : 'tanpa catatan absen',
          libur ? 'text-faint' : r.belum_masuk > 0 ? 'text-amber-600' : 'text-ink',
        )}
        ${kartuAngka('Izin & cuti', String(r.izin), 'sudah disetujui', 'text-sky-600')}
        ${kartuAngka(
          'Terlambat',
          String(r.telat),
          r.telat > 0 ? 'dari yang sudah absen' : 'semua tepat waktu',
          r.telat > 0 ? 'text-rose-600' : 'text-ink',
        )}
      </div>

      <div class="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <section class="${KARTU}">
          <h3 class="text-lg font-semibold tracking-tight text-ink">Terlambat</h3>
          <p class="mt-1 text-sm text-muted">Diurutkan dari yang paling lama.</p>
          <div class="mt-4">
            ${
              d.terlambat.length === 0
                ? barisKosong(libur ? 'Hari libur.' : 'Tidak ada yang terlambat hari ini.')
                : `<ul class="divide-y divide-ink/8">
                     ${d.terlambat
                       .map(
                         (o) => `
                       <li class="flex items-center gap-3.5 py-3">
                         ${avatar(o.nama, o.foto)}
                         <span class="min-w-0 flex-1">
                           <span class="block truncate text-sm font-medium text-ink">${esc(o.nama)}</span>
                           <span class="block truncate text-xs text-muted">${esc(o.divisi)} · ${esc(o.shift)}</span>
                         </span>
                         <span class="shrink-0 text-right">
                           <span class="angka-rata block text-sm font-medium text-ink">${esc(jam(o.waktu))}</span>
                           <span class="block text-xs font-medium text-rose-600">telat ${o.telat_menit} menit</span>
                         </span>
                       </li>`,
                       )
                       .join('')}
                   </ul>`
            }
          </div>
        </section>

        <section class="${KARTU}">
          <h3 class="text-lg font-semibold tracking-tight text-ink">Belum absen</h3>
          <p class="mt-1 text-sm text-muted">
            ${libur ? 'Tidak ada yang diharapkan masuk.' : 'Perlu ditanyakan ke yang bersangkutan.'}
          </p>
          <div class="mt-4">
            ${
              d.belum_masuk.length === 0
                ? barisKosong(pesanBelumAbsen(libur, r.total))
                : `<ul class="divide-y divide-ink/8">
                     ${d.belum_masuk
                       .map(
                         (o) => `
                       <li class="flex items-center gap-3.5 py-3">
                         <span class="grid size-9 shrink-0 place-items-center rounded-full
                                      bg-amber-500/12 text-xs font-semibold text-amber-700">
                           ${esc(inisial(o.nama))}
                         </span>
                         <span class="min-w-0 flex-1">
                           <span class="block truncate text-sm font-medium text-ink">${esc(o.nama)}</span>
                           <span class="block truncate text-xs text-muted">${esc(o.divisi)}</span>
                         </span>
                         <span class="shrink-0 font-mono text-xs text-muted">${esc(o.nip)}</span>
                       </li>`,
                       )
                       .join('')}
                   </ul>`
            }
          </div>
        </section>
      </div>

      <section class="${KARTU} mt-6">
        <h3 class="text-lg font-semibold tracking-tight text-ink">Aktivitas terbaru</h3>
        <p class="mt-1 text-sm text-muted">Enam catatan terakhir pada tanggal ini.</p>
        <div class="mt-4">
          ${
            d.aktivitas.length === 0
              ? barisKosong('Belum ada aktivitas.')
              : `<ul class="divide-y divide-ink/8">
                   ${d.aktivitas
                     .map(
                       (a) => `
                     <li class="flex items-center gap-3.5 py-3">
                       ${avatar(a.nama, a.foto, 'size-10')}
                       <span class="min-w-0 flex-1">
                         <span class="block truncate text-sm font-medium text-ink">${esc(a.nama)}</span>
                         <span class="block truncate text-xs text-muted">${esc(a.lokasi ?? '—')}</span>
                       </span>
                       <span class="shrink-0 text-right">
                         <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                           a.tipe === 'masuk'
                             ? 'bg-emerald-500/12 text-emerald-700'
                             : 'bg-merek/10 text-merek'
                         }">${a.tipe === 'masuk' ? 'Masuk' : 'Pulang'}</span>
                         <span class="angka-rata mt-1 block text-xs text-muted">${esc(jam(a.waktu))}</span>
                       </span>
                     </li>`,
                     )
                     .join('')}
                 </ul>`
          }
        </div>
      </section>

      ${
        MODE_TIRUAN
          ? `<p class="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
               <span class="block size-1.5 rounded-full bg-amber-500"></span>
               Data tiruan — backend belum tersambung
             </p>`
          : ''
      }`;

    kotak.querySelector('[data-ulang]')?.addEventListener('click', () => muat(tanggal));
  }

  isi.querySelector('[data-mundur]').addEventListener('click', () => muat(gantiHari(aktif, -1)));
  isi.querySelector('[data-maju]').addEventListener('click', () => {
    const berikut = gantiHari(aktif, 1);
    if (berikut <= hariIni) muat(berikut);
  });

  muat(hariIni);

  return () => {
    hidup = false;
  };
}

export default {
  judul: 'Beranda',

  mount(akar) {
    const p = pengguna();
    const isi = pasangKerangka(akar, { judul: 'Beranda' });

    // Isi harus ditulis dulu: jam berjalan mencari [data-jam] di dalamnya, dan
    // elemen itu belum ada sebelum baris berikutnya jalan.
    const hentikanIsi = dashboardAdmin(isi, p);
    const hentikanJam = jamBerjalan(
      isi.querySelector('[data-jam]'),
      isi.querySelector('[data-tanggal]'),
    );

    return () => {
      hentikanJam?.();
      hentikanIsi?.();
    };
  },
};
