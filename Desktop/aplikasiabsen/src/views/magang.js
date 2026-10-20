// Data anak magang.
//
// Layar CRUD pertama di aplikasi. Polanya dipakai ulang oleh tiga layar data
// master berikutnya: kartu daftar, kotak cari yang menyaring di browser,
// formulir di dalam dialog, dan konfirmasi terpisah untuk hal yang berbahaya.
//
// Dua hal sengaja TIDAK ada di layar ini:
//
// - Menghapus magang. Riwayat absennya akan menggantung tanpa pemiliknya.
//   Yang tersedia adalah menonaktifkan, dan riwayatnya tetap utuh.
// - Menampilkan PIN. Server tidak pernah mengirimkannya ke browser; formulir
//   ini hanya bisa MENGISI PIN baru, tidak pernah membacanya kembali.

import { api, pengguna } from '../api.js';
import { esc, inisial, dialogFormulir, konfirmasi, beritahu } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import { KARTU, kepalaDaftar, tabel, lencanaStatus, pesanGalat, TOMBOL_BARIS } from '../tabel.js';

/** Hari ini menurut jam kantor, bentuk YYYY-MM-DD. */
const hariIniISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default {
  judul: 'Anak Magang',

  mount(akar) {
    const aku = pengguna();
    const isi = pasangKerangka(akar, { judul: 'Anak Magang' });

    isi.innerHTML = `
      <div class="${KARTU}">
        ${kepalaDaftar({
          judul: 'Data anak magang',
          tambah: 'Tambah anak magang',
          contohCari: 'Cari nama, NIP, NIK, atau divisi',
        })}
        <div data-daftar></div>
      </div>`;

    const kotakDaftar = isi.querySelector('[data-daftar]');
    const elJumlah = isi.querySelector('[data-jumlah]');
    const kotakCari = isi.querySelector('[data-cari]');

    let semua = [];
    // Daftar divisi yang sah datang bersama daftarnya, bukan ditulis di sini.
    // Menambah divisi keempat nanti cukup dikerjakan di backend.
    let daftarDivisi = [];
    let pendukung = null;
    let hidup = true;
    let cari = '';

    const MEMUAT = '<p class="py-14 text-center text-sm text-muted">Memuat data anak magang…</p>';

    const kolom = [
      {
        judul: 'Nama',
        sel: (u) => `
          <div class="flex items-center gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-merek/12 text-xs font-semibold text-merek">
              ${esc(inisial(u.nama))}
            </span>
            <span class="min-w-0 leading-tight">
              <span class="block truncate font-medium text-ink">${esc(u.nama)}</span>
              <span class="block truncate text-xs text-muted">${esc(u.email)}</span>
            </span>
          </div>`,
      },
      {
        // NIP dan NIK berdampingan di satu sel: NIP yang dicari, NIK yang
        // dibaca mata. Dua-duanya nomor, jadi kolom kedelapan cuma melebarkan
        // tabel tanpa menambah informasi.
        judul: 'NIP',
        sel: (u) => `
          <span class="block leading-tight">
            <span class="block tabular-nums text-muted">${esc(u.nip)}</span>
            ${u.nik ? `<span class="block text-xs tabular-nums text-faint">${esc(u.nik)}</span>` : ''}
          </span>`,
      },
      { judul: 'Divisi', sel: (u) => `<span class="text-ink">${esc(u.divisi || '—')}</span>` },
      { judul: 'Shift', sel: (u) => `<span class="text-muted">${esc(u.shift ?? '—')}</span>` },
      { judul: 'Lokasi', sel: (u) => `<span class="text-muted">${esc(u.lokasi ?? '—')}</span>` },
      { judul: 'Status', sel: (u) => lencanaStatus(u.aktif) },
      {
        judul: '',
        kelas: 'text-right',
        sel: (u) => `
          <div class="flex justify-end gap-1">
            <button type="button" data-ubah="${u.id}" class="${TOMBOL_BARIS} text-merek">Ubah</button>
            ${
              // Menonaktifkan akun sendiri akan mengunci admin keluar dari
              // layar ini, dan tidak ada siapa pun yang bisa mengembalikannya.
              // Server menolaknya juga; di sini tombolnya tidak ditawarkan.
              u.id === aku.id
                ? ''
                : `<button type="button" data-status="${u.id}"
                           class="${TOMBOL_BARIS} ${u.aktif ? 'text-rose-600' : 'text-emerald-700'}">
                     ${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                   </button>`
            }
          </div>`,
      },
    ];

    function tersaring() {
      const kata = cari.trim().toLowerCase();
      if (!kata) return semua;
      return semua.filter((u) =>
        [u.nama, u.nip, u.nik, u.email, u.divisi].some((t) =>
          String(t ?? '').toLowerCase().includes(kata),
        ),
      );
    }

    function gambar() {
      const baris = tersaring();
      const aktif = semua.filter((u) => u.aktif).length;

      elJumlah.textContent = cari
        ? `${baris.length} dari ${semua.length} anak magang`
        : `${aktif} aktif dari ${semua.length} anak magang`;

      kotakDaftar.innerHTML = tabel({
        kolom,
        baris,
        // Keadaan kosong inilah yang pertama dilihat admin di aplikasi ini —
        // daftarnya memang belum diisi siapa-siapa. Karena itu pesannya
        // menunjuk tombolnya, bukan cuma menyatakan tidak ada isi.
        kosong: cari
          ? `Tidak ada anak magang yang cocok dengan "${cari}".`
          : 'Belum ada anak magang. Tambahkan yang pertama lewat tombol di atas.',
      });
    }

    async function muat() {
      kotakDaftar.innerHTML = MEMUAT;
      elJumlah.textContent = 'Memuat…';

      let d;
      try {
        d = await api.get('/admin/magang');
      } catch (galat) {
        if (!hidup) return;
        elJumlah.textContent = 'Gagal dimuat';
        kotakDaftar.innerHTML = pesanGalat(galat.message);
        return;
      }

      if (!hidup) return;
      semua = d.data;
      daftarDivisi = d.divisi ?? [];
      gambar();
    }

    async function ambilPendukung() {
      if (pendukung) return pendukung;
      const [s, l] = await Promise.all([api.get('/admin/shift'), api.get('/admin/lokasi')]);
      pendukung = { shift: s.data, lokasi: l.data };
      return pendukung;
    }

    async function bukaForm(id) {
      const orang = id ? (semua.find((u) => u.id === id) ?? null) : null;
      const baru = !orang;

      let dukung;
      try {
        dukung = await ambilPendukung();
      } catch (galat) {
        await beritahu({ judul: 'Formulir tidak bisa dibuka', pesan: galat.message });
        return;
      }

      // Pilihan hanya memuat lokasi dan shift yang masih aktif, kecuali yang
      // sedang dipakai orang ini — supaya membuka data lama tidak diam-diam
      // memindahkan dia ke lokasi atau shift lain.
      const pilihShift = dukung.shift
        .filter((s) => s.aktif || s.id === orang?.shift_id)
        .map((s) => ({ nilai: String(s.id), label: `${s.nama} · ${s.masuk}–${s.pulang}` }));

      const pilihLokasi = dukung.lokasi
        .filter((l) => l.aktif || l.id === orang?.lokasi_id)
        .map((l) => ({ nilai: String(l.id), label: l.nama }));

      const pilihPeran =
        orang?.id === aku.id
          ? [{ nilai: 'admin', label: 'Admin' }]
          : [
              { nilai: 'magang', label: 'Anak magang' },
              { nilai: 'admin', label: 'Admin' },
            ];

      const berhasil = await dialogFormulir({
        judul: baru ? 'Tambah anak magang' : `Ubah data ${orang.nama}`,
        keterangan: baru
          ? 'Anak magang ini langsung bisa absen di kiosk dan masuk aplikasi dengan NIP dan PIN di bawah.'
          : 'Kosongkan PIN kalau tidak ingin menggantinya.',
        kolom: [
          { nama: 'nama', label: 'Nama lengkap', jenis: 'teks', wajib: true, lebar: 'penuh', contoh: 'Andi Prasetyo' },
          {
            nama: 'nip',
            label: 'NIP',
            jenis: 'teks',
            wajib: true,
            contoh: 'MGG001',
            petunjuk: 'Diketik sendiri oleh anak magang di kiosk.',
          },
          {
            nama: 'nik',
            label: 'NIK',
            jenis: 'teks',
            contoh: '16 angka sesuai KTP',
            petunjuk: 'Boleh dikosongkan. Kalau diisi, harus 16 angka.',
          },
          {
            nama: 'email',
            label: 'Email',
            jenis: 'email',
            contoh: 'andi@kantor.id',
            petunjuk: 'Boleh dikosongkan. Tidak dipakai untuk masuk.',
          },
          {
            nama: 'divisi',
            label: 'Divisi',
            jenis: 'pilih',
            wajib: true,
            // Pilihan pertama sengaja kosong. Kalau daftarnya langsung mulai
            // dari "Pendataan", admin yang melewatkan kolom ini akan
            // menempatkan orang di Pendataan tanpa pernah memutuskannya — dan
            // salah divisi baru ketahuan saat rekapnya ditanyakan.
            pilihan: [
              { nilai: '', label: 'Pilih divisi…' },
              ...daftarDivisi.map((n) => ({ nilai: n, label: n })),
            ],
          },
          {
            nama: 'peran',
            label: 'Peran',
            jenis: 'pilih',
            pilihan: pilihPeran,
            petunjuk: 'Admin bisa membuka seluruh layar di aplikasi ini.',
          },
          { nama: 'shift_id', label: 'Shift kerja', jenis: 'pilih', pilihan: pilihShift, wajib: true },
          { nama: 'lokasi_id', label: 'Lokasi kerja', jenis: 'pilih', pilihan: pilihLokasi, wajib: true },
          {
            nama: 'masuk_kerja',
            label: 'Tanggal masuk',
            jenis: 'tanggal',
            wajib: true,
            petunjuk: 'Dipakai untuk menghitung alpha dan jatah cuti.',
          },
          { nama: 'cuti_kuota', label: 'Jatah cuti setahun', jenis: 'angka', min: '0', contoh: '12' },
          {
            nama: 'pin',
            label: baru ? 'PIN kiosk' : 'PIN baru',
            jenis: 'teks',
            wajib: baru,
            contoh: '4 sampai 6 angka',
            petunjuk: baru
              ? 'Dipakai untuk absen di kiosk sekaligus masuk aplikasi. 4–6 angka, jangan beritahu orang lain.'
              : 'Kosongkan kalau tidak diganti. PIN lama tidak bisa dilihat.',
          },
        ],
        nilai: orang ?? {
          peran: 'magang',
          divisi: '',
          cuti_kuota: '12',
          masuk_kerja: hariIniISO(),
          shift_id: String(dukung.shift.find((s) => s.aktif)?.id ?? ''),
          lokasi_id: String(dukung.lokasi.find((l) => l.aktif)?.id ?? ''),
        },
        tombolKirim: baru ? 'Tambah' : 'Simpan',
        kirim: async (isian) => {
          if (baru) await api.post('/admin/magang', isian);
          else await api.put(`/admin/magang/${orang.id}`, isian);
        },
      });

      if (berhasil) await muat();
    }

    async function ubahStatus(id) {
      const orang = semua.find((u) => u.id === id);
      if (!orang) return;

      const mematikan = orang.aktif;
      const yakin = await konfirmasi({
        judul: mematikan ? `Nonaktifkan ${orang.nama}?` : `Aktifkan kembali ${orang.nama}?`,
        pesan: mematikan
          ? 'Akunnya tidak bisa dipakai masuk lagi, tetapi seluruh riwayat absennya tetap tersimpan dan tetap muncul di laporan.'
          : 'Akunnya bisa dipakai masuk dan absen lagi seperti sebelumnya.',
        tombol: mematikan ? 'Nonaktifkan' : 'Aktifkan',
        bahaya: mematikan,
      });
      if (!yakin) return;

      try {
        // Endpoint ubah bersifat menambal: cukup kirim kolom yang berubah.
        await api.put(`/admin/magang/${id}`, { aktif: !orang.aktif });
      } catch (galat) {
        await beritahu({ judul: 'Tidak bisa diubah', pesan: galat.message });
        return;
      }

      await muat();
    }

    // Satu pendengar untuk seluruh tabel: barisnya digambar ulang setiap kali
    // daftarnya dimuat, jadi pendengar yang dipasang per baris akan hilang.
    kotakDaftar.addEventListener('click', (e) => {
      const ubah = e.target.closest('[data-ubah]');
      if (ubah) {
        bukaForm(Number(ubah.dataset.ubah));
        return;
      }
      const status = e.target.closest('[data-status]');
      if (status) ubahStatus(Number(status.dataset.status));
    });

    isi.querySelector('[data-tambah]').addEventListener('click', () => bukaForm(null));

    let jedaCari = null;
    kotakCari.addEventListener('input', () => {
      cari = kotakCari.value;
      // Ditahan sebentar: menggambar ulang tabel pada tiap ketikan membuat
      // kotak cari kehilangan fokus di sebagian browser.
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
