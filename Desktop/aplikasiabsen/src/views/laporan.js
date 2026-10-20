// Rekap & laporan (admin).
//
// Dua mode dalam satu layar: rekap sebulan untuk semua magang, dan rincian
// harian satu orang. Mode keduanya tidak membuka halaman baru — admin yang
// memeriksa satu nama hampir selalu ingin kembali ke daftarnya, dan halaman
// baru kehilangan bulan yang sedang dibuka.
//
// Satu hal soal angka: alpha dihitung dari hari kerja yang tidak punya catatan
// masuk DAN tidak tertutup izin. Magang yang berhenti di tengah bulan tetap
// dihitung sampai hari terakhir dia punya catatan, bukan sampai akhir bulan —
// kalau tidak, laporannya melaporkan orang yang sudah keluar sebagai mangkir
// selama dua minggu.

import { api } from '../api.js';
import {
  esc,
  inisial,
  labelBulan,
  bulanIni,
  geserBulan,
  beritahu,
} from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import {
  KARTU,
  tabel,
  pesanGalat,
  kartuAngka,
  pemilihBulan,
  kolomHarian,
  TOMBOL_BARIS,
  TOMBOL_HALUS,
} from '../tabel.js';

/**
 * Unduh sebagai berkas CSV.
 *
 * Pemisahnya titik koma, bukan koma. Excel di komputer berbahasa Indonesia
 * memakai koma sebagai pemisah desimal, jadi berkas berpemisah koma akan
 * membuka seluruh isinya di satu kolom. Titik koma adalah yang diharapkan
 * Excel di sana.
 *
 * BOM di depan ditulis eksplisit supaya huruf beraksen dan tanda baca Indonesia
 * tidak berubah jadi simbol aneh saat Excel menebak sendiri encoding-nya.
 */
function unduhCSV(namaBerkas, kepala, baris) {
  const sel = (nilai) => `"${String(nilai ?? '').replace(/"/g, '""')}"`;
  const isi = [kepala, ...baris].map((b) => b.map(sel).join(';')).join('\r\n');

  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(new Blob([`\ufeff${isi}`], { type: 'text/csv;charset=utf-8' }));
  tautan.download = namaBerkas;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();

  // URL-nya dicabut setelah jeda singkat. Melepasnya pada tick yang sama dengan
  // klik membatalkan unduhannya di sebagian browser.
  setTimeout(() => URL.revokeObjectURL(tautan.href), 2000);
}

