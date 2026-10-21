import { api, simpanSesi } from '../api.js';
import { tampilkanGalat, sembunyikanGalat, beritahu, jamBerjalan, KELAS_ISIAN } from '../ui.js';

const IKON_MEREK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
       stroke-linecap="round" stroke-linejoin="round" class="size-7" aria-hidden="true">
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.1 1.9" />
  </svg>`;

const IKON_GALAT = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5" />
    <path d="M12 16.2h.01" />
  </svg>`;

const IKON_MUTAR = `
  <svg viewBox="0 0 24 24" fill="none" class="size-4 animate-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-25" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
  </svg>`;

// Pil penuh, sama seperti tombol di seluruh aplikasi. `active:scale` itu umpan
// balik tekan — di kiosk yang memakai keyboard, ini yang membuat tombolnya
// terasa merespons.
const KELAS_TOMBOL =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-merek px-5 py-3.5 ' +
  'font-medium text-white shadow-naik transition duration-200 ease-apple hover:bg-merek-gelap ' +
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100';

export default {
  judul: 'Masuk',

  mount(akar) {
    akar.innerHTML = `
      <main class="flex min-h-dvh flex-col items-center justify-center px-5 py-8">
        <div class="w-full max-w-[26rem]">

          <div class="mb-6 text-center">
            <span class="mx-auto grid size-14 place-items-center rounded-[1.15rem] bg-white/70 text-merek
                         shadow-naik ring-1 ring-white/80 backdrop-blur-xl">
              ${IKON_MEREK}
            </span>
            <p class="mt-4 text-sm font-medium text-muted">Aplikasi Absen</p>
            <p data-jam class="angka-rata mt-1 text-[3.25rem] leading-none font-semibold tracking-tight text-ink">
              --.--.--
            </p>
            <p data-tanggal class="mt-2 text-sm text-muted">—</p>
          </div>

          <div class="kaca rounded-[1.75rem] p-6 sm:p-7">
            <h1 class="text-xl font-semibold tracking-tight text-ink">Selamat datang kembali</h1>
            <p class="mt-1 text-sm text-muted">Masuk dengan NIP dan PIN Anda.</p>

            <div data-galat role="alert" hidden
                 class="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-900">
              ${IKON_GALAT}
              <span data-galat-teks></span>
            </div>

            <form novalidate class="mt-6 space-y-4">
              <div>
                <label for="nip" class="mb-1.5 block text-sm font-medium text-ink">NIP</label>
                <input id="nip" name="nip" type="text" autocomplete="username" required
                       placeholder="MGG001" class="${KELAS_ISIAN}" />
              </div>

              <div>
                <label for="pin" class="mb-1.5 block text-sm font-medium text-ink">PIN</label>
                <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" required
                       placeholder="4 sampai 6 angka" class="${KELAS_ISIAN}" />
                <p class="mt-1.5 text-xs text-muted">Sama dengan PIN yang Anda ketik di kiosk.</p>
              </div>

              <button type="submit" class="${KELAS_TOMBOL}">
                <span data-mutar hidden>${IKON_MUTAR}</span>
                <span data-label>Masuk</span>
              </button>
            </form>
          </div>
        </div>
      </main>`;

    const form = akar.querySelector('form');
    const inputPin = form.elements.pin;
    const tombol = form.querySelector('button[type="submit"]');
    const label = tombol.querySelector('[data-label]');
    const pemutar = tombol.querySelector('[data-mutar]');

    const hentikanJam = jamBerjalan(akar.querySelector('[data-jam]'), akar.querySelector('[data-tanggal]'));

    function sibuk(aktif) {
      tombol.disabled = aktif;
      pemutar.hidden = !aktif;
      label.textContent = aktif ? 'Memeriksa…' : 'Masuk';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      sembunyikanGalat(akar);

      const nip = form.elements.nip.value.trim();
      const pin = form.elements.pin.value;

      if (!nip || !pin) {
        tampilkanGalat(akar, 'NIP dan PIN wajib diisi.');
        (nip ? form.elements.pin : form.elements.nip).focus();
        return;
      }

      sibuk(true);
      let hasil = null;
      try {
        hasil = await api.post('/masuk', { nip, pin });
      } catch (galat) {
        tampilkanGalat(akar, galat.message);
        inputPin.value = '';
        inputPin.focus();
      } finally {
        sibuk(false);
      }

      if (!hasil) return;

      // Sesi disimpan lebih dulu, jadi pengguna benar-benar sudah masuk saat
      // pemberitahuannya muncul. Setelah itu baru dipindah ke halaman
      // pertamanya — admin ke beranda, magang ke riwayat absennya.
      simpanSesi(hasil);
      await beritahu({
        judul: 'Berhasil masuk',
        pesan: `Selamat datang, ${hasil.pengguna.nama}. Anda masuk sebagai ${hasil.pengguna.peran}.`,
      });
      location.replace(hasil.pengguna.peran === 'admin' ? '#/beranda' : '#/riwayat');
    });

    // Sesi yang sudah ada sudah dialihkan router sebelum layar ini dipasang,
    // jadi di sini selalu aman untuk langsung menaruh fokus di kolom pertama.
    form.elements.nip.focus();

    return hentikanJam;
  },
};
