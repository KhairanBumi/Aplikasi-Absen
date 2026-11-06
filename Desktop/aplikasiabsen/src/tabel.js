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

export const KARTU = 'kaca-kartu rounded-[1.75rem] p-4 sm:p-6';

// Kartu ringkasan boleh lebih "kaca" daripada permukaan tabel: isinya pendek,
// jumlahnya paling banyak empat per layar, dan tidak ada baris data panjang.
export const KARTU_RINGKASAN = 'kaca-lembut rounded-[1.75rem] p-4 sm:p-6';

// Pil, bukan kotak bersudut, sama seperti tombol di seluruh aplikasi.
export const TOMBOL_UTAMA =
  'flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-merek ' +
  'px-4 py-2.5 text-sm font-medium text-white shadow-naik transition duration-200 ease-apple ' +
  'hover:bg-merek-gelap active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40';

export const TOMBOL_HALUS =
  'min-h-11 cursor-pointer rounded-full border border-ink/10 bg-white/60 px-3.5 py-2 text-sm ' +
  'font-medium text-ink transition duration-200 ease-apple hover:bg-white/90 active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

// Tombol di dalam baris tabel. Teks saja, tanpa garis: satu baris tabel yang
// berisi dua tombol berbingkai akan terbaca lebih ramai daripada isinya.
export const TOMBOL_BARIS =
  'min-h-11 cursor-pointer rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition ' +
  'duration-200 ease-apple hover:bg-ink/6 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40';

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
            ? `<div class="relative w-full sm:w-auto">
                 <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">${IKON_CARI}</span>
                 <input type="search" data-cari placeholder="${esc(contohCari)}"
                        aria-label="${esc(contohCari)}"
                        class="w-full rounded-full border border-ink/10 bg-white/70 py-2.5 pr-3.5 pl-9 text-sm
                               text-ink transition placeholder:text-muted focus:border-merek
                               focus:bg-white/90 focus:ring-2 focus:ring-merek focus:outline-none sm:w-56">
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
 *
 * `kartu` opsional dipakai layar yang punya kolom terlalu banyak untuk dibaca
 * sebagai tabel di ponsel. Fungsi itu harus mengembalikan satu `<li>`; tabel
 * desktop tetap dipakai di layar lebar.
 */
export function tabel({ judul, kolom, baris, kosong = 'Belum ada data.', kartu = null }) {
  const kosongBaris = baris.length === 0;
  const isiBaris = kosongBaris
    ? `<tr data-kosong><td colspan="${kolom.length}" class="px-4 py-14 text-center text-muted">${esc(kosong)}</td></tr>`
    : baris
        .map(
          (b) => `
              <tr class="border-b border-ink/6 transition duration-150 last:border-0 hover:bg-ink/4">
                ${kolom
                  .map(
                    (k) =>
                      `<td class="${SEL} ${k.kelas ?? ''}">
                         <span class="label-sel" aria-hidden="true">${esc(k.judul)}</span>
                         <div class="sel-isi">${k.sel(b)}</div>
                       </td>`,
                  )
                  .join('')}
              </tr>`,
        )
        .join('');

  const htmlTabel = `
    <div class="tabel-responsif scroll-samping mt-5 overflow-x-auto ${kartu ? 'hidden md:block' : ''}"
         role="region" aria-label="${esc(judul)}" tabindex="0">
      <table class="w-full min-w-0 border-collapse text-sm md:min-w-[42rem]">
        <caption class="sr-only">${esc(judul)}</caption>
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

  if (!kartu) return htmlTabel;

  const htmlKartu = kosongBaris
    ? `<div class="mt-5 rounded-2xl border border-ink/8 bg-ink/4 px-4 py-12 text-center text-sm text-muted md:hidden">
         ${esc(kosong)}
       </div>`
    : `<ul class="mt-5 grid gap-3 md:hidden">${baris.map(kartu).join('')}</ul>`;

  return `${htmlKartu}${htmlTabel}`;
}

/** Lencana kecil untuk status aktif / nonaktif. */
export function lencanaStatus(aktif) {
  return aktif
    ? '<span class="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-800">Aktif</span>'
    : '<span class="inline-flex rounded-full bg-ink/8 px-2.5 py-1 text-xs font-medium text-ink/70">Nonaktif</span>';
}

// ── Lencana status ──────────────────────────────────────────────────────────
//
// Kelasnya ditulis lengkap sebagai teks, bukan disusun dari potongan. Tailwind
// mencari nama kelas di dalam berkas sumber, dan kelas yang dirangkai saat
// program berjalan tidak pernah ikut terdeteksi — hasilnya lencana tanpa warna.
//
// Shade-nya yang -800, bukan -700: di atas panel kaca, `emerald-700` cuma
// 3.6:1 dan `amber-700` 3.4:1. Yang -800 melompat ke 4.8–5.6:1.

