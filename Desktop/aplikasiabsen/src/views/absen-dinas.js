// Absen dinas luar (magang).
//
// Jalur pribadi, bukan kiosk: identitas datang dari token sesi, jadi tidak ada
// NIP/PIN yang diketik ulang dan tidak ada perangkat kiosk yang perlu didaftar.
// Semua absen di sini berstatus `menunggu` sampai admin memutuskan.
//
// Urutan sesi ditentukan server: `masuk` dulu, lalu `pulang`. Layar ini hanya
// membaca keadaan hari ini (termasuk absen kiosk) dan menawarkan sesi yang
// belum terpakai, supaya magang tidak menekan tombol yang pasti ditolak.

import { api, pengguna } from '../api.js';
import {
  esc,
  jam,
  tanggal,
  tanggalPanjang,
  bulanIni,
  KELAS_ISIAN,
  tampilkanGalat,
  sembunyikanGalat,
  beritahu,
} from '../ui.js';
import { pasangKerangka } from '../kerangka.js';
import {
  KARTU,
  KARTU_RINGKASAN,
  TOMBOL_UTAMA,
  TOMBOL_HALUS,
  formatJarak,
  pesanGalat,
} from '../tabel.js';
import * as kamera from '../kamera.js';
import { ambilLokasi } from '../lokasi.js';

const KUNCI_ANTREAN = 'absen-dinas-antrean';
const AKURASI_KASAR = 50; // meter; di atas ini titiknya ditandai, bukan ditolak
const IKON_PIN = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M12 20.5s6.5-5.3 6.5-10.4a6.5 6.5 0 1 0-13 0C5.5 15.2 12 20.5 12 20.5Z"/>
    <circle cx="12" cy="10" r="2.4" />
  </svg>`;

const IKON_KAMERA = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M4 8.5h3l1.2-2h7.6l1.2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/>
    <circle cx="12" cy="13.5" r="3.4" />
  </svg>`;

/** Tanggal hari ini menurut jam kantor, bentuk YYYY-MM-DD. */
const hariIni = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

/** Kunci idempoten baru. Bentuknya aman untuk aturan server: [A-Za-z0-9._-]. */
function kunciBaru() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function bacaAntrean() {
  try {
    const isi = JSON.parse(localStorage.getItem(KUNCI_ANTREAN) ?? '[]');
    return Array.isArray(isi) ? isi : [];
  } catch {
    return [];
  }
}

function tulisAntrean(list) {
  try {
    localStorage.setItem(KUNCI_ANTREAN, JSON.stringify(list));
  } catch {
    // Penyimpanan penuh/diblokir: absennya tetap dicoba, hanya tidak tahan
    // kalau halaman ditutup sebelum jaringan kembali.
  }
}

/** Lencana status satu sesi. `disetujui` ditulis "Tercatat" karena absen kiosk
 *  juga sampai ke sini dan tidak pernah lewat persetujuan admin. */
function lencanaSesi(status) {
  if (!status) return '';
  const [label, kelas] =
    status === 'menunggu'
      ? ['Menunggu', 'bg-amber-500/15 text-amber-800']
      : status === 'ditolak'
        ? ['Ditolak', 'bg-rose-500/12 text-rose-800']
        : ['Tercatat', 'bg-emerald-500/12 text-emerald-800'];
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${kelas}">${label}</span>`;
}

/**
 * Gabungkan baris harian (`/saya/absen`) dengan pengajuan dinas hari ini.
 *
 * Baris harian sudah mencakup absen kiosk maupun dinas, tetapi baris yang
 * ditolak ikut terhitung di sana. Karena itu waktu yang sama persis dengan
 * pengajuan dinas yang ditolak diabaikan — sesi itu masih boleh dikirim ulang.
 */
function ringkasHari(harian, dinasHariIni) {
  const hasil = {};

  for (const tipe of ['masuk', 'pulang']) {
    const aktif = dinasHariIni.find((r) => r.tipe === tipe && r.status_persetujuan !== 'ditolak');
    const tolak = dinasHariIni.find((r) => r.tipe === tipe && r.status_persetujuan === 'ditolak');
    const waktuHarian = harian?.[tipe] ?? null;
    const hanyaDitolak = Boolean(tolak && !aktif && waktuHarian && waktuHarian === tolak.waktu);

    hasil[tipe] = {
      waktu: hanyaDitolak ? null : (aktif?.waktu ?? waktuHarian),
      status: aktif?.status_persetujuan ?? (hanyaDitolak ? 'ditolak' : waktuHarian ? 'disetujui' : null),
    };
  }

  return hasil;
}

