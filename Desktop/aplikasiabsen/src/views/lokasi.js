// Lokasi kantor.
//
// Lokasi tidak bisa dihapus, hanya ditutup. Setiap baris absen menyimpan
// lokasi tempat orang itu absen; menghapus "Gudang Cikarang" akan membuat
// absen orang-orang yang bekerja di sana kehilangan tempatnya.
//
// Kiosk membaca daftar ini, dan alamat kiosk memilih lokasi lewat
// `#/absen?lokasi=2`. Lokasi yang ditutup tidak lagi muncul di pilihan itu.

import { api } from '../api.js';
import { esc, dialogFormulir } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, kepalaDaftar, tabel, lencanaStatus, pesanGalat, TOMBOL_BARIS } from '../tabel.js';

const PILIHAN_STATUS = [
  { nilai: 'true', label: 'Aktif' },
  { nilai: 'false', label: 'Nonaktif' },
];

export default {
  judul: 'Lokasi Kantor',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Lokasi Kantor' });

    isi.innerHTML = `
      <div class="${KARTU}">
        ${kepalaDaftar({ judul: 'Lokasi kantor', tambah: 'Tambah lokasi' })}
        <div data-daftar></div>
      </div>`;

    const kotakDaftar = isi.querySelector('[data-daftar]');
    const elJumlah = isi.querySelector('[data-jumlah]');

    let semua = [];
    let hidup = true;

    const kolom = [
      {
        judul: 'Lokasi',
        sel: (l) => `
          <span class="block leading-tight">
            <span class="block font-medium text-ink">${esc(l.nama)}</span>
            <span class="block text-xs text-muted">${esc(l.alamat || 'Alamat belum diisi')}</span>
          </span>`,
      },
      {
        judul: 'Anak magang',
        sel: (l) => `<span class="text-muted">${l.jumlah_magang} orang</span>`,
      },
      { judul: 'Status', sel: (l) => lencanaStatus(l.aktif) },
      {
        judul: '',
        kelas: 'text-right',
        sel: (l) => `
          <button type="button" data-ubah="${l.id}" class="${TOMBOL_BARIS} text-merek">Ubah</button>`,
      },
    ];

    function gambar() {
      elJumlah.textContent = `${semua.length} lokasi`;
      kotakDaftar.innerHTML = tabel({ kolom, baris: semua, kosong: 'Belum ada lokasi.' });
    }

    async function muat() {
      kotakDaftar.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat lokasi…</p>';
      elJumlah.textContent = 'Memuat…';

      let d;
      try {
        d = await api.get('/admin/lokasi');
      } catch (galat) {
        if (!hidup) return;
        elJumlah.textContent = 'Gagal dimuat';
        kotakDaftar.innerHTML = pesanGalat(galat.message);
        return;
      }

      if (!hidup) return;
      semua = d.data;
      gambar();
    }

    async function bukaForm(id) {
      const lokasi = id ? (semua.find((l) => l.id === id) ?? null) : null;
      const baru = !lokasi;

      const berhasil = await dialogFormulir({
        judul: baru ? 'Tambah lokasi' : `Ubah ${lokasi.nama}`,
        kolom: [
          {
            nama: 'nama',
            label: 'Nama lokasi',
            jenis: 'teks',
            wajib: true,
            lebar: 'penuh',
            contoh: 'Gudang Cikarang',
          },
          {
            nama: 'alamat',
            label: 'Alamat',
            jenis: 'teks',
            lebar: 'penuh',
            contoh: 'Jl. Industri Raya No. 8, Cikarang',
          },
          {
            nama: 'aktif',
            label: 'Status',
            jenis: 'pilih',
            pilihan: PILIHAN_STATUS,
            petunjuk: 'Lokasi nonaktif tidak lagi muncul di pilihan kiosk.',
          },
        ],
        nilai: lokasi ? { ...lokasi, aktif: String(lokasi.aktif) } : { aktif: 'true' },
        tombolKirim: baru ? 'Tambah' : 'Simpan',
        kirim: async (isian) => {
          if (baru) await api.post('/admin/lokasi', isian);
          else await api.put(`/admin/lokasi/${lokasi.id}`, isian);
        },
      });

      if (berhasil) await muat();
    }

    kotakDaftar.addEventListener('click', (e) => {
      const ubah = e.target.closest('[data-ubah]');
      if (ubah) bukaForm(Number(ubah.dataset.ubah));
    });

    isi.querySelector('[data-tambah]').addEventListener('click', () => bukaForm(null));

    muat();

    return () => {
      hidup = false;
    };
  },
};
