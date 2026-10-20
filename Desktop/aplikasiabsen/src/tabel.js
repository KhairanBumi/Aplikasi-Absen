// Bagian tampilan yang dipakai lebih dari satu layar.
//
// Hampir semua layar data di aplikasi ini berbentuk sama: satu kartu kaca
// berisi kepala (judul, jumlah baris, kotak cari, tombol), kartu-kartu angka
// ringkasan di atasnya, lalu sebuah tabel. Yang berbeda cuma kolomnya, jadi
// bagian yang berulang ditulis sekali di sini.
//
// Isi tiap sel tetap ditulis oleh layar pemakainya lewat `sel`, karena tiap
// kolom memang berbeda — dan itu bagian yang tidak boleh diseragamkan.

import { esc, jam, labelTanggal } from './ui.js';

export const KARTU = 'kaca rounded-[1.75rem] p-6';

// Pil, bukan kotak bersudut, sama seperti tombol di seluruh aplikasi.
export const TOMBOL_UTAMA =
  'flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-merek px-4 py-2.5 text-sm ' +
  'font-medium text-white shadow-naik transition duration-200 ease-apple hover:bg-merek-gelap ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40';

export const TOMBOL_HALUS =
  'cursor-pointer rounded-full border border-ink/10 bg-white/60 px-3.5 py-2 text-sm font-medium ' +
  'text-ink transition duration-200 ease-apple hover:bg-white/90 active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

// Tombol di dalam baris tabel. Teks saja, tanpa garis: satu baris tabel yang
// berisi dua tombol berbingkai akan terbaca lebih ramai daripada isinya.
export const TOMBOL_BARIS =
  'cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition duration-200 ' +
  'ease-apple hover:bg-ink/6 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40';

const IKON_CARI = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <circle cx="11" cy="11" r="6.4" /><path d="M15.8 15.8 20 20" />
  </svg>`;

const IKON_PLUS = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M12 6v12" /><path d="M6 12h12" />
  </svg>`;

const KEPALA_SEL =
  'px-4 py-3 text-left text-xs font-semibold tracking-[0.05em] text-muted uppercase whitespace-nowrap';
const SEL = 'px-4 py-3.5 align-middle';

/**
 * Kepala kartu daftar: judul, jumlah baris, kotak cari, dan tombol tambah.
 * `contohCari` dan `tambah` boleh dikosongkan — layar dengan tiga baris data
 * tidak perlu kotak cari.
 */
export function kepalaDaftar({ judul, tambah, contohCari = '' }) {
  return `
    <div class="flex flex-wrap items-start gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold tracking-tight text-ink">${esc(judul)}</h2>
        <p data-jumlah class="mt-0.5 text-sm text-muted">Memuat…</p>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-2.5">
        ${
          contohCari
            ? `<div class="relative">
                 <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">${IKON_CARI}</span>
                 <input type="search" data-cari placeholder="${esc(contohCari)}"
                        class="w-full rounded-full border border-ink/10 bg-white/70 py-2.5 pr-3.5 pl-9 text-sm
                               text-ink transition placeholder:text-muted focus:border-merek/50
                               focus:bg-white/90 focus:ring-4 focus:ring-merek/15 focus:outline-none sm:w-56">
               </div>`
            : ''
        }
        ${
          tambah
            ? `<button type="button" data-tambah class="${TOMBOL_UTAMA}">
                 ${IKON_PLUS}<span>${esc(tambah)}</span>
               </button>`
            : ''
        }
      </div>
    </div>`;
}

/**
 * Tabel daftar.
 * `kolom` berisi { judul, kelas, sel(baris) -> HTML }.
 */
