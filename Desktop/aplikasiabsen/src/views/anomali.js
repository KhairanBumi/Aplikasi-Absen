import { api } from '../api.js';
import { esc, waktu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, tabel, pesanGalat, TOMBOL_HALUS } from '../tabel.js';
import { panggung } from '../animasi.js';

const KELAS_TANGGAL =
  'rounded-xl border border-ink/12 bg-white/75 px-3 py-2 text-sm text-ink outline-none focus:border-merek';

const LABEL_JENIS = {
  pin_salah_berulang: 'PIN salah berulang',
  lokasi_meragukan: 'Lokasi meragukan',
  jarak_jauh: 'Jarak jauh',
  perpindahan_mustahil: 'Perpindahan mustahil',
  ip_di_luar_kantor: 'IP di luar kantor',
  foto_hilang: 'Foto hilang',
};

// Kelas ditulis utuh supaya ikut terdeteksi Tailwind saat memindai berkas.
const WARNA_TINGKAT = {
  tinggi: 'bg-rose-500/12 text-rose-700',
  sedang: 'bg-amber-500/15 text-amber-800',
  rendah: 'bg-ink/8 text-muted',
};

function tanggalISO(geserHari = 0) {
  return new Date(Date.now() + geserHari * 86_400_000).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
}

export default {
  judul: 'Anomali',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Anomali' });
    const animasi = panggung();

    isi.innerHTML = `
      <div class="${KARTU}">
        <p class="text-sm text-muted">
          Anomali adalah petunjuk untuk diperiksa, bukan tuduhan. Jarak jauh dari kantor
          bukan pelanggaran; dinas luar memang boleh jauh.
        </p>

        <form data-filter class="mt-4 flex flex-wrap items-end gap-3">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Dari</span>
            <input type="date" name="dari" value="${tanggalISO(-6)}" class="${KELAS_TANGGAL}" />
          </label>
          <label class="text-sm">
            <span class="mb-1 block font-medium text-ink">Sampai</span>
            <input type="date" name="sampai" value="${tanggalISO()}" class="${KELAS_TANGGAL}" />
          </label>
          <button type="submit" class="${TOMBOL_HALUS}">Tampilkan</button>
        </form>

        <div data-daftar class="mt-5"></div>
      </div>`;

    const form = isi.querySelector('[data-filter]');
    const kotak = isi.querySelector('[data-daftar]');

    const kolom = [
      { judul: 'Waktu', sel: (a) => `<span class="whitespace-nowrap">${esc(waktu(a.waktu))}</span>` },
      {
        judul: 'Orang',
        sel: (a) =>
          `<span class="font-medium text-ink">${esc(a.nama ?? a.nip ?? '—')}</span>
           <span class="block text-xs text-muted">${esc(a.nip ?? '')}</span>`,
      },
      {
        judul: 'Jenis',
        sel: (a) =>
          `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            WARNA_TINGKAT[a.tingkat] ?? WARNA_TINGKAT.rendah
          }">${esc(LABEL_JENIS[a.jenis] ?? a.jenis)}</span>`,
      },
      { judul: 'Keterangan', sel: (a) => `<span class="text-muted">${esc(a.keterangan)}</span>` },
    ];

    async function muat() {
      kotak.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat anomali…</p>';

      const kueri = new URLSearchParams({
        dari: form.elements.dari.value,
        sampai: form.elements.sampai.value,
      });

      try {
        const jawab = await api.get(`/admin/anomali?${kueri}`);
        kotak.innerHTML = tabel({
          judul: 'Daftar anomali',
          kolom,
          baris: jawab.data,
          kosong: 'Tidak ada anomali pada rentang ini.',
        });

        animasi.beruntun([...kotak.querySelectorAll('tbody tr')], { y: 8, durasi: 0.32 });
      } catch (galat) {
        kotak.innerHTML = pesanGalat(galat.message);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      muat();
    });

    muat();

    return () => animasi.berhenti();
  },
};
