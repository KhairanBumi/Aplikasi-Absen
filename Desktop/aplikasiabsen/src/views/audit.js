import { api } from '../api.js';
import { esc, waktu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, tabel, pesanGalat, formatJarak, TOMBOL_HALUS } from '../tabel.js';
import { panggung } from '../animasi.js';

const KELAS_TANGGAL =
  'rounded-xl border border-ink/12 bg-white/75 px-3 py-2 text-sm text-ink transition ' +
  'focus:border-merek focus:ring-2 focus:ring-merek focus:outline-none';

const AKSI = {
  absen_masuk: 'Absen masuk',
  absen_pulang: 'Absen pulang',
  tambah_magang: 'Tambah anak magang',
  ubah_magang: 'Ubah anak magang',
  hapus_magang: 'Hapus anak magang',
  reset_pin: 'Reset PIN',
  tambah_lokasi: 'Tambah lokasi',
  ubah_lokasi: 'Ubah lokasi',
  tambah_shift: 'Tambah shift',
  ubah_shift: 'Ubah shift',
  hapus_shift: 'Hapus shift',
  tambah_hari_libur: 'Tambah hari libur',
  ubah_hari_libur: 'Ubah hari libur',
  hapus_hari_libur: 'Hapus hari libur',
  setujui_izin: 'Setujui izin',
  tolak_izin: 'Tolak izin',
};

const LABEL_RINCIAN = {
  mode: 'Mode',
  tipe: 'Tipe',
  akurasi: 'Akurasi',
  jarak_m: 'Jarak',
  absen_id: 'ID absen',
  kiosk_id: 'Kiosk',
  lokasi_meragukan: 'Lokasi meragukan',
  nama: 'Nama',
  nip: 'NIP',
  aktif: 'Aktif',
};

function labelAksi(aksi) {
  return AKSI[aksi] ?? String(aksi ?? '').replaceAll('_', ' ');
}

function nilaiRincian(kunci, nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '—';
  if (typeof nilai === 'boolean') return nilai ? 'Ya' : 'Tidak';
  if (kunci === 'akurasi' && Number.isFinite(Number(nilai))) return `±${Math.round(Number(nilai))} m`;
  if (kunci === 'jarak_m') return formatJarak(Number(nilai)) ?? String(nilai);
  if (typeof nilai === 'object') return JSON.stringify(nilai);
  return String(nilai);
}

function rincianRingkas(rincian) {
  if (!rincian || typeof rincian !== 'object') return '<span class="text-muted">—</span>';

  const isi = Object.entries(rincian).filter(
    ([, nilai]) => nilai !== null && nilai !== undefined && nilai !== '',
  );
  if (isi.length === 0) return '<span class="text-muted">—</span>';

  const potongan = (kunci, nilai) => `
    <span class="inline-flex max-w-full items-baseline gap-1 rounded-lg bg-ink/5 px-2 py-1 text-xs">
      <span class="shrink-0 text-muted">${esc(LABEL_RINCIAN[kunci] ?? kunci)}</span>
      <span class="min-w-0 break-words text-ink">${esc(nilaiRincian(kunci, nilai))}</span>
    </span>`;

  const utama = isi.slice(0, 3).map(([k, v]) => potongan(k, v)).join('');
  const sisa = isi.slice(3);

  return `
    <span class="flex max-w-md flex-wrap gap-1.5">${utama}</span>
    ${
      sisa.length
        ? `<details class="mt-1.5">
             <summary class="cursor-pointer text-xs font-medium text-merek-gelap">Lihat ${sisa.length} detail lain</summary>
             <dl class="mt-1.5 grid gap-1 text-xs">
               ${sisa
                 .map(
                   ([k, v]) =>
                     `<div class="flex gap-2"><dt class="shrink-0 text-muted">${esc(LABEL_RINCIAN[k] ?? k)}</dt><dd class="min-w-0 break-words text-ink">${esc(nilaiRincian(k, v))}</dd></div>`,
                 )
                 .join('')}
             </dl>
           </details>`
        : ''
    }`;
}