export default {
  judul: 'Absen Dinas',

  mount(akar) {
    const isi = pasangKerangka(akar, { judul: 'Absen Dinas' });

    isi.innerHTML = `
      <div class="grid gap-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="${KARTU_RINGKASAN}">
            <p class="text-xs text-ink/70 sm:text-sm">Masuk</p>
            <p class="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span data-jam-masuk class="angka-rata text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">—</span>
              <span data-lencana-masuk></span>
            </p>
            <p data-catatan-masuk class="mt-1 text-[0.7rem] leading-snug text-ink/70 sm:text-xs">Memuat…</p>
          </div>

          <div class="${KARTU_RINGKASAN}">
            <p class="text-xs text-ink/70 sm:text-sm">Pulang</p>
            <p class="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span data-jam-pulang class="angka-rata text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">—</span>
              <span data-lencana-pulang></span>
            </p>
            <p data-catatan-pulang class="mt-1 text-[0.7rem] leading-snug text-ink/70 sm:text-xs">Memuat…</p>
          </div>
        </div>

        <section class="${KARTU} min-w-0">
          <div class="flex flex-wrap items-start gap-3">
            <div class="min-w-0">
              <h2 data-judul-form class="text-lg font-semibold tracking-tight text-ink">Absen dinas luar</h2>
              <p class="mt-0.5 text-sm text-muted">Selfie, GPS, dan keterangan tugas wajib diisi.</p>
            </div>
            <p class="ml-auto text-xs text-muted">${esc(tanggalPanjang(hariIni()))}</p>
          </div>

          <div data-galat role="alert" hidden
               class="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                 stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 size-4 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7.8v5" /><path d="M12 16.4h.01" />
            </svg>
            <span data-galat-teks></span>
          </div>

          <div data-form class="mt-5">
            <div class="flex flex-wrap items-center gap-2.5 rounded-2xl border border-ink/8 bg-ink/4 px-3.5 py-3">
              <span data-lokasi class="min-w-0 text-sm text-muted">Mencari lokasi…</span>
              <button type="button" data-ulang-lokasi class="${TOMBOL_HALUS} ml-auto">Perbarui</button>
            </div>

            <label for="keterangan-dinas" class="mt-5 mb-1.5 block text-sm font-medium text-ink">
              Keterangan dinas
            </label>
            <textarea id="keterangan-dinas" data-keterangan rows="3" maxlength="500"
                      class="${KELAS_ISIAN} min-h-28 resize-y break-words"
                      placeholder="Contoh: Mengantar dokumen ke kantor cabang Bandung."></textarea>
            <p data-hitung class="mt-1.5 text-xs text-muted">0/500 · minimal 5 karakter</p>

            <p class="mt-5 mb-2 text-sm font-medium text-ink">Foto selfie</p>
            <div data-foto-kosong class="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-ink/15 bg-ink/3 px-4 py-4">
              <button type="button" data-kamera class="${TOMBOL_HALUS}">
                ${IKON_KAMERA}<span>Ambil selfie</span>
              </button>
              <span class="min-w-0 text-xs text-muted">Kamera langsung, bukan unggahan galeri.</span>
            </div>
            <div data-foto-isi hidden>
              <img data-pratinjau alt="Pratinjau selfie"
                   class="max-h-56 w-full rounded-2xl object-cover ring-1 ring-ink/10">
              <button type="button" data-ulang-foto class="${TOMBOL_HALUS} mt-2">
                ${IKON_KAMERA}<span>Ambil ulang</span>
              </button>
            </div>

            <button type="button" data-kirim class="${TOMBOL_UTAMA} mt-5 w-full" disabled>
              Kirim absen masuk
            </button>
            <p data-petunjuk-kirim class="mt-2 text-center text-xs text-muted">
              Lengkapi keterangan dan selfie dulu.
            </p>
          </div>

          <div data-selesai hidden
               class="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3.5 text-sm text-ink">
            Absen masuk dan pulang hari ini sudah tercatat. Tidak ada sesi yang perlu dikirim lagi.
          </div>
        </section>

        <div data-antrean hidden
             class="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-900"></div>

        <section class="${KARTU} min-w-0">
          <h2 class="text-lg font-semibold tracking-tight text-ink">Riwayat bulan ini</h2>
          <p data-jumlah class="mt-0.5 text-sm text-muted">Memuat…</p>
          <div data-riwayat class="mt-5"></div>
        </section>
      </div>`;

    const elJudulForm = isi.querySelector('[data-judul-form]');
    const elForm = isi.querySelector('[data-form]');
    const elSelesai = isi.querySelector('[data-selesai]');
    const elLokasi = isi.querySelector('[data-lokasi]');
    const elKeterangan = isi.querySelector('[data-keterangan]');
    const elHitung = isi.querySelector('[data-hitung]');
    const elTombol = isi.querySelector('[data-kirim]');
    const elPetunjuk = isi.querySelector('[data-petunjuk-kirim]');
    const elFotoKosong = isi.querySelector('[data-foto-kosong]');
    const elFotoIsi = isi.querySelector('[data-foto-isi]');
    const elPratinjau = isi.querySelector('[data-pratinjau]');
    const elAntrean = isi.querySelector('[data-antrean]');
    const elJumlah = isi.querySelector('[data-jumlah]');
    const kotakRiwayat = isi.querySelector('[data-riwayat]');
    const kotakJam = { masuk: isi.querySelector('[data-jam-masuk]'), pulang: isi.querySelector('[data-jam-pulang]') };
    const kotakLencana = {
      masuk: isi.querySelector('[data-lencana-masuk]'),
      pulang: isi.querySelector('[data-lencana-pulang]'),
    };
    const kotakCatatan = {
      masuk: isi.querySelector('[data-catatan-masuk]'),
      pulang: isi.querySelector('[data-catatan-pulang]'),
    };

    let hidup = true;
    // Dibaca di dalam mount, bukan di tingkat modul: modul ini tetap ter-cache
    // saat pengguna keluar lalu masuk lagi tanpa memuat ulang halaman.
    const AKU = pengguna();
    let foto = null;
    let lokasi = null;
    let memuatLokasi = false;
    let kameraTutup = null;
    let sedangKirimAntrean = false;
    let pesanAntrean = '';
    let ringkas = { masuk: { waktu: null, status: null }, pulang: { waktu: null, status: null } };
    let daftar = [];

    function antreanSaya() {
      if (!AKU) return [];
      const hari = hariIni();
      return bacaAntrean().filter((x) => x.pengguna_id === AKU.id && x.tanggal === hari);
    }

    function tipeBerikut() {
      if (!ringkas.masuk.waktu) return 'masuk';
      if (!ringkas.pulang.waktu) return 'pulang';
      return null;
    }

    function panjangKeterangan() {
      return elKeterangan.value.trim().length;
    }

    function perbaruiTombol() {
      const tipe = tipeBerikut();
      const alasan = !tipe
        ? 'Absen masuk dan pulang hari ini sudah tercatat.'
        : antreanSaya().length
          ? 'Ada absen tertunda. Tunggu sampai terkirim otomatis.'
          : !foto
            ? 'Ambil selfie dulu.'
            : !lokasi
              ? 'Lokasi belum didapat. Tekan Perbarui.'
              : panjangKeterangan() < 5
                ? 'Keterangan dinas minimal 5 karakter.'
                : 'Data siap dikirim.';

      elTombol.textContent = tipe === 'pulang' ? 'Kirim absen pulang' : 'Kirim absen masuk';
      elTombol.disabled = !tipe || alasan !== 'Data siap dikirim.';
      elPetunjuk.textContent = alasan;
    }

    function gambarRingkasan() {
      for (const tipe of ['masuk', 'pulang']) {
        const r = ringkas[tipe];
        kotakJam[tipe].textContent = r.waktu ? jam(r.waktu) : '—';
        kotakLencana[tipe].innerHTML = lencanaSesi(r.status);
        kotakCatatan[tipe].textContent = !r.status
          ? 'Belum absen hari ini.'
          : r.status === 'menunggu'
            ? 'Menunggu persetujuan admin.'
            : r.status === 'ditolak'
              ? 'Ditolak admin — kirim ulang lewat formulir di bawah.'
              : 'Tercatat.';
      }
    }

    function gambarForm() {
      const tipe = tipeBerikut();
      const selesai = !tipe;

      elSelesai.hidden = !selesai;
      elForm.hidden = selesai;
      elJudulForm.textContent = tipe === 'pulang' ? 'Absen pulang dinas luar' : 'Absen masuk dinas luar';
      perbaruiTombol();
    }

    function gambarFoto() {
      if (foto) {
        elPratinjau.src = foto;
        elFotoKosong.hidden = true;
        elFotoIsi.hidden = false;
      } else {
        elPratinjau.removeAttribute('src');
        elFotoKosong.hidden = false;
        elFotoIsi.hidden = true;
      }
      perbaruiTombol();
    }

    function gambarHitung() {
      const n = panjangKeterangan();
      elHitung.textContent = `${n}/500 · minimal 5 karakter`;
      elHitung.className = n > 0 && n < 5 ? 'mt-1.5 text-xs text-amber-800' : 'mt-1.5 text-xs text-muted';
      perbaruiTombol();
    }

    function gambarAntrean() {
      const n = antreanSaya().length;
      elAntrean.hidden = n === 0 && !pesanAntrean;

      const bagian = [];
      if (n) {
        bagian.push(
          `<span class="font-medium">${n} absen menunggu jaringan.</span> ` +
            'Akan dikirim ulang otomatis begitu koneksi kembali.',
        );
      }
      if (pesanAntrean) {
        bagian.push(`<span class="mt-1 block break-words">${esc(pesanAntrean)}</span>`);
      }
      elAntrean.innerHTML = bagian.join('');
      perbaruiTombol();
    }

    function kartuRiwayat(r) {
      const koordinat =
        Number.isFinite(r.lintang) && Number.isFinite(r.bujur) ? `${r.lintang}, ${r.bujur}` : null;
      const tempat = r.lokasi_teks
        ? esc(r.lokasi_teks)
        : koordinat
          ? `<span class="tabular-nums">${esc(koordinat)}</span>`
          : 'Lokasi tidak tercatat';

      const jarak = formatJarak(r.jarak_m);
      const akurasi = Number.isFinite(r.akurasi)
        ? `±${Math.round(r.akurasi)} m${r.akurasi > AKURASI_KASAR ? ' (kasar)' : ''}`
        : null;

      const rincian = [
        tempat,
        jarak ? `${esc(jarak)} dari kantor` : '',
        akurasi ? `GPS ${esc(akurasi)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      return `
        <li class="rounded-2xl bg-ink/4 p-4 ring-1 ring-ink/8">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full bg-ink/8 px-2.5 py-1 text-xs font-medium text-ink/70">
              ${r.tipe === 'masuk' ? 'Masuk' : 'Pulang'}
            </span>
            ${lencanaSesi(r.status_persetujuan)}
            <span class="ml-auto text-xs text-muted whitespace-nowrap">
              ${esc(tanggal(r.waktu))} · ${esc(jam(r.waktu))}
            </span>
          </div>

          <p class="mt-2.5 text-sm break-words text-ink">${esc(r.keterangan_dinas ?? '')}</p>
          <p class="mt-1.5 text-xs break-words text-muted">${rincian}</p>

          ${
            r.status_persetujuan === 'ditolak' && r.catatan_admin
              ? `<p class="mt-2.5 rounded-xl bg-rose-500/10 px-3 py-2 text-sm break-words text-rose-900">
                   <span class="font-medium">Catatan admin:</span> ${esc(r.catatan_admin)}
                 </p>`
              : ''
          }
        </li>`;
    }

    function gambarRiwayat() {
      const menunggu = daftar.filter((r) => r.status_persetujuan === 'menunggu').length;
      elJumlah.textContent = daftar.length
        ? `${daftar.length} pengajuan · ${menunggu} menunggu keputusan`
        : 'Belum ada pengajuan bulan ini';

      kotakRiwayat.innerHTML = daftar.length
        ? `<ul class="grid gap-3">${daftar.map(kartuRiwayat).join('')}</ul>`
        : `<div class="flex flex-col items-center rounded-2xl bg-ink/4 px-6 py-10 text-center ring-1 ring-ink/8">
             <p class="font-medium text-ink">Belum ada absen dinas bulan ini</p>
             <p class="mt-1 max-w-sm text-sm text-muted">
               Absen yang dikirim dari halaman ini akan muncul di sini beserta keputusan admin.
             </p>
           </div>`;
    }

    async function muat() {
      try {
        const [harian, dinas] = await Promise.all([
          api.get(`/saya/absen?bulan=${bulanIni()}`),
          api.get('/saya/absen-dinas'),
        ]);
        if (!hidup) return;

        const hari = hariIni();
        const bulan = bulanIni();
        const barisHariIni = (harian.data ?? []).find((h) => h.tanggal === hari) ?? null;

        daftar = (dinas.data ?? [])
          .filter((r) => String(r.tanggal).slice(0, 7) === bulan)
          .sort((a, b) => (a.waktu < b.waktu ? 1 : a.waktu > b.waktu ? -1 : 0));

        ringkas = ringkasHari(
          barisHariIni,
          daftar.filter((r) => r.tanggal === hari),
        );

        gambarRingkasan();
        gambarRiwayat();
        gambarForm();
      } catch (galat) {
        if (!hidup) return;
        elJumlah.textContent = 'Gagal dimuat';
        kotakRiwayat.innerHTML = pesanGalat(galat.message);
      }
    }

    async function cariLokasi() {
      if (memuatLokasi) return;
      memuatLokasi = true;
      elLokasi.innerHTML = '<span class="text-muted">Mencari lokasi…</span>';

      try {
        const hasil = await ambilLokasi();
        if (!hidup) return;

        lokasi = hasil;
        const akurasi = Number.isFinite(hasil.akurasi)
          ? `±${Math.round(hasil.akurasi)} m`
          : 'akurasi tidak tercatat';
        const kasar = !Number.isFinite(hasil.akurasi) || hasil.akurasi > AKURASI_KASAR;

        elLokasi.innerHTML = `
          <span class="inline-flex items-center gap-1.5 ${kasar ? 'text-amber-800' : 'text-emerald-800'}">
            ${IKON_PIN}<span>${kasar ? 'Sinyal lemah' : 'Lokasi siap'} · ${esc(akurasi)}</span>
          </span>
          <span class="mt-0.5 block text-xs break-words text-muted">
            ${
              kasar
                ? 'Tetap bisa dikirim; admin melihat akurasi ini.'
                : 'Koordinat dikirim bersama absen.'
            }
          </span>`;
      } catch (galat) {
        if (!hidup) return;
        lokasi = null;
        elLokasi.innerHTML = `<span class="text-rose-800">${esc(galat.message)}</span>`;
      } finally {
        memuatLokasi = false;
        if (hidup) perbaruiTombol();
      }
    }

    /** Dialog kamera. Track selalu dimatikan saat ditutup, termasuk lewat Esc. */
    function bukaKamera() {
      return new Promise((selesai) => {
        const d = document.createElement('dialog');
        d.className =
          'kaca-tebal m-auto w-[calc(100%-2rem)] max-w-md rounded-[1.5rem] p-4 text-ink sm:p-6';
        d.innerHTML = `
          <h2 class="text-lg font-semibold tracking-tight text-ink">Ambil selfie</h2>
          <p class="mt-1 text-sm text-muted">Pastikan wajah terlihat dan pencahayaan cukup.</p>

          <video data-video autoplay muted playsinline
                 class="mt-4 aspect-[4/3] w-full rounded-2xl bg-ink/10 object-cover"></video>

          <p data-galat-kamera role="alert" hidden
             class="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-900"></p>

          <div class="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" data-batal class="${TOMBOL_HALUS}">Batal</button>
            <button type="button" data-ambil class="${TOMBOL_UTAMA}" disabled>Ambil foto</button>
          </div>`;
        document.body.appendChild(d);

        const video = d.querySelector('[data-video]');
        const tombolAmbil = d.querySelector('[data-ambil]');
        const galatKamera = d.querySelector('[data-galat-kamera]');
        let hentikan = null;
        let selesaiDialog = false;

        const tutup = (hasil) => {
          if (selesaiDialog) return;
          selesaiDialog = true;
          kameraTutup = null;
          hentikan?.();
          hentikan = null;
          if (d.open) d.close();
          d.remove();
          selesai(hasil);
        };

        kameraTutup = () => tutup(null);

        d.querySelector('[data-batal]').addEventListener('click', () => tutup(null));
        d.addEventListener('close', () => tutup(null), { once: true });

        (async () => {
          try {
            const stop = await kamera.nyalakan(video);
            if (selesaiDialog) {
              stop();
              return;
            }
            hentikan = stop;
            tombolAmbil.disabled = false;
          } catch (galat) {
            if (selesaiDialog) return;
            galatKamera.textContent = kamera.pesanKamera(galat);
            galatKamera.hidden = false;
          }
        })();

        tombolAmbil.addEventListener('click', async () => {
          tombolAmbil.disabled = true;
          const siap = await kamera.tungguSiap(video);
          if (selesaiDialog) return;

          if (!siap) {
            galatKamera.textContent = 'Kamera belum menampilkan gambar. Coba lagi sebentar.';
            galatKamera.hidden = false;
            tombolAmbil.disabled = false;
            return;
          }

          tutup(kamera.potret(video));
        });

        d.showModal();
      });
    }

    async function ambilSelfie() {
      sembunyikanGalat(isi);
      const hasil = await bukaKamera();
      if (!hidup || !hasil) return;
      foto = hasil;
      gambarFoto();
    }

    async function kirimAntreanTertunda() {
      if (sedangKirimAntrean || !navigator.onLine || !AKU) return;

      const hari = hariIni();
      // Antrean dari hari lain dibuang: server akan mencatatnya sebagai absen
      // hari ini, padahal jam dan fotonya milik hari kemarin.
      let semua = bacaAntrean().filter((x) => x.tanggal === hari);
      const milikku = semua.filter((x) => x.pengguna_id === AKU.id);
      if (!milikku.length) {
        tulisAntrean(semua);
        gambarAntrean();
        return;
      }

      sedangKirimAntrean = true;
      const beres = new Set();

      for (const item of milikku) {
        try {
          await api.post('/saya/absen', item.isian);
          beres.add(item.isian.kunci_idempoten);
        } catch (galat) {
          if (galat.jaringan) break;
          // Ditolak server (foto rusak, sudah absen, …). Dibuang supaya tidak
          // mengulang kesalahan yang sama setiap kali koneksi kembali.
          beres.add(item.isian.kunci_idempoten);
          pesanAntrean = galat.message;
        }
      }

      sedangKirimAntrean = false;
      semua = semua.filter(
        (x) => !(x.pengguna_id === AKU.id && beres.has(x.isian.kunci_idempoten)),
      );
      tulisAntrean(semua);
      gambarAntrean();

      if (beres.size) await muat();
    }

    async function kirim() {
      const tipe = tipeBerikut();
      if (!tipe || elTombol.disabled || !foto || !lokasi) return;

      const isian = {
        foto,
        lintang: lokasi.lintang,
        bujur: lokasi.bujur,
        akurasi: lokasi.akurasi,
        keterangan_dinas: elKeterangan.value.trim(),
        kunci_idempoten: kunciBaru(),
      };

      elTombol.disabled = true;
      elTombol.textContent = 'Mengirim…';
      sembunyikanGalat(isi);

      try {
        await api.post('/saya/absen', isian);
        pesanAntrean = '';
        foto = null;
        elKeterangan.value = '';
        gambarFoto();
        gambarHitung();
        await muat();
        await beritahu({
          judul: `Absen ${tipe} terkirim`,
          pesan:
            'Absen dinas Anda menunggu persetujuan admin. Statusnya bisa dilihat di riwayat di bawah.',
        });
      } catch (galat) {
        if (galat.jaringan) {
          const semua = bacaAntrean();
          semua.push({ pengguna_id: AKU?.id ?? null, tanggal: hariIni(), isian });
          tulisAntrean(semua);

          foto = null;
          elKeterangan.value = '';
          gambarFoto();
          gambarHitung();
          gambarAntrean();

          await beritahu({
            judul: 'Belum terkirim',
            pesan:
              'Jaringan sedang tidak tersedia. Absen Anda disimpan dan akan dikirim otomatis saat koneksi kembali.',
          });
        } else {
          tampilkanGalat(isi, galat.message);
        }
      } finally {
        if (hidup) perbaruiTombol();
      }
    }

    const saatOnline = () => {
      kirimAntreanTertunda();
    };

    isi.querySelector('[data-kamera]').addEventListener('click', ambilSelfie);
    isi.querySelector('[data-ulang-foto]').addEventListener('click', ambilSelfie);
    isi.querySelector('[data-ulang-lokasi]').addEventListener('click', cariLokasi);
    elKeterangan.addEventListener('input', gambarHitung);
    elTombol.addEventListener('click', kirim);
    addEventListener('online', saatOnline);

    gambarFoto();
    gambarHitung();
    gambarAntrean();
    cariLokasi();
    muat().then(() => {
      if (hidup && navigator.onLine) kirimAntreanTertunda();
    });

    return () => {
      hidup = false;
      removeEventListener('online', saatOnline);
      kameraTutup?.();
    };
  },
};