const WARNA_ABSEN = {
  tepat: 'bg-emerald-500/12 text-emerald-800',
  telat: 'bg-amber-500/15 text-amber-800',
  cuti: 'bg-merek/12 text-merek-gelap',
  izin: 'bg-merek/12 text-merek-gelap',
  sakit: 'bg-rose-500/12 text-rose-800',
  alpha: 'bg-rose-500/15 text-rose-800',
  libur: 'bg-ink/8 text-ink/70',
  belum: 'bg-ink/8 text-ink/70',
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
  menunggu: 'bg-amber-500/15 text-amber-800',
  disetujui: 'bg-emerald-500/12 text-emerald-800',
  ditolak: 'bg-rose-500/12 text-rose-800',
};

const LABEL_PENGAJUAN = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };

const WARNA_JENIS = {
  cuti: 'bg-merek/12 text-merek-gelap',
  izin: 'bg-sky-500/12 text-sky-800',
  sakit: 'bg-rose-500/12 text-rose-800',
};

export const LABEL_JENIS = { cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit' };

function lencana(label, kelas) {
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${kelas}">${esc(label)}</span>`;
}

/** Status satu hari absen: tepat waktu, telat, cuti, alpha, libur, … */
export function lencanaAbsen(status) {
  return lencana(LABEL_ABSEN[status] ?? status, WARNA_ABSEN[status] ?? 'bg-ink/8 text-ink/70');
}

/** Status pengajuan izin: menunggu, disetujui, ditolak. */
export function lencanaPengajuan(status) {
  return lencana(
    LABEL_PENGAJUAN[status] ?? status,
    WARNA_PENGAJUAN[status] ?? 'bg-ink/8 text-ink/70',
  );
}

/**
 * Jenis pengajuan. Cuti, izin, dan sakit dibedakan warnanya karena hanya cuti
 * yang memotong jatah — kalau ketiganya berwarna sama, admin harus membaca
 * labelnya satu per satu untuk tahu mana yang mengurangi kuota.
 */
export function lencanaJenis(jenis) {
  return lencana(LABEL_JENIS[jenis] ?? jenis, WARNA_JENIS[jenis] ?? 'bg-ink/8 text-ink/70');
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
          ? `<span class="tabular-nums text-amber-800">${h.telat_menit} menit</span>`
          : '<span class="text-muted">—</span>',
    },
    {
      judul: 'Lokasi',
      sel: (h) => rincianLokasi(h),
    },
    { judul: 'Status', sel: (h) => lencanaAbsen(h.status) },
  ];
}

/**
 * Satu hari dalam bentuk kartu untuk tabel yang berganti bentuk di ponsel.
 *
 * Hari tanpa catatan masuk cukup satu baris. Sebulan penuh kartu tiga kolom
 * berisi "—" membuat riwayat kosong terasa seperti daftar panjang yang rusak;
 * yang perlu dibaca dari hari libur cuma tanggal dan statusnya.
 */
export function kartuHarian(h) {
  const tanggal = `<span class="block font-medium text-ink">${esc(labelTanggal(h.tanggal))}</span>`;
  const keterangan = h.keterangan_libur
    ? `<span class="block text-xs text-muted">${esc(h.keterangan_libur)}</span>`
    : h.alasan_izin
      ? `<span class="block truncate text-xs text-muted">${esc(h.alasan_izin)}</span>`
      : '';

  if (!h.masuk && !h.pulang) {
    return `
      <li class="flex items-center justify-between gap-3 rounded-xl border border-ink/6 bg-ink/4 px-3.5 py-2.5">
        <span class="min-w-0">${tanggal}${keterangan}</span>
        ${lencanaAbsen(h.status)}
      </li>`;
  }

  const telat =
    h.telat_menit > 0
      ? `<span class="font-medium text-amber-800">${h.telat_menit} menit</span>`
      : '<span class="text-muted">—</span>';

  return `
    <li class="rounded-2xl border border-ink/8 bg-ink/4 p-4">
      <div class="flex items-start justify-between gap-3">
        <span class="min-w-0">${tanggal}${keterangan}</span>
        ${lencanaAbsen(h.status)}
      </div>

      <dl class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt class="text-[0.7rem] text-muted">Masuk</dt>
          <dd class="angka-rata mt-0.5 tabular-nums text-ink">${esc(jam(h.masuk))}</dd>
        </div>
        <div>
          <dt class="text-[0.7rem] text-muted">Pulang</dt>
          <dd class="angka-rata mt-0.5 tabular-nums text-ink">${esc(jam(h.pulang))}</dd>
        </div>
        <div>
          <dt class="text-[0.7rem] text-muted">Terlambat</dt>
          <dd class="mt-0.5 tabular-nums">${telat}</dd>
        </div>
      </dl>

      <div class="mt-3 border-t border-ink/6 pt-2.5 text-xs leading-relaxed text-muted">
        ${rincianLokasi(h, { ringkas: true })}
      </div>
    </li>`;
}