export function tabel({ kolom, baris, kosong = 'Belum ada data.' }) {
  const isiBaris =
    baris.length === 0
      ? `<tr><td colspan="${kolom.length}" class="px-4 py-14 text-center text-muted">${esc(kosong)}</td></tr>`
      : baris
          .map(
            (b) => `
              <tr class="border-b border-ink/6 transition duration-150 last:border-0 hover:bg-white/45">
                ${kolom.map((k) => `<td class="${SEL} ${k.kelas ?? ''}">${k.sel(b)}</td>`).join('')}
              </tr>`,
          )
          .join('');

  return `
    <div class="mt-5 overflow-x-auto">
      <table class="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr class="border-b border-ink/8">
            ${kolom
              .map((k) => `<th scope="col" class="${KEPALA_SEL} ${k.kelas ?? ''}">${esc(k.judul)}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>${isiBaris}</tbody>
      </table>
    </div>`;
}

/** Lencana kecil untuk status aktif / nonaktif. */
export function lencanaStatus(aktif) {
  return aktif
    ? '<span class="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700">Aktif</span>'
    : '<span class="inline-flex rounded-full bg-ink/8 px-2.5 py-1 text-xs font-medium text-muted">Nonaktif</span>';
}

// ── Lencana status ──────────────────────────────────────────────────────────
//
// Kelasnya ditulis lengkap sebagai teks, bukan disusun dari potongan. Tailwind
// mencari nama kelas di dalam berkas sumber, dan kelas yang dirangkai saat
// program berjalan tidak pernah ikut terdeteksi — hasilnya lencana tanpa warna.

const WARNA_ABSEN = {
  tepat: 'bg-emerald-500/12 text-emerald-700',
  telat: 'bg-amber-500/15 text-amber-700',
  cuti: 'bg-merek/12 text-merek',
  izin: 'bg-merek/12 text-merek',
  sakit: 'bg-rose-500/12 text-rose-700',
  alpha: 'bg-rose-500/15 text-rose-700',
  libur: 'bg-ink/8 text-muted',
  belum: 'bg-ink/8 text-muted',
};

const LABEL_ABSEN = {
  tepat: 'Tepat waktu',
  telat: 'Telat',
  cuti: 'Cuti',
  izin: 'Izin',
  sakit: 'Sakit',
  // Bukan "Alpa". Yang dimaksud adalah hari kerja yang tidak punya catatan
  // masuk sama sekali — bisa juga karena magangnya lupa absen, dan tuduhan
  // "alpa" yang salah lebih mahal daripada kalimat yang lebih panjang.
  alpha: 'Tanpa kabar',
  libur: 'Libur',
  belum: 'Belum absen',
};

const WARNA_PENGAJUAN = {
  menunggu: 'bg-amber-500/15 text-amber-700',
  disetujui: 'bg-emerald-500/12 text-emerald-700',
  ditolak: 'bg-rose-500/12 text-rose-700',
};

const LABEL_PENGAJUAN = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };

const WARNA_JENIS = {
  cuti: 'bg-merek/12 text-merek',
  izin: 'bg-sky-500/12 text-sky-700',
  sakit: 'bg-rose-500/12 text-rose-700',
};

export const LABEL_JENIS = { cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit' };

function lencana(label, kelas) {
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${kelas}">${esc(label)}</span>`;
}

/** Status satu hari absen: tepat waktu, telat, cuti, alpha, libur, … */
export function lencanaAbsen(status) {
  return lencana(LABEL_ABSEN[status] ?? status, WARNA_ABSEN[status] ?? 'bg-ink/8 text-muted');
}

/** Status pengajuan izin: menunggu, disetujui, ditolak. */
export function lencanaPengajuan(status) {
  return lencana(
    LABEL_PENGAJUAN[status] ?? status,
    WARNA_PENGAJUAN[status] ?? 'bg-ink/8 text-muted',
  );
}

/**
 * Jenis pengajuan. Cuti, izin, dan sakit dibedakan warnanya karena hanya cuti
 * yang memotong jatah — kalau ketiganya berwarna sama, admin harus membaca
 * labelnya satu per satu untuk tahu mana yang mengurangi kuota.
 */
export function lencanaJenis(jenis) {
  return lencana(LABEL_JENIS[jenis] ?? jenis, WARNA_JENIS[jenis] ?? 'bg-ink/8 text-muted');
}

/**
 * Kolom tabel daftar harian satu orang dalam satu bulan.
 *
 * Dipakai bersama oleh layar Riwayat Absen milik magang dan rincian per orang
 * di Rekap & Laporan milik admin. Sengaja satu definisi: kalau admin dan
 * magang melihat hari yang sama lewat kolom yang berbeda, salah satu dari
 * mereka akan merasa ada yang disembunyikan.
 */
