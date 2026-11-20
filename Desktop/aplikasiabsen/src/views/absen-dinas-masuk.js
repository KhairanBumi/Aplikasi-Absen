// Persetujuan absen dinas luar (admin).
//
// Satu baris = satu absen `masuk` atau `pulang`, bukan satu hari. Admin perlu
// memutuskan tiap baris karena jam dan lokasinya berbeda, jadi daftar ini tidak
// digabung seperti rekap harian.
//
// Foto adalah bukti utama, maka pratinjaunya harus bisa diperbesar tanpa
// meninggalkan halaman. Alamat, jarak, dan akurasi GPS ditampilkan apa adanya:
// jarak jauh bukan tuduhan — dinas luar memang jauh — tetapi angka akurasi
// memberi tahu seberapa besar titiknya harus dipercaya.

import { api } from '../api.js';
import { esc, jam, tanggal, dialogFormulir, konfirmasi, beritahu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import {
  KARTU,
  tabel,
  pesanGalat,
  lencanaPengajuan,
  rincianLokasi,
  TOMBOL_UTAMA,
  TOMBOL_HALUS,
  TOMBOL_BARIS,
} from '../tabel.js';

const TAB = [
  { kunci: 'menunggu', label: 'Menunggu' },
  { kunci: 'disetujui', label: 'Disetujui' },
  { kunci: 'ditolak', label: 'Ditolak' },
  { kunci: 'semua', label: 'Semua' },
];

const KELAS_TAB = (aktif) =>
  'cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium transition duration-200 ' +
  `ease-apple ${aktif ? 'bg-merek text-white shadow-naik' : 'text-muted hover:bg-ink/6 hover:text-ink'}`;

/** Pratinjau selfie. Ukurannya cukup untuk memastikan wajah dan latar benar. */
function pratinjauFoto(r) {
  const d = document.createElement('dialog');
  d.className =
    'kaca-tebal m-auto w-[calc(100%-2rem)] max-w-lg rounded-[1.5rem] p-4 text-ink sm:p-6';
  d.innerHTML = `
    <h2 class="text-lg font-semibold tracking-tight text-ink">Selfie ${esc(r.nama)}</h2>
    <p class="mt-0.5 text-sm text-muted">
      ${esc(r.tipe === 'masuk' ? 'Absen masuk' : 'Absen pulang')} ·
      ${esc(tanggal(r.waktu))} ${esc(jam(r.waktu))}
    </p>
    <img src="${esc(r.foto)}" alt="Selfie ${esc(r.nama)}"
         class="mt-4 max-h-[60dvh] w-full rounded-2xl bg-ink/10 object-contain ring-1 ring-ink/10">
    <p class="mt-3 text-sm break-words text-ink">${esc(r.keterangan_dinas ?? '')}</p>
    <div class="mt-4 flex justify-end">
      <button type="button" data-tutup class="${TOMBOL_HALUS}">Tutup</button>
    </div>`;
  document.body.appendChild(d);

  const tutup = () => {
    if (d.open) d.close();
  };
  d.querySelector('[data-tutup]').addEventListener('click', tutup);
  d.addEventListener('close', () => d.remove(), { once: true });
  d.showModal();
}

function buktiFoto(r) {
  if (!r.foto) {
    return '<span class="block text-xs text-rose-800">Selfie tidak tersedia</span>';
  }
  return `
    <button type="button" data-foto="${r.id}" aria-label="Perbesar selfie ${esc(r.nama)}"
            class="block cursor-pointer rounded-xl ring-1 ring-ink/10 transition hover:ring-merek">
      <img src="${esc(r.foto)}" alt="" class="size-12 rounded-xl object-cover">
    </button>`;
}

function catatanTolak(r) {
  return r.status_persetujuan === 'ditolak' && r.catatan_admin
    ? `<p class="mt-2.5 rounded-xl bg-rose-500/10 px-3 py-2 text-sm break-words text-rose-900">
         <span class="font-medium">Catatan admin:</span> ${esc(r.catatan_admin)}
       </p>`
    : '';
}

function tombolPutusan(r, { penuh = false } = {}) {
  if (r.status_persetujuan !== 'menunggu') {
    return `<span class="block text-xs text-muted">Diputuskan ${esc(tanggal(r.diputuskan_at))}</span>`;
  }
  return `
    <div class="flex flex-wrap gap-2 ${penuh ? 'mt-3' : 'justify-end'}">
      <button type="button" data-tolak="${r.id}" class="${penuh ? TOMBOL_HALUS : TOMBOL_BARIS} ${penuh ? '' : 'text-rose-800'}">
        Tolak
      </button>
      <button type="button" data-setujui="${r.id}" class="${penuh ? TOMBOL_UTAMA : TOMBOL_BARIS} ${penuh ? 'flex-1' : 'text-emerald-800'}">
        Setujui
      </button>
    </div>`;
}

function kartuDinas(r) {
  return `
    <li class="rounded-2xl border border-ink/8 bg-ink/4 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-medium break-words text-ink">${esc(r.nama)}</p>
          <p class="text-xs text-muted">${esc(r.nip)} · ${esc(r.divisi || '—')}</p>
        </div>
        ${lencanaPengajuan(r.status_persetujuan)}
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="inline-flex rounded-full bg-ink/8 px-2.5 py-1 font-medium text-ink/70">
          ${r.tipe === 'masuk' ? 'Masuk' : 'Pulang'}
        </span>
        <span class="tabular-nums text-muted">${esc(tanggal(r.waktu))} · ${esc(jam(r.waktu))}</span>
      </div>

      <p class="mt-2.5 text-sm break-words text-ink">${esc(r.keterangan_dinas ?? '—')}</p>

      <div class="mt-3 flex items-center gap-3">
        ${buktiFoto(r)}
        <span class="text-xs text-muted">
          ${r.foto ? 'Ketuk foto untuk memperbesar.' : 'Bukti selfie tidak lengkap.'}
        </span>
      </div>

      <div class="mt-2 border-t border-ink/6 pt-2 text-xs leading-relaxed text-muted">
        ${rincianLokasi(r, { ringkas: true })}
      </div>

      ${catatanTolak(r)}
      ${tombolPutusan(r, { penuh: true })}
    </li>`;
}

export default {
  judul: 'Persetujuan Absen Dinas',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Persetujuan Absen Dinas' });

    isi.innerHTML = `
      <div class="${KARTU} min-w-0">
        <h2 class="text-lg font-semibold tracking-tight text-ink">Absen dinas luar</h2>
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
        sel: (r) => `
          <span class="block leading-tight">
            <span class="block font-medium text-ink">${esc(r.nama)}</span>
            <span class="block text-xs text-muted">${esc(r.nip)} · ${esc(r.divisi || '—')}</span>
          </span>`,
      },
      {
        judul: 'Waktu',
        sel: (r) => `
          <span class="block leading-tight">
            <span class="block whitespace-nowrap tabular-nums text-ink">${esc(jam(r.waktu))}</span>
            <span class="block text-xs whitespace-nowrap text-muted">${esc(tanggal(r.waktu))}</span>
            <span class="mt-1 block text-xs font-medium text-ink/70">${r.tipe === 'masuk' ? 'Masuk' : 'Pulang'}</span>
          </span>`,
      },
      {
        judul: 'Keterangan',
        kelas: 'max-w-[18rem]',
        sel: (r) => `<span class="block text-sm break-words text-ink">${esc(r.keterangan_dinas ?? '—')}</span>`,
      },
      {
        judul: 'Bukti & lokasi',
        kelas: 'max-w-[20rem]',
        sel: (r) => `
          <div class="flex items-start gap-2.5">
            ${buktiFoto(r)}
            <div class="min-w-0 text-xs">${rincianLokasi(r, { ringkas: true })}</div>
          </div>`,
      },
      { judul: 'Status', sel: (r) => lencanaPengajuan(r.status_persetujuan) },
      {
        judul: '',
        kelas: 'text-right',
        sel: (r) => tombolPutusan(r),
      },
    ];

    function gambarTab() {
      kotakTab.innerHTML = TAB.map((t) => {
        const aktif = t.kunci === status;
        return `
          <button type="button" data-tab-kunci="${t.kunci}" class="${KELAS_TAB(aktif)}">
            ${esc(t.label)}
            <span class="ml-1 tabular-nums ${aktif ? 'text-white/90' : 'text-muted'}">${jumlah[t.kunci] ?? 0}</span>
          </button>`;
      }).join('');
    }

    function gambar() {
      elJumlah.textContent =
        status === 'menunggu'
          ? jumlah.menunggu > 0
            ? `${jumlah.menunggu} absen menunggu keputusan`
            : 'Tidak ada absen dinas yang menunggu keputusan'
          : `${baris.length} absen dinas`;

      kotakDaftar.innerHTML = tabel({
        judul: 'Daftar absen dinas luar',
        kolom,
        baris,
        kartu: kartuDinas,
        kosong:
          status === 'menunggu'
            ? 'Tidak ada absen dinas yang menunggu. Semuanya sudah diputuskan.'
            : 'Belum ada absen dinas dengan status ini.',
      });
    }

    async function muat() {
      gambarTab();
      elJumlah.textContent = 'Memuat…';
      kotakDaftar.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat absen dinas…</p>';

      let d;
      try {
        d = await api.get(`/admin/absen-dinas?status=${status}`);
      } catch (galat) {
        if (!hidup) return;
        elJumlah.textContent = 'Gagal dimuat';
        kotakDaftar.innerHTML = pesanGalat(galat.message);
        return;
      }

      if (!hidup) return;
      baris = d.data;
      // Jumlah seluruh status datang dari server. Menghitungnya dari daftar
      // yang sedang tampil akan menulis 0 pada tab yang tidak dibuka.
      jumlah = d.jumlah;
      gambarTab();
      gambar();
    }

    async function setujui(id) {
      const r = baris.find((x) => x.id === id);
      if (!r) return;

      const yakin = await konfirmasi({
        judul: `Setujui absen ${r.tipe} ${r.nama}?`,
        pesan: `${tanggal(r.waktu)} ${jam(r.waktu)} — absen ini langsung dihitung hadir pada rekap harian.`,
        tombol: 'Setujui',
      });
      if (!yakin) return;

      try {
        await api.post(`/admin/absen-dinas/${id}/setujui`, {});
      } catch (galat) {
        // Bisa sudah diputuskan admin lain. Muat ulang supaya yang terlihat
        // kembali cocok dengan yang ada di server.
        await beritahu({ judul: 'Tidak bisa disetujui', pesan: galat.message });
        await muat();
        return;
      }

      await muat();
    }

    async function tolak(id) {
      const r = baris.find((x) => x.id === id);
      if (!r) return;

      const berhasil = await dialogFormulir({
        judul: `Tolak absen ${r.tipe} ${r.nama}`,
        keterangan:
          'Catatan ini dibaca anak magangnya di layar Absen Dinas, dan dipakai sebagai alasan bila ia mengirim ulang.',
        kolom: [
          {
            nama: 'catatan',
            label: 'Catatan penolakan',
            jenis: 'panjang',
            wajib: true,
            lebar: 'penuh',
            contoh: 'Foto tidak menunjukkan lokasi dinas yang dimaksud.',
          },
        ],
        tombolKirim: 'Tolak absen',
        kirim: (isian) => api.post(`/admin/absen-dinas/${id}/tolak`, isian),
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
    // dimuat, jadi pendengar per baris akan ikut hilang.
    kotakDaftar.addEventListener('click', (e) => {
      const foto = e.target.closest('[data-foto]');
      if (foto) {
        const r = baris.find((x) => x.id === Number(foto.dataset.foto));
        if (r) pratinjauFoto(r);
        return;
      }

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
