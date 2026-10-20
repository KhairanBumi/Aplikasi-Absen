// Izin & cuti (magang).
//
// Layar pribadi: sisa jatah cuti di atas, daftar pengajuan sendiri di bawah,
// satu tombol untuk mengajukan yang baru.
//
// Yang perlu diperhatikan soal jatah: hanya `cuti` yang memotongnya. Izin dan
// sakit tidak, dan itu memang beda — sakit yang menunggu izin atasan bukan cuti
// yang diambil. Kalau ketiganya dihitung sebagai cuti, sisa jatahnya akan habis
// jauh sebelum tahun berganti dan tidak ada yang tahu kenapa.

import { api } from '../api.js';
import { esc, tanggal, tanggalPanjang, dialogFormulir, beritahu, bulanIni } from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import {
  KARTU,
  pesanGalat,
  lencanaJenis,
  lencanaPengajuan,
  TOMBOL_UTAMA,
} from '../tabel.js';

const IKON_PLUS = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M12 6v12" /><path d="M6 12h12" />
  </svg>`;

const IKON_KOSONG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round" class="size-7" aria-hidden="true">
    <path d="M6.5 3.5h7.2l4.8 4.8V20a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
    <path d="M13.5 3.5v5h5" />
  </svg>`;

/** Hari ini menurut jam kantor, bentuk YYYY-MM-DD. */
const hariIniISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

