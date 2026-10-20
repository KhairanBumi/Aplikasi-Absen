import { api, simpanSesi, MODE_TIRUAN } from '../api.js';
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

const IKON_AKUN = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
  </svg>`;

// Pil penuh, sama seperti tombol di seluruh aplikasi. `active:scale` itu umpan
// balik tekan — di kiosk yang memakai keyboard, ini yang membuat tombolnya
// terasa merespons.
const KELAS_TOMBOL =
  'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-merek px-5 py-3.5 ' +
  'font-medium text-white shadow-naik transition duration-200 ease-apple hover:bg-merek-gelap ' +
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100';

// Akun demo hanya ditampilkan saat backend belum tersambung.
//
// Isinya cuma admin, dan itu memang seharusnya: akun anak magang tidak dibawa
// dari awal — admin yang membuatnya lewat Data Master. Dulu ada satu akun
// magang contoh di sini; setelah datanya dikosongkan akun itu tidak bisa
// dipakai masuk lagi, dan tombol yang selalu gagal lebih membingungkan
// daripada tidak ada tombol sama sekali.
//
// Masuk memakai NIP + PIN, bukan email + kata sandi. PIN-nya sama dengan yang
// dipakai absen di kiosk, jadi tidak ada rahasia kedua yang perlu dihafal.
const AKUN_DEMO = [{ label: 'Admin', nip: 'ADM001', pin: '1111' }];

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

            ${
              MODE_TIRUAN
                ? `<div class="mt-6 border-t border-ink/10 pt-5">
                     <p class="mb-2.5 text-xs font-semibold tracking-wide text-muted uppercase">
                       Akun demo
                     </p>
                     <div class="grid gap-1.5">
                       ${AKUN_DEMO.map(
                         (a) => `
                         <button type="button" data-demo
                                 data-nip="${a.nip}" data-pin="${a.pin}"
                                 class="group flex cursor-pointer items-center gap-3 rounded-xl border border-ink/8
                                        bg-white/55 px-3 py-2.5 text-left transition duration-200 ease-apple
                                        hover:border-merek/30 hover:bg-white/85 active:scale-[0.99]">
                           <span class="grid size-8 shrink-0 place-items-center rounded-full bg-merek/12 text-xs font-semibold text-merek">
                             ${a.label[0]}
                           </span>
                           <span class="min-w-0 flex-1">
                             <span class="block text-sm font-medium text-ink">${a.label}</span>
                             <span class="block truncate font-mono text-xs text-muted">${a.nip} · PIN ${a.pin}</span>
                           </span>
                           <span class="flex shrink-0 items-center gap-1 text-xs font-medium text-merek opacity-0 transition group-hover:opacity-100">
                             Isi <span class="hidden sm:inline">otomatis</span>${IKON_AKUN}
                           </span>
                         </button>`,
                       ).join('')}
                     </div>
                   </div>`
                : ''
            }
          </div>
        </div>
      </main>`;

    const form = akar.querySelector('form');
    const inputPin = form.elements.pin;
    const tombol = form.querySelector('button[type="submit"]');
    const label = tombol.querySelector('[data-label]');
    const pemutar = tombol.querySelector('[data-mutar]');

    const hentikanJam = jamBerjalan(akar.querySelector('[data-jam]'), akar.querySelector('[data-tanggal]'));

    // Akun demo: sekali klik mengisi form, jadi tidak perlu mengetik ulang.
    for (const b of akar.querySelectorAll('[data-demo]')) {
      b.addEventListener('click', () => {
        form.elements.nip.value = b.dataset.nip;
        inputPin.value = b.dataset.pin;
        sembunyikanGalat(akar);
        tombol.focus();
      });
    }

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