/**
 * Jarak dalam meter menjadi teks pendek. `null` kalau tidak ada angkanya —
 * jangan menulis "0 m", karena itu terbaca seolah titiknya tepat di kantor.
 */
export function formatJarak(meter) {
  if (!Number.isFinite(meter)) return null;
  const m = Math.max(0, Math.round(meter));
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}

/**
 * Rincian lokasi satu baris absen.
 *
 * Untuk absen "di luar", jarak dan akurasi datang dari server. Di sini tidak
 * ada perhitungan jarak sama sekali: yang ditampilkan hanya angka yang sudah
 * dihitung dan disimpan saat absen. Akurasi ditulis apa adanya, termasuk saat
 * angkanya kasar — admin perlu tahu itu perkiraan, bukan bukti.
 */
export function rincianLokasi(h, { ringkas = false } = {}) {
  const luar =
    h?.mode === 'luar' || (!h?.mode && (h?.lokasi === 'Dinas luar' || h?.lokasi === 'Luar kantor'));

  const koordinat =
    Number.isFinite(h?.lintang) && Number.isFinite(h?.bujur)
      ? `${h.lintang}, ${h.bujur}`
      : null;

  const peta = koordinat
    ? `<a href="https://www.openstreetmap.org/?mlat=${h.lintang}&mlon=${h.bujur}#map=18/${h.lintang}/${h.bujur}"
           target="_blank" rel="noopener"
           title="Buka ${h.lintang}, ${h.bujur} di OpenStreetMap"
           class="shrink-0 text-merek-gelap underline-offset-2 hover:underline">Peta</a>`
    : '';

  // Alamat hasil reverse geocoding dari titik perangkat. Kalau layanan peta
  // gagal, koordinatnya tetap ditulis supaya admin tahu titik absennya.
  const tempat = h?.lokasi_teks
    ? `<span class="block text-xs text-ink">${esc(h.lokasi_teks)}</span>`
    : koordinat
      ? `<span class="block text-xs text-muted">${esc(koordinat)}</span>`
      : '';

  if (!luar) {
    // Absen "di perusahaan" juga menyimpan titik perangkat, jadi alamatnya
    // ikut ditampilkan di bawah nama kantor — bukan hanya untuk dinas luar.
    return `
      <span class="block leading-tight">
        <span class="block font-medium text-ink">${esc(h?.lokasi ?? '—')}</span>
        ${tempat}
        ${peta ? `<span class="mt-0.5 block text-xs">${peta}</span>` : ''}
      </span>`;
  }

  const jarak = formatJarak(h?.jarak_m);
  const akurasi = Number.isFinite(h?.akurasi) ? Math.round(h.akurasi) : null;
  const kasar = h?.lokasi_meragukan === true || akurasi === null || akurasi > 50;
  const kantor = h?.lokasi_kantor ? ` dari ${esc(h.lokasi_kantor)}` : ' dari kantor';
  const jarakTeks = jarak ? `${jarak}${kantor}` : 'jarak tidak tercatat';
  const akurasiTeks =
    akurasi === null ? 'akurasi GPS tidak tercatat' : `GPS ±${akurasi} m${akurasi > 50 ? ' (kasar)' : ''}`;

  if (ringkas) {
    return `
      <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span class="font-medium text-ink">Dinas luar</span>
        ${tempat}
        <span class="text-muted">${esc(jarakTeks)}</span>
        <span class="${kasar ? 'font-medium text-amber-800' : 'text-muted'}">${esc(akurasiTeks)}</span>
        ${peta}
      </span>`;
  }

  return `
    <span class="block leading-tight">
      <span class="block font-medium text-ink">Dinas luar</span>
      ${tempat}
      <span class="block text-xs text-muted">${esc(jarakTeks)}</span>
      <span class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
        <span class="${kasar ? 'font-medium text-amber-800' : 'text-muted'}">${esc(akurasiTeks)}</span>
        ${peta}
      </span>
    </span>`;
}

/** Keterangan saat datanya gagal dimuat. Dipasang menggantikan tabel. */
export function pesanGalat(pesan) {
  return `
    <div class="mt-5 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3.5 text-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 size-4 shrink-0 text-rose-800" aria-hidden="true">
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
  // `text-ink/70`, bukan `text-muted`: kartu ini memakai kaca 0.7, dan muted di
  // atas orb teal hanya ~4.0:1. Ink/70 tetap terbaca sebagai teks sekunder.
  return `
    <div class="${KARTU_RINGKASAN} kartu-angka">
      <p class="text-xs text-ink/70 sm:text-sm">${esc(label)}</p>
      <p class="angka-rata mt-1.5 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl ${warna}">
        <span data-angka>${esc(nilai)}</span>
      </p>
      <p class="mt-1 text-[0.7rem] leading-snug text-ink/70 sm:text-xs">${esc(catatan)}</p>
    </div>`;
}

export const TOMBOL_NAV =
  'grid size-11 cursor-pointer place-items-center rounded-full text-ink transition duration-200 ' +
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
