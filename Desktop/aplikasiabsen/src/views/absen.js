// Kiosk absen. Layar penuh, tanpa sidebar — ini yang dihadapi magang.
//
// Layar ini PUBLIK: tidak butuh login. Alasannya keamanan, bukan kemalasan.
// Kalau kiosk harus login admin dulu, token admin tersimpan di localStorage PC
// yang dipakai bersama, dan itu jauh lebih berbahaya daripada kiosk terbuka.
// Sebagai gantinya, `POST /kiosk/absen` WAJIB dibatasi di sisi server (hanya
// dari IP kantor) — lihat PANDUAN-BACKEND.md.

import { api, pengguna, idPerangkat } from '../api.js';
import { esc, jam, jamBerjalan, tampilkanGalat, sembunyikanGalat, KELAS_ISIAN } from '../ui.js';
import { formatJarak } from '../tabel.js';
import * as kamera from '../kamera.js';
import { ambilLokasi, AKURASI_MAKS } from '../lokasi.js';

const JEDA_HASIL = 7000; // ms sebelum kembali ke layar awal
const JEDA_DIAM = 45000; // ms tanpa ketikan sebelum kolom dikosongkan
const MULAI_HITUNG = 3;

const IKON_MEREK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
       stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.1 1.9" />
  </svg>`;

const IKON_LOKASI = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M12 20.5s6.5-5.3 6.5-10.4a6.5 6.5 0 1 0-13 0C5.5 15.2 12 20.5 12 20.5Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>`;

const IKON_GALAT = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5" />
    <path d="M12 16.2h.01" />
  </svg>`;

const IKON_BENAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round" class="size-8" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>`;

const IKON_SALAH = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round" class="size-8" aria-hidden="true">
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>`;

const IKON_ULANG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M3.8 12a8.2 8.2 0 1 0 2.5-5.9" />
    <path d="M3.8 4.8V9h4.2" />
  </svg>`;

const IKON_MUTAR = `
  <svg viewBox="0 0 24 24" fill="none" class="size-5 animate-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-25" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
  </svg>`;

const IKON_MUTAR_KECIL = `
  <svg viewBox="0 0 24 24" fill="none" class="size-3.5 shrink-0 animate-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-25" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
  </svg>`;

// Kolom isian kiosk: sama seperti di layar masuk, tapi lebih tinggi dan
// berhuruf besar karena dibaca dari jarak satu langkah dari layar.
const ISIAN = `${KELAS_ISIAN} py-4 text-center text-xl`;

const TOMBOL =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-merek px-5 py-4 ' +
  'font-medium text-white shadow-naik transition duration-200 ease-apple hover:bg-merek-gelap ' +
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55';

const TOMBOL_ULANG =
  'mx-auto mt-6 flex cursor-pointer items-center gap-2 rounded-full border border-ink/12 ' +
  'bg-white/70 px-5 py-2.5 text-sm font-medium text-ink transition duration-200 ease-apple ' +
  'hover:bg-white active:scale-[0.97]';