function tanggalISO(geserHari = 0) {
  return new Date(Date.now() + geserHari * 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
}

export default {
  judul: 'Log Audit',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Log Audit' });
    const animasi = panggung();

    isi.innerHTML = `
      <div class="${KARTU}">
        <form data-filter class="flex flex-wrap items-end gap-3">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Dari</span>
            <input type="date" name="dari" value="${tanggalISO(-6)}" class="${KELAS_TANGGAL}" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Sampai</span>
            <input type="date" name="sampai" value="${tanggalISO()}" class="${KELAS_TANGGAL}" />
          </label>
          <label class="min-w-52 flex-1 text-sm">
            <span class="mb-1 block font-medium text-ink">Aksi</span>
            <input name="aksi" list="aksi-audit" placeholder="Semua aksi" class="w-full ${KELAS_TANGGAL}" />
            <datalist id="aksi-audit">
              ${Object.entries(AKSI).map(([nilai, label]) => `<option value="${nilai}">${esc(label)}</option>`).join('')}
            </datalist>
          </label>
          <button type="submit" class="${TOMBOL_HALUS}">Tampilkan</button>
        </form>

        <div data-tabel class="mt-5"></div>
      </div>`;

    const form = isi.querySelector('[data-filter]');
    const kotak = isi.querySelector('[data-tabel]');
    let halaman = 1;
    let meta = null;
    let data = [];

    const kolom = [
      { judul: 'Waktu', sel: (a) => `<span class="whitespace-nowrap">${esc(waktu(a.waktu))}</span>` },
      {
        judul: 'Aktor',
        sel: (a) =>
          a.aktor
            ? `<span class="font-medium text-ink">${esc(a.aktor.nama)}</span>
               <span class="block text-xs text-muted">${esc(a.aktor.nip)}</span>`
            : '<span class="text-muted">Sistem</span>',
      },
      { judul: 'Aksi', sel: (a) => `<span class="font-medium text-ink">${esc(labelAksi(a.aksi))}</span>` },
      {
        judul: 'Rincian',
        sel: (a) => rincianRingkas(a.rincian),
      },
      { judul: 'IP', sel: (a) => `<span class="text-muted">${esc(a.ip ?? '—')}</span>` },
    ];

    function gambar() {
      kotak.innerHTML = `
        ${tabel({
          judul: 'Log audit',
          kolom,
          baris: data,
          kosong: 'Tidak ada audit pada rentang ini.',
        })}
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>${meta.total} catatan · halaman ${meta.halaman} dari ${meta.terakhir}</span>
          <span class="flex gap-2">
            <button type="button" data-sebelum ${meta.halaman <= 1 ? 'disabled' : ''}
              class="${TOMBOL_HALUS}">Sebelumnya</button>
            <button type="button" data-berikut ${meta.halaman >= meta.terakhir ? 'disabled' : ''}
              class="${TOMBOL_HALUS}">Berikutnya</button>
          </span>
        </div>`;

      kotak.querySelector('[data-sebelum]')?.addEventListener('click', () => {
        if (meta.halaman > 1) {
          halaman -= 1;
          muat();
        }
      });
      kotak.querySelector('[data-berikut]')?.addEventListener('click', () => {
        if (meta.halaman < meta.terakhir) {
          halaman += 1;
          muat();
        }
      });

      animasi.beruntun([...kotak.querySelectorAll('tbody tr')], { y: 8, durasi: 0.32 });
    }

    async function muat() {
      kotak.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat audit…</p>';

      const kueri = new URLSearchParams({
        dari: form.elements.dari.value,
        sampai: form.elements.sampai.value,
        halaman: String(halaman),
        per: '50',
      });

      if (form.elements.aksi.value.trim()) kueri.set('aksi', form.elements.aksi.value.trim());

      try {
        const jawab = await api.get(`/admin/audit?${kueri}`);
        data = jawab.data;
        meta = jawab.meta;
        gambar();
      } catch (galat) {
        kotak.innerHTML = pesanGalat(galat.message);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      halaman = 1;
      muat();
    });

    muat();

    return () => animasi.berhenti();
  },
};