export default {
  judul: 'Rekap & Laporan',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Rekap & Laporan' });
    isi.innerHTML = '<div data-laporan></div>';

    const kotak = isi.querySelector('[data-laporan]');

    const batasAkhir = bulanIni();

    // Batas mundur 24 bulan. Bukan batas server — server menerima bulan apa pun
    // — tapi batas tampilan: deretan bulan kosong yang bisa dibuka tanpa ujung
    // tidak memberi tahu apa pun selain bahwa datanya tidak ada.
    const batasAwal = geserBulan(batasAkhir, -23);
    let bulan = batasAkhir;
    let rekap = null; // balasan /admin/laporan
    let rincian = null; // balasan /admin/laporan/harian
    let detailId = null; // null berarti sedang menampilkan rekap
    let hidup = true;

    // ── Rekap sebulan ─────────────────────────────────────────────────────────

    function gambarRekap() {
      const r = rekap.ringkasan;

      // Penyebut kartu Kehadiran dijumlahkan dari tiap orang, bukan diambil dari
      // `rekap.hari_kerja` — kolom itu berisi jumlah hari kerja **di bulan itu**,
      // dan satuannya berbeda dari pembilangnya. Dengan data yang baru diisi,
      // "1 hari hadir dari 13 hari kerja" terbaca seolah 12 hari hilang, padahal
      // yang belum absen cuma satu orang yang baru bergabung hari ini.
      const hariMungkin = rekap.data.reduce((n, b) => n + b.hari_kerja, 0);

      kotak.innerHTML = `
        <div class="${KARTU} flex flex-wrap items-center justify-between gap-3 p-3 pl-5">
          <p class="text-sm font-medium text-ink">Bulan</p>
          ${pemilihBulan()}
        </div>

        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${kartuAngka('Kehadiran', r.hadir, `hari hadir dari ${hariMungkin} hari kerja`, 'text-emerald-600')}
          ${kartuAngka(
            'Keterlambatan',
            r.telat,
            r.telat_menit > 0 ? `total ${r.telat_menit} menit` : 'tidak ada',
            r.telat > 0 ? 'text-amber-600' : 'text-ink',
          )}
          ${kartuAngka('Izin & cuti', r.izin, 'hari yang sudah disetujui')}
          ${kartuAngka(
            'Tanpa catatan',
            r.alpha,
            r.alpha > 0 ? 'perlu ditanyakan ke anak magangnya' : 'tidak ada',
            r.alpha > 0 ? 'text-rose-600' : 'text-ink',
          )}
        </div>

        <div class="${KARTU} mt-6">
          <div class="flex flex-wrap items-start gap-3">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold tracking-tight text-ink">Rekap per anak magang</h2>
              <p class="mt-0.5 text-sm text-muted">${r.magang} anak magang pada ${esc(labelBulan(bulan))}</p>
            </div>
            <button type="button" data-unduh class="${TOMBOL_HALUS} ml-auto">Unduh CSV</button>
          </div>
          ${tabel({ kolom: kolomRekap(), baris: rekap.data, kosong: 'Belum ada data pada bulan ini.' })}
        </div>`;

      const p = elPemilih();
      p.mundur.disabled = bulan <= batasAwal;
      p.maju.disabled = bulan >= batasAkhir;
      p.label.textContent = labelBulan(bulan);
    }

    function kolomRekap() {
      return [
        {
          judul: 'Anak magang',
          sel: (u) => `
            <div class="flex items-center gap-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-full bg-merek/12 text-xs font-semibold text-merek">
                ${esc(inisial(u.nama))}
              </span>
              <span class="min-w-0 leading-tight">
                <span class="block truncate font-medium text-ink">
                  ${esc(u.nama)}${u.aktif ? '' : ' <span class="text-xs font-normal text-muted">(nonaktif)</span>'}
                </span>
                <span class="block truncate text-xs text-muted tabular-nums">${esc(u.nip)}</span>
              </span>
            </div>`,
        },
        { judul: 'Shift', sel: (u) => `<span class="text-muted">${esc(u.shift)}</span>` },
        { judul: 'Hadir', kelas: 'text-right', sel: (u) => `<span class="tabular-nums text-ink">${u.hadir}</span>` },
        {
          judul: 'Terlambat',
          kelas: 'text-right',
          sel: (u) =>
            u.telat === 0
              ? '<span class="text-muted">—</span>'
              : `<span class="tabular-nums text-amber-700">${u.telat}× · ${u.telat_menit} m</span>`,
        },
        {
          judul: 'Izin',
          kelas: 'text-right',
          sel: (u) => {
            const n = u.izin + u.cuti + u.sakit;
            return n === 0
              ? '<span class="text-muted">—</span>'
              : `<span class="tabular-nums text-ink" title="Izin ${u.izin}, cuti ${u.cuti}, sakit ${u.sakit}">${n}</span>`;
          },
        },
        {
          judul: 'Tanpa catatan',
          kelas: 'text-right',
          sel: (u) =>
            u.alpha === 0
              ? '<span class="text-muted">—</span>'
              : `<span class="font-medium tabular-nums text-rose-600">${u.alpha}</span>`,
        },
        {
          judul: '',
          kelas: 'text-right',
          sel: (u) => `<button type="button" data-detail="${u.pengguna_id}" class="${TOMBOL_BARIS} text-merek">Lihat</button>`,
        },
      ];
    }

    // ── Rincian satu orang ────────────────────────────────────────────────────

    function gambarDetail() {
      const p = rincian.pengguna;
      const hari = rincian.data;
      const hitung = (s) => hari.filter((h) => h.status === s).length;
      const hadir = hitung('tepat') + hitung('telat');
      const telatMenit = hari.reduce((n, h) => n + h.telat_menit, 0);

      kotak.innerHTML = `
        <div class="${KARTU}">
          <button type="button" data-kembali class="${TOMBOL_HALUS}">← Kembali ke rekap</button>

          <div class="mt-5 flex flex-wrap items-center gap-4">
            <span class="grid size-14 shrink-0 place-items-center rounded-full bg-merek text-base font-semibold text-white">
              ${esc(inisial(p.nama))}
            </span>
            <div class="min-w-0">
              <p class="text-xl font-semibold tracking-tight text-ink">${esc(p.nama)}</p>
              <p class="mt-0.5 text-sm text-muted">
                ${esc(p.nip)} · ${esc(p.divisi || '—')}
              </p>
            </div>
            <p class="ml-auto text-sm text-muted">${esc(labelBulan(bulan))}</p>
          </div>
        </div>

        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${kartuAngka('Hadir', hadir, `dari ${hari.filter((h) => h.status !== 'libur' && h.status !== 'belum').length} hari kerja`, 'text-emerald-600')}
          ${kartuAngka(
            'Terlambat',
            hitung('telat'),
            telatMenit > 0 ? `total ${telatMenit} menit` : 'tidak ada',
            hitung('telat') > 0 ? 'text-amber-600' : 'text-ink',
          )}
          ${kartuAngka('Izin & cuti', hitung('izin') + hitung('cuti') + hitung('sakit'), 'hari yang sudah disetujui')}
          ${kartuAngka(
            'Tanpa catatan',
            hitung('alpha'),
            hitung('alpha') > 0 ? 'perlu ditanyakan' : 'tidak ada',
            hitung('alpha') > 0 ? 'text-rose-600' : 'text-ink',
          )}
        </div>

        <div class="${KARTU} mt-6">
          <h2 class="text-lg font-semibold tracking-tight text-ink">Catatan harian</h2>
          <p class="mt-0.5 text-sm text-muted">${hari.length} hari pada ${esc(labelBulan(bulan))}</p>
          ${tabel({ kolom: kolomHarian(), baris: hari, kosong: 'Belum ada catatan pada bulan ini.' })}
        </div>`;
    }

    // ── Pemuatan ──────────────────────────────────────────────────────────────

    const elPemilih = () => ({
      mundur: kotak.querySelector('[data-bulan-mundur]'),
      maju: kotak.querySelector('[data-bulan-maju]'),
      label: kotak.querySelector('[data-label-bulan]'),
    });

    async function muatRekap() {
      kotak.innerHTML = `
        <div class="${KARTU} flex flex-wrap items-center justify-between gap-3 p-3 pl-5">
          <p class="text-sm font-medium text-ink">Bulan</p>
          ${pemilihBulan()}
        </div>
        <p class="py-16 text-center text-sm text-muted">Memuat rekap…</p>`;

      let d;
      try {
        d = await api.get(`/admin/laporan?bulan=${encodeURIComponent(bulan)}`);
      } catch (galat) {
        if (!hidup) return;
        // Pemilih bulannya tetap dipasang meski pemuatannya gagal. Tanpa itu,
        // satu bulan yang bermasalah mengunci admin di layar galat tanpa cara
        // pindah ke bulan lain.
        kotak.innerHTML = `
          <div class="${KARTU} flex flex-wrap items-center justify-between gap-3 p-3 pl-5">
            <p class="text-sm font-medium text-ink">Bulan</p>
            ${pemilihBulan()}
          </div>
          ${pesanGalat(galat.message)}`;

        const p = elPemilih();
        p.mundur.disabled = bulan <= batasAwal;
        p.maju.disabled = bulan >= batasAkhir;
        p.label.textContent = labelBulan(bulan);
        return;
      }

      if (!hidup || d.bulan !== bulan || detailId !== null) return;
      rekap = d;
      gambarRekap();
    }

    async function muatDetail(id) {
      detailId = id;
      kotak.innerHTML = `<p class="py-16 text-center text-sm text-muted">Memuat rincian…</p>`;

      let d;
      try {
        d = await api.get(`/admin/laporan/harian?bulan=${encodeURIComponent(bulan)}&pengguna_id=${id}`);
      } catch (galat) {
        if (!hidup) return;
        detailId = null;
        kotak.innerHTML = pesanGalat(galat.message);
        return;
      }

      if (!hidup || detailId !== id) return;
      rincian = d;
      gambarDetail();
    }

    // ── Aksi ──────────────────────────────────────────────────────────────────

    kotak.addEventListener('click', (e) => {
      const mundur = e.target.closest('[data-bulan-mundur]');
      if (mundur) {
        bulan = geserBulan(bulan, -1);
        muatRekap();
        return;
      }

      const maju = e.target.closest('[data-bulan-maju]');
      if (maju) {
        bulan = geserBulan(bulan, 1);
        muatRekap();
        return;
      }

      const detail = e.target.closest('[data-detail]');
      if (detail) {
        muatDetail(Number(detail.dataset.detail));
        return;
      }

      const kembali = e.target.closest('[data-kembali]');
      if (kembali) {
        detailId = null;
        if (rekap && rekap.bulan === bulan) gambarRekap();
        else muatRekap();
        return;
      }

      if (e.target.closest('[data-unduh]')) unduh();
    });

    async function unduh() {
      if (!rekap) return;

      try {
        unduhCSV(
          `rekap-absen-${bulan}.csv`,
          ['NIP', 'Nama', 'Divisi', 'NIK', 'Shift', 'Hadir', 'Terlambat', 'Menit terlambat', 'Izin', 'Cuti', 'Sakit', 'Tanpa catatan'],
          rekap.data.map((u) => [
            u.nip,
            u.nama,
            u.divisi,
            u.nik,
            u.shift,
            u.hadir,
            u.telat,
            u.telat_menit,
            u.izin,
            u.cuti,
            u.sakit,
            u.alpha,
          ]),
        );
      } catch {
        // Peramban bisa menolak mengunduh, dan itu bukan alasan menampilkan
        // layar galat. Yang perlu diketahui admin cuma bahwa berkasnya tidak
        // jadi tersimpan.
        await beritahu({
          judul: 'Berkas tidak bisa diunduh',
          pesan: 'Peramban menolak mengunduh berkasnya. Coba lagi atau periksa izin unduhan di peramban Anda.',
        });
      }
    }

    muatRekap();

    return () => {
      hidup = false;
    };
  },
};
