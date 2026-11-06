// Kerangka aplikasi: sidebar, bilah atas, dan tombol keluar.
// Dipakai semua layar setelah login, supaya navigasi tidak ditulis ulang.
// Layar kiosk tidak memakai ini — kiosk memang harus layar penuh.
//
// Semua permukaan di sini kaca mengambang, bukan bilah penuh tinggi yang
// menempel di tepi. Efeknya baru terasa kalau isi halaman bisa lewat di
// belakangnya, jadi jarak tepi (top-4 / left-4) itu bagian dari rancangannya
// — jangan dirapatkan ke nol.
//
// Bilah atas sengaja memakai pola yang sama dengan kolom isi: padding luar
// yang sama, lalu lebar maksimum yang sama di dalamnya. Kalau tidak, tepi
// bilah dan tepi kartu meleset — melebar di layar lebar, dan meleset 8px di
// layar sedang.

import { api, hapusSesi, pengguna } from './api.js';
import { menuUntuk } from './menu.js';
import { esc, konfirmasi, inisial } from './ui.js';

const IKON_KELUAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M15 17l5-5-5-5" />
    <path d="M20 12H9" />
    <path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
  </svg>`;

const IKON_MENU = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>`;

const IKON_TUTUP = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </svg>`;

// Pil, bukan kotak bersudut. Tombol bulat penuh adalah salah satu tanda paling
// khas dari bahasa tampilan Apple, jadi dipakai konsisten di seluruh aplikasi.
const KELAS_KELUAR =
  'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-ink/10 ' +
  'bg-white/60 px-3.5 py-2 text-sm font-medium text-ink transition duration-200 ease-apple ' +
  'hover:bg-white/90 active:scale-[0.97]';

// Teks sekunder di atas kaca 0.62 memakai ink/70, bukan muted: muted jatuh ke
// ~3.0:1 bila orb teal berada di belakang sidebar.
const KELAS_DIAM = 'font-medium text-ink/70 hover:bg-ink/6 hover:text-ink';
const KELAS_AKTIF = 'bg-merek font-semibold text-white shadow-naik';

function butirNav(b, jalurAktif, { samping }) {
  const aktif = b.jalur === jalurAktif;
  const ukuran = samping ? 'size-[1.15rem]' : 'size-4';

  // Nama kelas ditulis utuh, bukan dirakit. Tailwind memindai berkas ini
  // sebagai teks, jadi kelas hasil rangkaian tidak akan ikut dibuat.
  const kelas = samping
    ? `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] transition duration-200 ease-apple active:scale-[0.98] ${aktif ? KELAS_AKTIF : KELAS_DIAM}`
    : `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition duration-200 ease-apple active:scale-[0.97] ${aktif ? KELAS_AKTIF : 'text-ink/70 hover:bg-white/70 hover:text-ink'}`;

  return `
    <a href="${b.jalur}" ${aktif ? 'aria-current="page"' : ''} class="${kelas}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
           stroke-linecap="round" stroke-linejoin="round" class="${ukuran} shrink-0" aria-hidden="true">${b.ikon}</svg>
      ${esc(b.label)}
    </a>`;
}

/**
 * Menggambar kerangka ke dalam `akar`, lalu mengembalikan elemen isi untuk
 * diisi oleh layar pemanggilnya.
 */
export function pasangKerangka(akar, { judul, aksi = '' }) {
  const p = pengguna();
  const menu = menuUntuk(p.peran);
  const jalurAktif = location.hash.split('?')[0];

  const navSamping = menu
    .map(
      (bagian) => `
        <p class="px-3 pt-5 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-ink/70 uppercase">
          ${esc(bagian.bagian)}
        </p>
        ${bagian.butir.map((b) => butirNav(b, jalurAktif, { samping: true })).join('')}`,
    )
    .join('');

  const kartuPengguna = `
    <div class="flex items-center gap-2.5 rounded-2xl bg-white/60 p-2.5 ring-1 ring-ink/8">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-merek text-xs font-semibold text-white">
        ${esc(inisial(p.nama))}
      </span>
      <span class="min-w-0 leading-tight">
        <span class="block truncate text-sm font-medium text-ink">${esc(p.nama)}</span>
        <span class="block truncate text-xs text-ink/70">${esc(p.divisi || p.peran)}</span>
      </span>
    </div>`;

  akar.innerHTML = `
    <div class="area-kaca min-h-dvh lg:pl-[17rem]">

      <a href="#isi-utama" data-lewati
         class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50
                focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm
                focus:font-medium focus:text-ink focus:shadow-naik">
        Lewati ke isi utama
      </a>

      <!-- Kabut di tepi atas: tanpa ini, teks yang digulir naik akan terlihat
           lewat celah 1rem di atas bilah dan tampak berantakan. -->
      <div class="pointer-events-none fixed top-0 right-0 left-0 z-10 h-24 backdrop-blur-md
                  [mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_100%)]
                  [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_100%)]
                  lg:left-[17rem]"></div>

      <aside class="kaca fixed top-4 bottom-4 left-4 z-30 hidden w-64 flex-col rounded-[1.75rem] lg:flex">
        <div class="flex h-20 shrink-0 items-center justify-center px-4">
          <img src="/bpjs-logo.png" alt="BPJS Ketenagakerjaan"
               width="301" height="72" class="h-10 w-auto" />
        </div>

        <nav class="scroll-samping flex-1 overflow-y-auto px-3 pb-3" aria-label="Navigasi utama">
          ${navSamping}
        </nav>

        <div class="shrink-0 p-3">${kartuPengguna}</div>
      </aside>

      <div class="flex min-h-dvh flex-col">
        <!-- Bilahnya menempel, kacanya melayang. Wrapper-nya transparan supaya
             kolom isi dan bilah memakai satu lebar yang sama: padding luar
             px-3 sm:px-6 meniru main, lalu max-w-6xl di dalamnya meniru kolom
             konten. Padding dalam px-4 sm:px-6 meniru kartu isi, jadi teks
             judul bilah segaris dengan teks kartu di bawahnya. -->
        <header class="pointer-events-none sticky top-3 z-20 px-3 sm:top-4 sm:px-6">
          <div class="kaca pointer-events-auto mx-auto flex h-14 max-w-6xl items-center gap-2
                      rounded-[1.5rem] px-4 sm:h-16 sm:gap-3 sm:rounded-[1.75rem] sm:px-6">
            <button type="button" data-menu-buka
                    class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink
                           transition duration-200 ease-apple hover:bg-white/70 active:scale-95 lg:hidden"
                    aria-label="Buka menu" aria-expanded="false" aria-controls="menu-seluler">
              ${IKON_MENU}
            </button>

            <h1 class="min-w-0 truncate text-base font-semibold tracking-tight text-ink sm:text-lg">${esc(judul)}</h1>

            <div class="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              ${aksi}
              <button type="button" data-keluar class="${KELAS_KELUAR}" aria-label="Keluar">
                ${IKON_KELUAR}
                <span class="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </header>

        <main id="isi-utama" tabindex="-1" class="flex-1 px-3 py-4 outline-none sm:px-6 sm:py-6">
          <div data-isi class="mx-auto max-w-6xl"></div>
        </main>
      </div>
    </div>

    <dialog id="menu-seluler" data-menu aria-label="Menu"
            class="menu-seluler kaca-tebal fixed top-4 bottom-auto left-4 z-50 m-0 max-h-[calc(100dvh-2rem)]
                   w-[min(19rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-[1.75rem] p-0
                   text-ink lg:hidden">
      <div class="flex max-h-[inherit] flex-col">
        <div class="relative flex h-16 shrink-0 items-center justify-center px-14">
          <img src="/bpjs-logo.png" alt="BPJS Ketenagakerjaan"
               width="301" height="72" class="h-8 w-auto" />
          <button type="button" data-menu-tutup
                  class="absolute top-1/2 right-2 grid size-11 shrink-0 -translate-y-1/2 cursor-pointer
                         place-items-center rounded-full text-ink transition duration-200 ease-apple
                         hover:bg-ink/6 active:scale-95"
                  aria-label="Tutup menu">
            ${IKON_TUTUP}
          </button>
        </div>

        <nav class="scroll-samping min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigasi utama">
          ${navSamping}
        </nav>

        <div class="shrink-0 border-t border-ink/8 p-3">
          ${kartuPengguna}
          <button type="button" data-keluar class="${KELAS_KELUAR} mt-2 w-full justify-center">
            ${IKON_KELUAR}
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </dialog>`;

  const lewati = akar.querySelector('[data-lewati]');
  lewati?.addEventListener('click', (e) => {
    // Jangan biarkan hash berubah: router menganggap `#isi-utama` rute tak
    // dikenal dan akan memasang ulang halaman, bukan melompat ke isinya.
    e.preventDefault();
    akar.querySelector('#isi-utama')?.focus();
  });

  const tombolMenu = akar.querySelector('[data-menu-buka]');
  const menuSeluler = akar.querySelector('[data-menu]');

  function tutupMenu() {
    if (menuSeluler?.open) menuSeluler.close();
  }

  function bukaMenu() {
    if (!menuSeluler || menuSeluler.open) return;
    tombolMenu?.setAttribute('aria-expanded', 'true');
    menuSeluler.showModal();
    menuSeluler.querySelector('[data-menu-tutup]')?.focus();
    menuSeluler
      .querySelector('nav [aria-current="page"]')
      ?.scrollIntoView({ block: 'center' });
  }

  tombolMenu?.addEventListener('click', bukaMenu);
  menuSeluler?.querySelector('[data-menu-tutup]')?.addEventListener('click', tutupMenu);
  menuSeluler?.addEventListener('close', () => {
    tombolMenu?.setAttribute('aria-expanded', 'false');
    tombolMenu?.focus({ preventScroll: true });
  });
  menuSeluler?.addEventListener('click', (e) => {
    if (e.target === menuSeluler) {
      tutupMenu();
      return;
    }
    if (e.target.closest('a[href^="#/"]')) tutupMenu();
  });

  for (const tombol of akar.querySelectorAll('[data-keluar]')) {
    tombol.addEventListener('click', async () => {
      tutupMenu();

      const yakin = await konfirmasi({
        judul: 'Keluar dari aplikasi?',
        pesan: 'Anda perlu memasukkan NIP dan PIN lagi untuk masuk.',
        tombol: 'Keluar',
        bahaya: true,
      });
      if (!yakin) return;

      tombol.disabled = true;
      // Kegagalan di sisi server tidak boleh menahan orang tetap masuk di perangkat ini.
      await api.post('/keluar').catch(() => {});
      hapusSesi();
      location.replace('#/masuk');
    });
  }

  // Menu yang sedang dibuka harus terlihat, termasuk saat sidebar punya
  // gulirannya sendiri di layar pendek.
  requestAnimationFrame(() => {
    akar
      .querySelector('aside nav [aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest' });
  });

  // Menekan menu halaman yang sedang aktif tidak memicu hashchange. Tanpa ini,
  // halaman tetap di posisi gulir sebelumnya dan terasa tidak merespons.
  akar.addEventListener('click', (e) => {
    const tautan = e.target.closest('a[href^="#/"]');
    if (tautan && tautan.getAttribute('href') === location.hash) {
      window.scrollTo({ top: 0, left: 0 });
    }
  });

  return akar.querySelector('[data-isi]');
}
