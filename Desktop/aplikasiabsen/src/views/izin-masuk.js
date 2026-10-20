// Persetujuan izin (admin).
//
// Satu layar, dua keputusan: setujui atau tolak. Dua hal yang sengaja diatur
// begini:
//
// - Menolak WAJIB memakai alasan. Alasannya dibaca magang di layar Izin &
//   Cuti. Penolakan tanpa alasan akan ditanyakan lewat pesan pribadi, dan
//   jawabannya tidak tercatat di mana pun.
// - Menyetujui cuti diperiksa lagi di server, bukan cuma di sini. Dua pengajuan
//   yang masing-masing muat bisa saja jumlahnya melebihi jatah, dan yang tahu
//   masalahnya justru bukan yang bisa memutuskan.

import { api } from '../api.js';
import { esc, tanggal, dialogFormulir, konfirmasi, beritahu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import {
  KARTU,
  tabel,
  pesanGalat,
  lencanaJenis,
  lencanaPengajuan,
  LABEL_JENIS,
  TOMBOL_BARIS,
} from '../tabel.js';

const TAB = [
  { kunci: 'menunggu', label: 'Menunggu' },
  { kunci: 'disetujui', label: 'Disetujui' },
  { kunci: 'ditolak', label: 'Ditolak' },
  { kunci: 'semua', label: 'Semua' },
];

/** "22 Okt 2026", atau "22 – 24 Okt 2026" kalau lebih dari sehari. */
function rentang(mulai, selesai) {
  if (mulai === selesai) return tanggal(mulai);
  return `${tanggal(mulai)} – ${tanggal(selesai)}`;
}

const KELAS_TAB = (aktif) =>
  'cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium transition duration-200 ' +
  `ease-apple ${aktif ? 'bg-merek text-white shadow-naik' : 'text-muted hover:bg-ink/6 hover:text-ink'}`;

export default {
  judul: 'Persetujuan Izin',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Persetujuan Izin' });

    isi.innerHTML = `
      <div class="${KARTU}">
        <h2 class="text-lg font-semibold tracking-tight text-ink">Pengajuan izin &amp; cuti</h2>
        <p data-jumlah class="mt-0.5 text-sm text-muted">Memuat…</p>

        <div data-tab class="mt-5 flex flex-wrap gap-1.5"></div>
        <div data-daftar></div>
      </div>`;

    const kotakTab = isi.querySelector('[data-tab]');
    const kotakDaftar = isi.querySelector('[data-daftar]');
    const elJumlah = isi.querySelector('[data-jumlah]');

    let status = 'menunggu';
    let baris = [];
    let jumlah = { menunggu: 0, disetujui: 0, ditolak: 0, semua: 0 };
    let hidup = true;

    const kolom = [
      {
        judul: 'Anak magang',
        sel: (z) => `
          <span class="block leading-tight">
            <span class="block font-medium text-ink">${esc(z.nama)}</span>
            <span class="block text-xs text-muted">${esc(z.nip)} · ${esc(z.divisi || '—')}</span>
          </span>`,
      },
      { judul: 'Jenis', sel: (z) => lencanaJenis(z.jenis) },
      {
        judul: 'Tanggal',
        sel: (z) => `
          <span class="block leading-tight">
            <span class="block whitespace-nowrap text-ink">${esc(rentang(z.mulai, z.selesai))}</span>
            <span class="block text-xs text-muted">${z.hari_kerja} hari kerja</span>
          </span>`,
      },
      {
        judul: 'Alasan',
        kelas: 'max-w-[20rem]',
        sel: (z) => `
          <span class="block leading-tight">
            <span class="block text-ink">${esc(z.alasan)}</span>
            ${
              z.catatan_admin
                ? `<span class="mt-1 block text-xs text-muted">Catatan admin: ${esc(z.catatan_admin)}</span>`
                : ''
            }
          </span>`,
      },
      { judul: 'Status', sel: (z) => lencanaPengajuan(z.status) },
      {
        judul: '',
        kelas: 'text-right',
        sel: (z) =>
          z.status === 'menunggu'
            ? `<div class="flex justify-end gap-1">
                 <button type="button" data-tolak="${z.id}" class="${TOMBOL_BARIS} text-rose-600">Tolak</button>
                 <button type="button" data-setujui="${z.id}" class="${TOMBOL_BARIS} text-emerald-700">Setujui</button>
               </div>`
            : `<span class="block text-right text-xs text-muted">${esc(tanggal(z.diputuskan))}</span>`,
      },
    ];

    function gambarTab() {
      kotakTab.innerHTML = TAB.map((t) => {
        const aktif = t.kunci === status;
        return `
          <button type="button" data-tab-kunci="${t.kunci}" class="${KELAS_TAB(aktif)}">
            ${esc(t.label)}
            <span class="ml-1 tabular-nums ${aktif ? 'text-white/70' : 'text-muted'}">${jumlah[t.kunci] ?? 0}</span>
          </button>`;
      }).join('');
    }

    function gambar() {
      elJumlah.textContent =
        status === 'menunggu'
          ? jumlah.menunggu > 0
            ? `${jumlah.menunggu} pengajuan menunggu keputusan`
            : 'Tidak ada yang menunggu keputusan'
          : `${baris.length} pengajuan`;

      kotakDaftar.innerHTML = tabel({
        kolom,
        baris,
        kosong:
          status === 'menunggu'
            ? 'Tidak ada pengajuan yang menunggu. Semuanya sudah diputuskan.'
            : 'Belum ada pengajuan dengan status ini.',
      });
    }

    async function muat() {
      gambarTab();
      elJumlah.textContent = 'Memuat…';
      kotakDaftar.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat pengajuan…</p>';

      let d;
      try {
        d = await api.get(`/admin/izin?status=${status}`);
      } catch (galat) {
        if (!hidup) return;
        elJumlah.textContent = 'Gagal dimuat';
        kotakDaftar.innerHTML = pesanGalat(galat.message);
        return;
      }

      if (!hidup) return;
      baris = d.data;
      // Jumlahnya datang dari server, bukan dihitung dari daftar yang sedang
      // tampil. Kalau dihitung di sini, tab yang tidak sedang dibuka akan selalu
      // menulis 0 dan terlihat seperti tidak ada pengajuan sama sekali.
      jumlah = d.jumlah;
      gambarTab();
      gambar();
    }

    async function setujui(id) {
      const z = baris.find((x) => x.id === id);
      if (!z) return;

      const yakin = await konfirmasi({
        judul: `Setujui ${(LABEL_JENIS[z.jenis] ?? z.jenis).toLowerCase()} ${z.nama}?`,
        pesan:
          z.jenis === 'cuti'
            ? `${rentang(z.mulai, z.selesai)} — ${z.hari_kerja} hari kerja akan dipotong dari jatah cutinya.`
            : `${rentang(z.mulai, z.selesai)} — ${z.hari_kerja} hari kerja ditandai sebagai ${z.jenis}. Jatah cuti tidak berkurang.`,
        tombol: 'Setujui',
      });
      if (!yakin) return;

      try {
        await api.post(`/admin/izin/${id}/setujui`, {});
      } catch (galat) {
        // Keputusan ditolak server biasanya karena jatahnya sudah tidak cukup
        // atau ada pengajuan lain di tanggal yang sama. Daftarnya dimuat ulang
        // supaya yang terlihat kembali cocok dengan yang ada di server.
        await beritahu({ judul: 'Tidak bisa disetujui', pesan: galat.message });
        await muat();
        return;
      }

      await muat();
    }

    async function tolak(id) {
      const z = baris.find((x) => x.id === id);
      if (!z) return;

      const berhasil = await dialogFormulir({
        judul: `Tolak pengajuan ${z.nama}`,
        keterangan: `${rentang(z.mulai, z.selesai)} — ${LABEL_JENIS[z.jenis] ?? z.jenis}. Alasan ini dibaca anak magangnya di layar Izin & Cuti.`,
        kolom: [
          {
            nama: 'catatan',
            label: 'Alasan penolakan',
            jenis: 'panjang',
            wajib: true,
            lebar: 'penuh',
            contoh: 'Beban kerja sedang tinggi pada tanggal itu.',
          },
        ],
        tombolKirim: 'Tolak pengajuan',
        kirim: (isian) => api.post(`/admin/izin/${id}/tolak`, isian),
      });

      if (berhasil) await muat();
    }

    kotakTab.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab-kunci]');
      if (!t || t.dataset.tabKunci === status) return;
      status = t.dataset.tabKunci;
      muat();
    });

    // Satu pendengar untuk seluruh daftar: isinya digambar ulang tiap kali
    // dimuat, jadi pendengar yang dipasang per baris akan ikut hilang.
    kotakDaftar.addEventListener('click', (e) => {
      const setuju = e.target.closest('[data-setujui]');
      if (setuju) {
        setujui(Number(setuju.dataset.setujui));
        return;
      }
      const tolakEl = e.target.closest('[data-tolak]');
      if (tolakEl) tolak(Number(tolakEl.dataset.tolak));
    });

    muat();

    return () => {
      hidup = false;
    };
  },
};
