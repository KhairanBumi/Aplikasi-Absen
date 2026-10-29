import { api } from '../api.js';
import { esc, waktu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, tabel, pesanGalat, TOMBOL_HALUS } from '../tabel.js';
import { panggung } from '../animasi.js';

const KELAS_TANGGAL =
  'rounded-xl border border-ink/12 bg-white/75 px-3 py-2 text-sm text-ink outline-none focus:border-merek';

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
            <input name="aksi" placeholder="Semua aksi" class="w-full ${KELAS_TANGGAL}" />
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
      { judul: 'Aksi', sel: (a) => `<span class="font-medium text-ink">${esc(a.aksi)}</span>` },
      {
        judul: 'Rincian',
        sel: (a) =>
          `<code class="block max-w-md break-words text-xs text-muted">${esc(JSON.stringify(a.rincian))}</code>`,
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
