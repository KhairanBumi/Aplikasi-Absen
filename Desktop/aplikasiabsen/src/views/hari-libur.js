// Hari libur.
//
// Data master yang boleh dihapus tanpa syarat: tidak ada yang merujuknya, dia
// cuma penanda tanggal. Tanggal yang salah tulis justru harus bisa dibuang,
// bukan cuma ditandai tidak aktif.
//
// Daftar ini dipakai bersama oleh dashboard, rekap magang, dan hitungan
// alpha. Hari yang terdaftar di sini dikeluarkan dari hari kerja, jadi pada
// tanggal itu tidak ada yang dianggap "belum absen" dan tidak ada yang
// dihitung alpha.

import { api } from '../api.js';
import { esc, tanggalPanjang, dialogFormulir, konfirmasi, beritahu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, kepalaDaftar, tabel, pesanGalat, TOMBOL_BARIS } from '../tabel.js';

const hariIniISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default {
  judul: 'Hari Libur',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Hari Libur' });

    isi.innerHTML = `
      <div class="${KARTU}">
        ${kepalaDaftar({
          judul: 'Hari libur',
          tambah: 'Tambah hari libur',
          contohCari: 'Cari keterangan atau tanggal',
        })}
        <div data-daftar></div>
      </div>`;

    const kotakDaftar = isi.querySelector('[data-daftar]');
    const elJumlah = isi.querySelector('[data-jumlah]');
    const kotakCari = isi.querySelector('[data-cari]');

    let semua = [];
    let hidup = true;
    let cari = '';

    const kolom = [
      {
        judul: 'Tanggal',
        sel: (h) => `<span class="text-ink">${esc(tanggalPanjang(h.tanggal))}</span>`,
      },
      { judul: 'Keterangan', sel: (h) => `<span class="text-muted">${esc(h.keterangan)}</span>` },
      {
        judul: '',
        kelas: 'text-right',
        sel: (h) => `
          <div class="flex justify-end gap-1">
            <button type="button" data-ubah="${h.id}" class="${TOMBOL_BARIS} text-merek">Ubah</button>
            <button type="button" data-hapus="${h.id}" class="${TOMBOL_BARIS} text-rose-600">Hapus</button>
          </div>`,
      },
    ];

    function tersaring() {
      const kata = cari.trim().toLowerCase();
      if (!kata) return semua;
      return semua.filter((h) =>
        `${h.tanggal} ${tanggalPanjang(h.tanggal)} ${h.keterangan}`.toLowerCase().includes(kata),
      );
    }

    function gambar() {
      const baris = tersaring();
      elJumlah.textContent = cari
        ? `${baris.length} dari ${semua.length} hari libur`
        : `${semua.length} hari libur terdaftar`;
      kotakDaftar.innerHTML = tabel({
        kolom,
        baris,
        kosong: cari
          ? `Tidak ada hari libur yang cocok dengan "${cari}".`
          : 'Belum ada hari libur. Sabtu dan Minggu sudah otomatis libur.',
      });
    }

    async function muat() {
      kotakDaftar.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat hari libur…</p>';
      elJumlah.textContent = 'Memuat…';

      let d;
      try {
        d = await api.get('/admin/hari-libur');
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
      const libur = id ? (semua.find((h) => h.id === id) ?? null) : null;
      const baru = !libur;

      const berhasil = await dialogFormulir({
        judul: baru ? 'Tambah hari libur' : 'Ubah hari libur',
        keterangan: 'Sabtu dan Minggu tidak perlu didaftarkan di sini — keduanya sudah libur dengan sendirinya.',
        kolom: [
          { nama: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true },
          {
            nama: 'keterangan',
            label: 'Keterangan',
            jenis: 'teks',
            wajib: true,
            lebar: 'penuh',
            contoh: 'Hari Raya Idul Fitri',
          },
        ],
        nilai: libur ?? { tanggal: hariIniISO() },
        tombolKirim: baru ? 'Tambah' : 'Simpan',
        kirim: async (isian) => {
          if (baru) await api.post('/admin/hari-libur', isian);
          else await api.put(`/admin/hari-libur/${libur.id}`, isian);
        },
      });

      if (berhasil) await muat();
    }

    async function hapus(id) {
      const libur = semua.find((h) => h.id === id);
      if (!libur) return;

      const yakin = await konfirmasi({
        judul: `Hapus ${libur.keterangan}?`,
        pesan: `${tanggalPanjang(libur.tanggal)} akan dihitung sebagai hari kerja lagi, dan anak magang yang tidak masuk pada tanggal itu akan terhitung alpha.`,
        tombol: 'Hapus',
        bahaya: true,
      });
      if (!yakin) return;

      try {
        await api.del(`/admin/hari-libur/${id}`);
      } catch (galat) {
        await beritahu({ judul: 'Tidak bisa dihapus', pesan: galat.message });
        return;
      }

      await muat();
    }

    kotakDaftar.addEventListener('click', (e) => {
      const ubah = e.target.closest('[data-ubah]');
      if (ubah) {
        bukaForm(Number(ubah.dataset.ubah));
        return;
      }
      const tombolHapus = e.target.closest('[data-hapus]');
      if (tombolHapus) hapus(Number(tombolHapus.dataset.hapus));
    });

    isi.querySelector('[data-tambah]').addEventListener('click', () => bukaForm(null));

    let jedaCari = null;
    kotakCari.addEventListener('input', () => {
      cari = kotakCari.value;
      clearTimeout(jedaCari);
      jedaCari = setTimeout(gambar, 120);
    });

    muat();

    return () => {
      hidup = false;
      clearTimeout(jedaCari);
    };
  },
};
