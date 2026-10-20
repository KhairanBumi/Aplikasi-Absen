// Riwayat absen (magang).
//
// Satu bulan penuh, satu baris per hari — termasuk hari Sabtu, Minggu, dan
// tanggal merah. Hari libur ikut ditampilkan dengan lencana abu-abu, bukan
// disembunyikan: tanggal yang bolong dari daftar membuat orang mengira ada
// catatan yang hilang, dan pertanyaannya sampai ke admin.
//
// Baris hariannya disusun server, bukan di sini.

import { api, pengguna } from '../api.js';
import { esc, labelBulan, bulanIni, geserBulan } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import {
  KARTU,
  tabel,
  pesanGalat,
  kartuAngka,
  pemilihBulan,
  kolomHarian,
} from '../tabel.js';

export default {
  judul: 'Riwayat Absen',

  mount(akar) {
    const aku = pengguna();
    const isi = pasangKerangka(akar, { judul: 'Riwayat Absen' });

    isi.innerHTML = `
      <div class="${KARTU} flex flex-wrap items-center justify-between gap-3 p-3 pl-5">
        <p class="text-sm font-medium text-ink">Bulan</p>
        ${pemilihBulan()}
      </div>

      <div data-ringkasan class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></div>

      <div class="${KARTU} mt-6">
        <h2 class="text-lg font-semibold tracking-tight text-ink">Catatan harian</h2>
        <p data-jumlah class="mt-0.5 text-sm text-muted">Memuat…</p>
        <div data-daftar></div>
      </div>`;

    const kotakRingkasan = isi.querySelector('[data-ringkasan]');
    const kotakDaftar = isi.querySelector('[data-daftar]');
    const elJumlah = isi.querySelector('[data-jumlah]');
    const elLabel = isi.querySelector('[data-label-bulan]');
    const tombolMundur = isi.querySelector('[data-bulan-mundur]');
    const tombolMaju = isi.querySelector('[data-bulan-maju]');

    // Boleh mundur sampai bulan pertama dia bekerja, tidak lebih. Sebelum itu
    // memang tidak ada catatan apa pun, dan halaman kosong yang terus bisa
    // dibuka ke belakang hanya membuat orang mengira datanya rusak.
    const batasAwal = String(aku?.masuk_kerja ?? '2000-01').slice(0, 7);
    const batasAkhir = bulanIni();
    let bulan = batasAkhir;
    let hidup = true;

    const kolom = kolomHarian();

    function gambarPemilih() {
      elLabel.textContent = labelBulan(bulan);
      tombolMundur.disabled = bulan <= batasAwal;
      tombolMaju.disabled = bulan >= batasAkhir;
    }

    function gambarRingkasan(r, hariKerja) {
      kotakRingkasan.innerHTML = [
        kartuAngka('Hadir', r.hadir, `dari ${hariKerja} hari kerja`, 'text-emerald-600'),
        kartuAngka(
          'Terlambat',
          r.telat,
          r.telat_menit > 0 ? `total ${r.telat_menit} menit` : 'tidak pernah terlambat',
          r.telat > 0 ? 'text-amber-600' : 'text-ink',
        ),
        kartuAngka('Izin & cuti', r.izin, 'hari yang sudah disetujui'),
        kartuAngka(
          'Tanpa catatan',
          r.alpha,
          r.alpha > 0 ? 'tidak ada absen masuk pada hari kerja' : 'tidak ada',
          r.alpha > 0 ? 'text-rose-600' : 'text-ink',
        ),
      ].join('');
    }

    async function muat() {
      gambarPemilih();
      elJumlah.textContent = 'Memuat…';
      kotakDaftar.innerHTML = '<p class="py-14 text-center text-sm text-muted">Memuat riwayat…</p>';

      let d;
      try {
        d = await api.get(`/saya/absen?bulan=${encodeURIComponent(bulan)}`);
      } catch (galat) {
        if (!hidup) return;
        elJumlah.textContent = 'Gagal dimuat';
        kotakRingkasan.innerHTML = '';
        kotakDaftar.innerHTML = pesanGalat(galat.message);
        return;
      }

      // Pengguna sudah berpindah bulan selagi menunggu jawaban.
      if (!hidup || d.bulan !== bulan) return;

      const kerja = d.data.filter((h) => h.status !== 'libur' && h.status !== 'belum').length;
      elJumlah.textContent =
        d.data.length === 0
          ? `Belum ada catatan pada ${labelBulan(bulan)}`
          : `${d.data.length} hari pada ${labelBulan(bulan)}`;

      gambarRingkasan(d.ringkasan, d.hari_kerja ?? kerja);
      kotakDaftar.innerHTML = tabel({
        kolom,
        baris: d.data,
        kosong: `Belum ada catatan absen pada ${labelBulan(bulan)}.`,
      });
    }

    tombolMundur.addEventListener('click', () => {
      bulan = geserBulan(bulan, -1);
      muat();
    });

    tombolMaju.addEventListener('click', () => {
      bulan = geserBulan(bulan, 1);
      muat();
    });

    muat();

    return () => {
      hidup = false;
    };
  },
};