export function kolomHarian() {
  return [
    {
      judul: 'Tanggal',
      sel: (h) => `
        <span class="block leading-tight">
          <span class="block font-medium whitespace-nowrap text-ink">${esc(labelTanggal(h.tanggal))}</span>
          ${h.keterangan_libur ? `<span class="block text-xs text-muted">${esc(h.keterangan_libur)}</span>` : ''}
        </span>`,
    },
    { judul: 'Masuk', sel: (h) => `<span class="tabular-nums text-ink">${esc(jam(h.masuk))}</span>` },
    { judul: 'Pulang', sel: (h) => `<span class="tabular-nums text-ink">${esc(jam(h.pulang))}</span>` },
    {
      judul: 'Terlambat',
      sel: (h) =>
        h.telat_menit > 0
          ? `<span class="tabular-nums text-amber-700">${h.telat_menit} menit</span>`
          : '<span class="text-muted">—</span>',
    },
    {
      judul: 'Lokasi',
      sel: (h) => {
        if (h.mode !== 'luar') return `<span class="text-muted">${esc(h.lokasi ?? '—')}</span>`;

        // Koordinatnya ditautkan ke OpenStreetMap: gratis, tanpa API key, dan
        // admin bisa memeriksa sendiri tanpa aplikasi ini menyimpan peta.
        if (!Number.isFinite(h.lintang) || !Number.isFinite(h.bujur)) {
          return `<span class="text-muted">${esc(h.lokasi ?? 'Luar kantor')}</span>`;
        }
        return `<a href="https://www.openstreetmap.org/?mlat=${h.lintang}&mlon=${h.bujur}#map=17/${h.lintang}/${h.bujur}"
                   target="_blank" rel="noopener"
                   title="Buka ${h.lintang}, ${h.bujur} di OpenStreetMap"
                   class="text-merek underline-offset-2 hover:underline">Luar kantor</a>`;
      },
    },
    { judul: 'Status', sel: (h) => lencanaAbsen(h.status) },
  ];
}

/** Keterangan saat datanya gagal dimuat. Dipasang menggantikan tabel. */
export function pesanGalat(pesan) {
  return `
    <div class="mt-5 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3.5 text-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7.8v5" /><path d="M12 16.4h.01" />
      </svg>
      <span class="text-ink">${esc(pesan)}</span>
    </div>`;
}

// ── Ringkasan dan pemilih bulan ─────────────────────────────────────────────

/**
 * Satu kartu angka untuk ringkasan di atas daftar.
 * `warna` hanya mewarnai angkanya, bukan seluruh kartu — kartu yang ikut
 * berwarna membuat semua angka terlihat sama pentingnya.
 */
export function kartuAngka(label, nilai, catatan = '', warna = 'text-ink') {
  return `
    <div class="${KARTU}">
      <p class="text-sm text-muted">${esc(label)}</p>
      <p class="angka-rata mt-2 text-3xl font-semibold tracking-tight ${warna}">${esc(nilai)}</p>
      <p class="mt-1 text-xs text-muted">${esc(catatan)}</p>
    </div>`;
}

export const TOMBOL_NAV =
  'grid size-9 cursor-pointer place-items-center rounded-full text-ink transition duration-200 ' +
  'ease-apple hover:bg-white/80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ' +
  'disabled:hover:bg-transparent disabled:active:scale-100';

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

/**
 * Pemilih bulan: tombol mundur, label, tombol maju.
 *
 * Tombol maju dimatikan oleh layar pemakainya saat sudah di bulan berjalan.
 * Laporan bulan yang belum terjadi tidak berisi apa-apa, dan tombol yang bisa
 * ditekan tapi tidak mengubah apa pun membuat orang mengira datanya hilang.
 */
export function pemilihBulan() {
  return `
    <div class="flex items-center gap-1.5">
      <button type="button" data-bulan-mundur class="${TOMBOL_NAV}" aria-label="Bulan sebelumnya">${IKON_KIRI}</button>
      <p class="min-w-[9rem] text-center text-sm font-medium text-ink" data-label-bulan>—</p>
      <button type="button" data-bulan-maju class="${TOMBOL_NAV}" aria-label="Bulan berikutnya">${IKON_KANAN}</button>
    </div>`;
}