export default {
  judul: 'Kiosk Absen',

  mount(akar) {
    let langkah = 'siap'; // siap | kamera | simpan | hasil
    let lokasi = null;

    // Posisi untuk mode "di luar". Selama `gps` kosong, absen "di luar" tidak
    // boleh dikirim: koordinat itulah satu-satunya isi dari pilihan tersebut.
    let gps = null;
    let gpsStatus = 'idle'; // idle | memuat | siap | gagal
    let gpsPesan = '';
    let janjiGps = null;
    let gpsUrutan = 0;

    // Semua timer lewat satu jalur supaya tidak ada yang tertinggal hidup saat
    // layar ditinggalkan. Timer yang bocor bisa mengubah layar lain.
    const timers = new Set();
    let jedaDiam = null;
    let hentikanKamera = null;

    function jadwalkan(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    }

    function bersihkanTimer() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      clearTimeout(jedaDiam);
      jedaDiam = null;
    }

    function bersihkanKamera() {
      hentikanKamera?.();
      hentikanKamera = null;
    }

    // Tautan kembali hanya muncul kalau ada sesi. PC kiosk tidak punya sesi,
    // jadi magang tidak melihat apa pun yang bisa ditekan untuk keluar dari
    // layar absen. Tujuannya halaman pertama masing-masing: magang tidak punya
    // beranda, jadi mengirimnya ke sana cuma satu lompatan tambahan.
    const tautanKembali = pengguna()
      ? `<a href="${pengguna().peran === 'magang' ? '#/riwayat' : '#/beranda'}"
            class="kaca flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-ink
                   transition duration-200 ease-apple hover:bg-white/90 active:scale-[0.97]">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
             <path d="M14.5 6.5 9 12l5.5 5.5" />
           </svg>
           Kembali
         </a>`
      : '';

    akar.innerHTML = `
      <main class="flex min-h-dvh flex-col px-5 py-6 sm:px-8">
        <header class="flex shrink-0 items-center justify-between gap-4">
          <span class="flex items-center gap-2.5">
            <span class="grid size-9 place-items-center rounded-xl bg-merek text-white shadow-naik">
              ${IKON_MEREK}
            </span>
            <span class="text-sm font-medium text-muted">Aplikasi Absen</span>
          </span>

          <span class="flex shrink-0 items-center gap-2">
            <span data-lokasi></span>
            ${tautanKembali}
          </span>
        </header>

        <div class="shrink-0 pt-8 text-center">
          <p data-jam class="angka-rata text-6xl font-semibold tracking-tight text-ink sm:text-7xl">
            --.--.--
          </p>
          <p data-tanggal class="mt-2 text-sm text-muted">—</p>
        </div>

        <div data-panggung class="flex flex-1 flex-col items-center justify-center py-8"></div>

        <footer class="shrink-0 text-center text-xs text-muted">
          Kehadiran hanya tercatat dari perangkat ini.
        </footer>
      </main>`;

    const panggung = akar.querySelector('[data-panggung]');
    const hentikanJam = jamBerjalan(akar.querySelector('[data-jam]'), akar.querySelector('[data-tanggal]'));

    // ── lokasi perangkat ─────────────────────────────────────────────────────
    //
    // Diminta setiap formulir absen dibuka, bukan hanya saat "di luar" dipilih:
    // alamat dari titik perangkat dipakai untuk kedua mode, dan admin perlu
    // melihatnya di rekap. Hasilnya disimpan, lalu dipakai saat absen dikirim.

    function lupakanGps() {
      // Menaikkan urutan membatalkan jawaban yang masih jalan. Tanpa ini,
      // permintaan lama yang gagal bisa menimpa hasil baru yang berhasil.
      gpsUrutan += 1;
      gps = null;
      gpsStatus = 'idle';
      gpsPesan = '';
      janjiGps = null;
    }

    function gambarGps() {
      const el = panggung.querySelector('[data-gps]');
      if (!el) return;

      if (gpsStatus === 'idle') {
        el.className = 'mt-2 hidden';
        el.textContent = '';
        return;
      }

      el.className = 'mt-2 flex items-center gap-1.5 text-xs';

      if (gpsStatus === 'memuat') {
        el.classList.add('text-muted');
        el.innerHTML = `${IKON_MUTAR_KECIL}<span>Mengambil lokasi…</span>`;
        return;
      }

      if (gpsStatus === 'siap') {
        // Di atas 50 m akurasinya sudah kasar. Di atas batas server, absen
        // "di luar" pasti ditolak; beri tombol ambil ulang sebelum foto diambil.
        const kasar = gps.akurasi === null || gps.akurasi > 50;
        const ditolak = gps.akurasi === null || gps.akurasi > AKURASI_MAKS;
        el.classList.add(ditolak ? 'text-rose-700' : kasar ? 'text-amber-700' : 'text-emerald-700');
        const angka = gps.akurasi === null ? '?' : gps.akurasi;
        el.innerHTML = `${IKON_LOKASI}<span>Lokasi terkunci · akurasi ±${angka} m${
          ditolak ? ' (terlalu kasar untuk dinas luar)' : kasar ? ' (kasar)' : ''
        }</span>${
          ditolak
            ? '<button type="button" class="shrink-0 font-medium underline">Ambil ulang</button>'
            : ''
        }`;
        el.querySelector('button')?.addEventListener('click', () => mulaiGps());
        return;
      }

      el.classList.add('text-rose-700');
      el.innerHTML = `<span class="flex-1">${esc(gpsPesan)}</span>
        <button type="button" class="shrink-0 font-medium underline">Coba lagi</button>`;
      el.querySelector('button')?.addEventListener('click', () => mulaiGps());
    }

    function mulaiGps() {
      const urutan = ++gpsUrutan;
      gpsStatus = 'memuat';
      gps = null;
      gpsPesan = '';
      gambarGps();

      janjiGps = ambilLokasi()
        .then((hasil) => {
          if (urutan !== gpsUrutan) return null;
          gps = hasil;
          gpsStatus = 'siap';
          gambarGps();
          return hasil;
        })
        .catch((galat) => {
          if (urutan !== gpsUrutan) return null;
          gpsStatus = 'gagal';
          gpsPesan = galat.message;
          gambarGps();
          return null;
        });

      return janjiGps;
    }

    // ── langkah 1: NIP dan PIN ───────────────────────────────────────────────

    // `nipAwal` diisi saat PIN salah. NIP-nya sudah benar di kasus itu, dan
    // memaksa mengetik ulang enam karakter gara-gara salah empat angka itu
    // menyebalkan — apalagi kalau ada antrean di belakang.
    function tampilkanSiap(galat = '', nipAwal = '') {
      langkah = 'siap';

      // Formulir baru selalu mulai dari "di perusahaan", jadi koordinat lama
      // tidak akan terpakai lagi. Dibuang di sini supaya tidak ada posisi
      // orang sebelumnya yang menempel ke absen orang berikutnya.
      lupakanGps();

      panggung.innerHTML = `
        <div class="kaca w-full max-w-md rounded-[1.75rem] p-6 sm:p-7">
          <h1 class="text-center text-lg font-semibold tracking-tight text-ink">Absen Kehadiran</h1>
          <p class="mt-1 text-center text-sm text-muted">Masukkan NIP dan PIN Anda.</p>

          <form novalidate class="mt-6 space-y-4">
            <fieldset>
              <legend class="mb-2 block text-sm font-medium text-ink">Absen dari mana?</legend>
              <div class="grid grid-cols-2 gap-1.5 rounded-2xl bg-ink/6 p-1.5">
                <label class="cursor-pointer rounded-xl px-3 py-2.5 text-center text-sm font-medium
                              text-muted transition duration-200 ease-apple
                              has-[:checked]:bg-white has-[:checked]:text-ink has-[:checked]:shadow-naik">
                  <input type="radio" name="mode" value="kantor" checked class="sr-only" />
                  Di perusahaan
                </label>
                <label class="cursor-pointer rounded-xl px-3 py-2.5 text-center text-sm font-medium
                              text-muted transition duration-200 ease-apple
                              has-[:checked]:bg-white has-[:checked]:text-ink has-[:checked]:shadow-naik">
                  <input type="radio" name="mode" value="luar" class="sr-only" />
                  Di luar
                </label>
              </div>
              <div data-gps class="mt-2 hidden"></div>
              <p class="mt-2 text-xs text-muted">
                Lokasi perangkat diambil untuk mencatat alamat absen, baik di perusahaan maupun di
                luar. Pilihan "Di luar" untuk dinas luar dan wajib membawa GPS. Server menyimpan
                titik serta alamat perkiraan Anda, lalu menampilkannya di rekap admin.
              </p>
            </fieldset>

            <div>
              <label for="nip" class="mb-1.5 block text-sm font-medium text-ink">NIP</label>
              <input id="nip" name="nip" autocomplete="off" autocapitalize="characters" required
                     value="${esc(nipAwal)}" placeholder="MGG001" class="${ISIAN} uppercase" />
            </div>

            <div>
              <label for="pin" class="mb-1.5 block text-sm font-medium text-ink">PIN</label>
              <input id="pin" name="pin" type="password" inputmode="numeric" maxlength="6" required
                     autocomplete="new-password" placeholder="••••" class="${ISIAN} tracking-[0.4em]" />
            </div>

            <div data-galat role="alert" ${galat ? '' : 'hidden'}
                 class="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-900">
              ${IKON_GALAT}
              <span data-galat-teks>${esc(galat)}</span>
            </div>

            <button type="submit" class="${TOMBOL}">Absen Sekarang</button>
          </form>
        </div>`;

      const form = panggung.querySelector('form');
      const isianNip = form.elements.nip;
      const isianPin = form.elements.pin;

      for (const radio of form.querySelectorAll('[name="mode"]')) {
        radio.addEventListener('change', () => {
          // Titik perangkat dipakai untuk kedua mode. Kalau pengambilan
          // sebelumnya gagal, pilihan mode menjadi kesempatan mencoba lagi.
          if (!gps && gpsStatus !== 'memuat') mulaiGps();
        });
      }

      // Lokasi diambil lebih dulu, selagi magang mengetik NIP dan PIN, supaya
      // absen tidak perlu menunggu GPS setelah foto diambil.
      mulaiGps();

      // Kalau NIP sudah terisi, PIN-lah satu-satunya yang perlu diketik.
      (nipAwal ? isianPin : isianNip).focus();

      // Magang mengetik lalu pergi. Tanpa ini, NIP orang sebelumnya masih
      // tertera saat orang berikutnya datang.
      const pasangJedaDiam = () => {
        clearTimeout(jedaDiam);
        jedaDiam = setTimeout(() => {
          isianNip.value = '';
          isianPin.value = '';
          // Pilihan "di luar" tidak boleh diwarisi orang berikutnya. Orang yang
          // pergi tanpa menekan apa pun meninggalkan pilihan yang bukan
          // pilihannya, dan absennya tercatat di tempat yang salah.
          form.querySelector('[name="mode"][value="kantor"]').checked = true;
          lupakanGps();
          // Orang berikutnya juga perlu alamat absennya, jadi lokasi diambil
          // ulang untuk formulir yang sudah bersih ini.
          mulaiGps();
          sembunyikanGalat(panggung);
        }, JEDA_DIAM);
      };
      pasangJedaDiam();
      form.addEventListener('input', pasangJedaDiam);

      isianPin.addEventListener('input', () => {
        // Batasnya 6, bukan 4. PIN magang boleh 4 sampai 6 angka sejak layar
        // Profil Saya bisa menggantinya, dan memotongnya di 4 angka di sini
        // membuat PIN lima atau enam angka tidak akan pernah bisa dipakai
        // absen — tanpa pesan apa pun, karena angkanya hanya tidak muncul.
        isianPin.value = isianPin.value.replace(/\D/g, '').slice(0, 6);
      });

      // Kelas `uppercase` di CSS cuma mengubah tampilan. Tanpa baris ini,
      // magang mengetik "mgg001", layar memperlihatkan "MGG001", tapi yang
      // dikirim tetap huruf kecil — dan backend yang membandingkan secara
      // sensitif akan menolaknya. Yang dilihat harus sama dengan yang dikirim.
      isianNip.addEventListener('input', () => {
        const posisi = isianNip.selectionStart;
        isianNip.value = isianNip.value.toUpperCase();
        isianNip.setSelectionRange(posisi, posisi);
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        sembunyikanGalat(panggung);

        const nip = isianNip.value.trim();
        if (!nip || isianPin.value.length < 4) {
          tampilkanGalat(panggung, 'NIP wajib diisi, dan PIN minimal 4 angka.');
          (!nip ? isianNip : isianPin).focus();
          return;
        }

        const mode = form.elements.mode.value === 'luar' ? 'luar' : 'kantor';

        // "Di luar" tanpa koordinat tidak dikirim. Menunggu permintaan yang
        // masih jalan lebih baik daripada menyuruh orang menekan tombol dua
        // kali; kalau ternyata gagal, sebabnya ditulis di layar.
        if (mode === 'luar') {
          if (!gps) {
            await janjiGps?.catch(() => {});
            if (!form.isConnected || langkah !== 'siap') return;
            if (!gps) {
              tampilkanGalat(
                panggung,
                gpsPesan || 'Lokasi belum didapat. Tekan "Coba lagi", atau pilih "Di perusahaan".',
              );
              return;
            }
          }

          // Dicek sebelum kamera: menolak setelah foto diambil hanya membuat
          // orang mengulang potret wajah tanpa tahu masalahnya di GPS.
          if (!Number.isFinite(gps.akurasi) || gps.akurasi > AKURASI_MAKS) {
            const angka = Number.isFinite(gps.akurasi) ? `±${gps.akurasi} m` : 'tidak tercatat';
            tampilkanGalat(
              panggung,
              `Akurasi GPS ${angka} terlalu kasar untuk absen dinas luar (maksimal ${AKURASI_MAKS} m). ` +
                'Jarak dari kantor tidak memengaruhi pemeriksaan ini. Tekan "Ambil ulang" di status ' +
                'lokasi, tunggu GPS membaik, atau pilih "Di perusahaan".',
            );
            return;
          }
        }

        // "Di perusahaan" tidak menunggu lokasi: alamatnya keterangan
        // tambahan, bukan syarat absen. Pengambilan lokasi sudah berjalan
        // sejak formulir dibuka, jadi biasanya selesai sebelum submit.

        mulaiKamera(nip, isianPin.value, mode);
      });
    }

    // ── langkah 2: potret wajah ──────────────────────────────────────────────

    async function mulaiKamera(nip, pin, mode) {
      langkah = 'kamera';
      bersihkanTimer();

      if (!kamera.kameraTersedia()) {
        tampilkanHasil({ ok: false, judul: 'Kamera tidak bisa dipakai', pesan: kamera.pesanKamera(null) });
        return;
      }

      panggung.innerHTML = `
        <div class="w-full max-w-md text-center">
          <p class="text-sm font-medium text-muted">Hadapkan wajah Anda ke kamera</p>

          <div class="relative mt-4 overflow-hidden rounded-[1.75rem] bg-ink/10 ring-1 ring-ink/10">
            <video data-video playsinline muted
                   class="block aspect-[4/3] w-full -scale-x-100 object-cover"></video>
            <div class="absolute inset-0 grid place-items-center bg-ink/30">
              <span data-angka class="text-center text-base font-medium text-white">
                Menyiapkan kamera…
              </span>
            </div>
          </div>

          <p class="mt-4 text-sm text-muted">Foto diambil otomatis.</p>
        </div>`;

      const video = panggung.querySelector('[data-video]');
      const elAngka = panggung.querySelector('[data-angka]');

      try {
        hentikanKamera = await kamera.nyalakan(video);
      } catch (galat) {
        tampilkanHasil({ ok: false, judul: 'Kamera gagal dinyalakan', pesan: kamera.pesanKamera(galat) });
        return;
      }

      // Pengguna bisa sudah menekan tombol lain selagi kamera menyala.
      if (langkah !== 'kamera') return;

      // Hitung mundur baru mulai setelah kamera benar-benar mengirim gambar.
      // Tanpa penungguan ini, webcam yang lambat menghasilkan foto kosong.
      const siap = await kamera.tungguSiap(video);
      if (langkah !== 'kamera') return;

      if (!siap) {
        bersihkanKamera();
        tampilkanHasil({
          ok: false,
          judul: 'Kamera tidak mengirim gambar',
          pesan:
            'Kamera menyala tapi gambar tidak pernah muncul. Cabut lalu pasang ulang ' +
            'webcam, kemudian muat ulang halaman ini.',
        });
        return;
      }

      elAngka.className = 'angka-rata text-7xl font-semibold text-white';
      hitungMundur(elAngka, MULAI_HITUNG, () => {
        let gambar = null;
        try {
          gambar = kamera.potret(video);
        } catch {
          gambar = null;
        }
        bersihkanKamera();

        if (!gambar) {
          tampilkanHasil({
            ok: false,
            judul: 'Foto gagal diambil',
            pesan: 'Kamera menyala tapi gambarnya tidak bisa diambil. Coba lagi.',
          });
          return;
        }

        kirim(nip, pin, gambar, mode);
      });
    }

    function hitungMundur(el, n, selesai) {
      if (langkah !== 'kamera') return;
      if (el) el.textContent = String(n);
      if (n <= 0) {
        selesai();
        return;
      }
      jadwalkan(() => hitungMundur(el, n - 1, selesai), 1000);
    }

    // ── langkah 3: kirim ─────────────────────────────────────────────────────
    // Satu permintaan saja, bukan dua. Verifikasi PIN terpisah akan lebih enak
    // (gagal cepat sebelum potret), tapi itu satu endpoint tambahan untuk
    // teman Anda dan PIN dikirim dua kali.

    async function kirim(nip, pin, gambar, mode) {
      langkah = 'simpan';

      // Tanpa `-scale-x-100`: gambarnya sudah dicerminkan di kanvas oleh
      // kamera.potret(), jadi menambahkannya di sini akan membalik dua kali.
      panggung.innerHTML = `
        <div class="w-full max-w-md text-center">
          <div class="overflow-hidden rounded-[1.75rem] ring-1 ring-ink/10">
            <img src="${gambar}" alt="" class="block aspect-[4/3] w-full object-cover" />
          </div>

          <p class="mt-5 flex items-center justify-center gap-2.5 text-sm font-medium text-muted">
            ${IKON_MUTAR}
            Menyimpan absen…
          </p>
        </div>`;

      try {
        const jawab = await api.post('/kiosk/absen', {
          nip,
          pin,
          foto: gambar,
          kiosk_id: idPerangkat(),
          lokasi_id: lokasi?.id ?? null,
          mode,
          // Titik perangkat ikut untuk kedua mode: server memakainya untuk
          // menghitung jarak dan mencari alamat yang tampil di rekap.
          ...(gps
            ? { lintang: gps.lintang, bujur: gps.bujur, akurasi: gps.akurasi }
            : {}),
        });

        tampilkanHasil({
          ok: true,
          judul: jawab.tipe === 'pulang' ? 'Absen pulang tercatat' : 'Absen masuk tercatat',
          nama: jawab.nama,
          waktu: jawab.waktu,
          tipe: jawab.tipe,
          gambar,
          jarak_m: jawab.jarak_m,
          akurasi: jawab.akurasi,
          lokasi_teks: jawab.lokasi_teks,
          lokasi_meragukan: jawab.lokasi_meragukan,
        });
      } catch (galat) {
        // Kembali ke formulir dengan NIP tetap terisi. Yang perlu diulang cuma
        // PIN-nya, bukan seluruh proses dari awal.
        tampilkanSiap(galat.message, nip);
      }
    }

    // ── langkah 4: hasil ─────────────────────────────────────────────────────

    function tampilkanHasil({
      ok,
      judul,
      pesan = '',
      nama,
      waktu,
      gambar,
      jarak_m = null,
      akurasi = null,
      lokasi_teks = null,
      lokasi_meragukan = false,
    }) {
      langkah = 'hasil';
      bersihkanTimer();
      bersihkanKamera();

      const detik = Math.ceil(JEDA_HASIL / 1000);
      const jarak = formatJarak(jarak_m);
      const akurasiTeks = Number.isFinite(akurasi) ? `GPS ±${Math.round(akurasi)} m` : null;
      const kasar = lokasi_meragukan || (Number.isFinite(akurasi) && akurasi > 50);
      const rincian = [lokasi_teks, jarak ? `${jarak} dari kantor` : null, akurasiTeks]
        .filter(Boolean)
        .join(' · ');

      panggung.innerHTML = `
        <div class="w-full max-w-md text-center">
          <span class="mx-auto grid size-16 place-items-center rounded-full ${
            ok ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'
          }">
            ${ok ? IKON_BENAR : IKON_SALAH}
          </span>

          <h2 class="mt-5 text-2xl font-semibold tracking-tight text-ink">${esc(judul)}</h2>
          ${pesan ? `<p class="mt-2 text-muted">${esc(pesan)}</p>` : ''}

          ${
            ok
              ? `<div class="kaca mt-6 flex items-center gap-3.5 rounded-2xl p-3 text-left">
                   <img src="${gambar}" alt="" class="size-14 shrink-0 rounded-xl object-cover" />
                   <span class="min-w-0 flex-1">
                     <span class="block truncate font-medium text-ink">${esc(nama)}</span>
                     <span class="block text-sm text-muted">Pukul ${esc(jam(waktu))}</span>
                     ${
                       rincian
                         ? `<span class="mt-1 block text-xs ${kasar ? 'font-medium text-amber-700' : 'text-muted'}">
                              ${esc(rincian)}${kasar ? ' · akurasi kasar' : ''}
                            </span>`
                         : ''
                     }
                   </span>
                 </div>`
              : ''
          }

          <button type="button" data-ulang class="${TOMBOL_ULANG}">
            ${IKON_ULANG} Mulai lagi
          </button>

          <p class="mt-4 text-xs text-muted">
            Kembali ke layar awal dalam <span data-sisa class="angka-rata">${detik}</span> detik
          </p>
        </div>`;

      panggung.querySelector('[data-ulang]').addEventListener('click', kembaliKeAwal);

      const el = panggung.querySelector('[data-sisa]');
      let sisa = detik;
      const turun = () => {
        if (langkah !== 'hasil') return;
        sisa -= 1;
        if (el) el.textContent = String(Math.max(sisa, 0));
        if (sisa <= 0) {
          kembaliKeAwal();
          return;
        }
        jadwalkan(turun, 1000);
      };
      jadwalkan(turun, 1000);
    }

    function kembaliKeAwal() {
      bersihkanTimer();
      bersihkanKamera();
      lupakanGps();
      tampilkanSiap();
    }

    // ── lokasi kiosk ─────────────────────────────────────────────────────────
    // Diambil dari alamat halaman (#/absen?lokasi=2), bukan dari GPS. Kiosk ini
    // PC yang tidak berpindah, jadi GPS hanya menambah izin yang harus
    // diklik dan hasil yang bisa meleset.

    async function muatLokasi() {
      const kueri = location.hash.split('?')[1] ?? '';
      const id = new URLSearchParams(kueri).get('lokasi');

      const kueriLokasi = new URLSearchParams({ perangkat: idPerangkat() });
      if (id) kueriLokasi.set('lokasi', id);

      try {
        lokasi = await api.get(`/kiosk/lokasi?${kueriLokasi}`);
      } catch {
        // Lokasi cuma keterangan di sudut layar. Kalau gagal, absen tetap jalan.
        return;
      }

      const el = akar.querySelector('[data-lokasi]');
      el.className = 'kaca flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-ink';
      el.innerHTML = `${IKON_LOKASI}${esc(lokasi.nama)}`;
    }

    tampilkanSiap();
    muatLokasi();

    // Dipanggil router saat berpindah layar. Kamera yang tidak dimatikan di
    // sini akan tetap menyala dan merekam setelah magang pergi.
    return () => {
      bersihkanTimer();
      bersihkanKamera();
      hentikanJam();
    };
  },
};
