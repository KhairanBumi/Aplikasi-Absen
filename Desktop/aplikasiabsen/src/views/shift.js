// Shift kerja.
//
// Satu shift adalah tiga angka: jam masuk, jam pulang, dan toleransi
// keterlambatan. Angka ketiga itulah yang membedakan "tepat waktu" dan
// "telat" di seluruh laporan.
//
// Mengubah toleransi berlaku untuk absen BERIKUTNYA, bukan untuk yang sudah
// terjadi: `telat_menit` dihitung sekali saat orang menempelkan PIN-nya, lalu
// disimpan di baris absennya. Kalau dihitung ulang tiap kali laporan dibuka,
// mengubah shift besok akan menulis ulang status telat kemarin — dan itu tidak
// bisa dipertanggungjawabkan ke magang.

import { api } from '../api.js';
import { esc, dialogFormulir, konfirmasi, beritahu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, kepalaDaftar, tabel, lencanaStatus, pesanGalat, TOMBOL_BARIS } from '../tabel.js';

const PILIHAN_STATUS = [
  { nilai: 'true', label: 'Aktif' },
  { nilai: 'false', label: 'Nonaktif' },
];

export default {
  judul: 'Shift Kerja',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Shift Kerja' });

    isi.innerHTML = `
      <div class="${KARTU}">
        ${kepalaDaftar({ judul: 'Shift kerja', tambah: 'Tambah shift' })}
        <div data-daftar></div>
      </div>`;

    const kotakDaftar = isi.querySelector('[data-daftar]');
    const elJumlah = isi.querySelector('[data-jumlah]');

    let semua = [];
    let hidup = true;

    const kolom = [
      {
        judul: 'Shift',
        sel: (s) => `<span class="font-medium text-ink">${esc(s.nama)}</span>`,
      },
      {
        judul: 'Jam kerja',
        // Titik dua diganti titik: jam ditulis "08.00" di seluruh aplikasi ini,
        // dan "08:00" di sebelahnya akan terlihat seperti dua gaya berbeda.
        sel: (s) => `
          <span class="tabular-nums text-ink">${esc(s.masuk.replace(':', '.'))} – ${esc(s.pulang.replace(':', '.'))}</span>`,
      },
      {
        judul: 'Toleransi',
        sel: (s) =>
          s.toleransi_menit === 0
            ? '<span class="text-muted">tanpa toleransi</span>'
            : `<span class="text-muted">${s.toleransi_menit} menit</span>`,
      },
      { judul: 'Anak magang', sel: (s) => `<span class="text-muted">${s.jumlah_magang} orang</span>` },
      { judul: 'Status', sel: (s) => lencanaStatus(s.aktif) },
      {
        judul: '',
        kelas: 'text-right',
        sel: (s) => `
          <div class="flex justify-end gap-1">
            <button type="button" data-ubah="${s.id}" class="${TOMBOL_BARIS} text-merek">Ubah</button>
            <button type="button" data-hapus="${s.id}" class="${TOMBOL_BARIS} text-rose-600">Hapus</button>
          </div>`,
      },
    ];

    function gambar() {
      elJumlah.textContent = `${semua.length} shift`;
      kotakDaftar.innerHTML = tabel({
        kolom,
        baris: semua,
        kosong: 'Belum ada shift. Tanpa shift, tidak ada yang bisa dinilai telat.',
      });
    }

    async function muat() {
      kotakDaftar.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat shift…</p>';
      elJumlah.textContent = 'Memuat…';

      let d;
      try {
        d = await api.get('/admin/shift');
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
      const giliran = id ? (semua.find((s) => s.id === id) ?? null) : null;
      const baru = !giliran;

      const berhasil = await dialogFormulir({
        judul: baru ? 'Tambah shift' : `Ubah shift ${giliran.nama}`,
        keterangan: 'Perubahan berlaku untuk absen berikutnya, tidak mengubah yang sudah tercatat.',
        kolom: [
          { nama: 'nama', label: 'Nama shift', jenis: 'teks', wajib: true, lebar: 'penuh', contoh: 'Reguler' },
          { nama: 'masuk', label: 'Jam masuk', jenis: 'jam', wajib: true },
          { nama: 'pulang', label: 'Jam pulang', jenis: 'jam', wajib: true },
          {
            nama: 'toleransi_menit',
            label: 'Toleransi (menit)',
            jenis: 'angka',
            min: '0',
            contoh: '15',
            petunjuk: 'Masuk dalam rentang ini belum dihitung telat.',
          },
          {
            nama: 'aktif',
            label: 'Status',
            jenis: 'pilih',
            pilihan: PILIHAN_STATUS,
            petunjuk: 'Shift nonaktif tidak lagi muncul di pilihan anak magang baru.',
          },
        ],
        nilai: giliran
          ? { ...giliran, aktif: String(giliran.aktif), toleransi_menit: String(giliran.toleransi_menit) }
          : { aktif: 'true', masuk: '08:00', pulang: '17:00', toleransi_menit: '15' },
        tombolKirim: baru ? 'Tambah' : 'Simpan',
        kirim: async (isian) => {
          if (baru) await api.post('/admin/shift', isian);
          else await api.put(`/admin/shift/${giliran.id}`, isian);
        },
      });

      if (berhasil) await muat();
    }

    async function hapus(id) {
      const giliran = semua.find((s) => s.id === id);
      if (!giliran) return;

      const jam = `${giliran.masuk.replace(':', '.')}–${giliran.pulang.replace(':', '.')}`;
      const yakin = await konfirmasi({
        judul: `Hapus shift ${giliran.nama}?`,
        pesan: `Shift ${jam} hilang dari daftar dan tidak bisa dikembalikan. Kalau masih ada yang memakainya, aplikasi akan menolak dan menyarankan Nonaktifkan.`,
        tombol: 'Hapus',
        bahaya: true,
      });
      if (!yakin) return;

      try {
        await api.del(`/admin/shift/${id}`);
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

    muat();

    return () => {
      hidup = false;
    };
  },
};