/** Besok, bentuk YYYY-MM-DD. */
function besokISO() {
  const d = new Date(`${hariIniISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "22 Okt 2026", atau "22 – 24 Okt 2026" kalau lebih dari sehari. */
function rentang(mulai, selesai) {
  if (mulai === selesai) return tanggalPanjang(mulai);
  return `${tanggal(mulai)} – ${tanggal(selesai)}`;
}

export default {
  judul: 'Izin & Cuti',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Izin & Cuti' });

    isi.innerHTML = `
      <div class="${KARTU}">
        <div class="flex flex-wrap items-start gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold tracking-tight text-ink">Jatah cuti</h2>
            <p data-kuota-teks class="mt-0.5 text-sm text-muted">Memuat…</p>
          </div>
          <button type="button" data-ajukan class="${TOMBOL_UTAMA} ml-auto">
            ${IKON_PLUS}<span>Ajukan</span>
          </button>
        </div>

        <div class="mt-5 h-2 overflow-hidden rounded-full bg-ink/8">
          <div data-kuota-bar
               class="h-full rounded-full bg-merek transition-all duration-700 ease-apple"
               style="width: 0%"></div>
        </div>

        <div class="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted">
          <span>Terpakai <b data-terpakai class="font-semibold tabular-nums text-ink">0</b> hari</span>
          <span>Menunggu <b data-menunggu class="font-semibold tabular-nums text-ink">0</b> hari</span>
          <span>Sisa <b data-sisa class="font-semibold tabular-nums text-merek">0</b> hari</span>
        </div>
      </div>

      <div class="${KARTU} mt-5">
        <h2 class="text-lg font-semibold tracking-tight text-ink">Pengajuan saya</h2>
        <p data-jumlah class="mt-0.5 text-sm text-muted">Memuat…</p>
        <div data-daftar class="mt-5"></div>
      </div>`;

    const elKuotaTeks = isi.querySelector('[data-kuota-teks]');
    const elBar = isi.querySelector('[data-kuota-bar]');
    const elTerpakai = isi.querySelector('[data-terpakai]');
    const elMenunggu = isi.querySelector('[data-menunggu]');
    const elSisa = isi.querySelector('[data-sisa]');
    const elJumlah = isi.querySelector('[data-jumlah]');
    const kotakDaftar = isi.querySelector('[data-daftar]');

    let daftar = [];
    let kuota = { jatah: 0, terpakai: 0, menunggu: 0, sisa: 0 };
    let hidup = true;

    function gambarKuota() {
      const tahun = bulanIni().slice(0, 4);
      const persen = kuota.jatah > 0 ? Math.min(100, (kuota.terpakai / kuota.jatah) * 100) : 0;

      elKuotaTeks.textContent = `${kuota.terpakai} dari ${kuota.jatah} hari terpakai sepanjang ${tahun}`;
      elBar.style.width = `${persen}%`;
      elTerpakai.textContent = kuota.terpakai;
      elMenunggu.textContent = kuota.menunggu;
      elSisa.textContent = kuota.sisa;

      // Bar yang penuh adalah kabar baik sekaligus kabar buruk, dan warnanya
      // yang membedakan. Angka yang sama dibaca orang dengan dua cara.
      elBar.className =
        'h-full rounded-full transition-all duration-700 ease-apple ' +
        (kuota.sisa === 0 ? 'bg-rose-500' : 'bg-merek');
    }

    function kartuPengajuan(z) {
      return `
        <li class="rounded-2xl bg-white/55 p-4 ring-1 ring-ink/8">
          <div class="flex flex-wrap items-center gap-2">
            ${lencanaJenis(z.jenis)}
            ${lencanaPengajuan(z.status)}
          </div>

          <p class="mt-2.5 font-medium text-ink">${esc(rentang(z.mulai, z.selesai))}</p>
          <p class="mt-0.5 text-sm text-muted">
            ${z.hari_kerja} hari kerja · diajukan ${esc(tanggal(z.diajukan))}
          </p>

          <p class="mt-2.5 text-sm text-ink">${esc(z.alasan)}</p>

          ${
            z.catatan_admin
              ? `<p class="mt-2.5 rounded-xl bg-ink/5 px-3 py-2 text-sm text-muted">
                   <span class="font-medium text-ink">Catatan admin:</span> ${esc(z.catatan_admin)}
                 </p>`
              : ''
          }
        </li>`;
    }

    function gambar() {
      elJumlah.textContent =
        daftar.length === 0
          ? 'Belum pernah mengajukan'
          : `${daftar.length} pengajuan, ${daftar.filter((z) => z.status === 'menunggu').length} menunggu keputusan`;

      kotakDaftar.innerHTML =
        daftar.length === 0
          ? `<div class="flex flex-col items-center rounded-2xl bg-white/45 px-6 py-12 text-center ring-1 ring-ink/8">
               <span class="grid size-14 place-items-center rounded-full bg-white/70 text-muted ring-1 ring-ink/8">
                 ${IKON_KOSONG}
               </span>
               <p class="mt-4 font-medium text-ink">Belum ada pengajuan</p>
               <p class="mt-1 max-w-sm text-sm text-muted">
                 Pengajuan cuti, izin, dan sakit dibuat lewat tombol Ajukan di atas.
               </p>
             </div>`
          : `<ul class="grid gap-3">${daftar.map(kartuPengajuan).join('')}</ul>`;
    }

    async function muat() {
      elKuotaTeks.textContent = 'Memuat…';
      elJumlah.textContent = 'Memuat…';
      kotakDaftar.innerHTML = '<p class="py-12 text-center text-sm text-muted">Memuat pengajuan…</p>';

      let d;
      try {
        d = await api.get('/saya/izin');
      } catch (galat) {
        if (!hidup) return;
        elKuotaTeks.textContent = 'Gagal dimuat';
        elJumlah.textContent = 'Gagal dimuat';
        kotakDaftar.innerHTML = pesanGalat(galat.message);
        return;
      }

      if (!hidup) return;
      daftar = d.data;
      kuota = d.kuota;
      gambarKuota();
      gambar();
    }

    async function ajukan() {
      const hariIni = hariIniISO();
      const besok = besokISO();

      const berhasil = await dialogFormulir({
        judul: 'Ajukan izin atau cuti',
        keterangan:
          'Pengajuannya masuk ke admin untuk diputuskan. Sisa cuti Anda ' +
          `${kuota.sisa} hari, dan cuti yang masih menunggu keputusan tetap dihitung.`,
        kolom: [
          {
            nama: 'jenis',
            label: 'Jenis',
            jenis: 'pilih',
            pilihan: [
              { nilai: 'cuti', label: `Cuti — memotong jatah (sisa ${kuota.sisa} hari)` },
              { nilai: 'izin', label: 'Izin — keperluan di luar kantor' },
              { nilai: 'sakit', label: 'Sakit' },
            ],
            wajib: true,
            petunjuk: 'Hanya cuti yang mengurangi jatah.',
          },
          { nama: 'mulai', label: 'Mulai tanggal', jenis: 'tanggal', wajib: true },
          {
            nama: 'selesai',
            label: 'Sampai tanggal',
            jenis: 'tanggal',
            wajib: true,
            min: hariIni,
            petunjuk: 'Isi tanggal yang sama kalau cuma sehari.',
          },
          {
            nama: 'alasan',
            label: 'Alasan',
            jenis: 'panjang',
            wajib: true,
            lebar: 'penuh',
            contoh: 'Acara keluarga di luar kota.',
          },
        ],
        // Diisi besok, bukan hari ini. Cuti dan izin hampir selalu direncanakan
        // lebih dulu, sedangkan hari ini biasanya sudah ada catatan absennya —
        // dan mengajukan izin untuk hari yang sudah dimasuki ditolak server.
        nilai: { jenis: 'cuti', mulai: besok, selesai: besok },
        tombolKirim: 'Kirim pengajuan',
        kirim: (isian) => api.post('/saya/izin', isian),
      });

      if (!berhasil) return;

      await muat();
      await beritahu({
        judul: 'Pengajuan terkirim',
        pesan: 'Pengajuan Anda sudah masuk dan menunggu keputusan admin. Hasilnya bisa dilihat di layar ini.',
      });
    }

    isi.querySelector('[data-ajukan]').addEventListener('click', ajukan);

    muat();

    return () => {
      hidup = false;
    };
  },
};
