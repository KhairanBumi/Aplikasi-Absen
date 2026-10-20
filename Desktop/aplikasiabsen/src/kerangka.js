// Kerangka aplikasi: sidebar, bilah atas, dan tombol keluar.
// Dipakai semua layar setelah login, supaya navigasi tidak ditulis ulang.
// Layar kiosk tidak memakai ini — kiosk memang harus layar penuh.
//
// Semua permukaan di sini kaca mengambang, bukan bilah penuh tinggi yang
// menempel di tepi. Efeknya baru terasa kalau isi halaman bisa lewat di
// belakangnya, jadi jarak tepi (top-4 / left-4 / mx-6) itu bagian dari
// rancangannya — jangan dirapatkan ke nol.

import { api, hapusSesi, pengguna } from './api.js';
import { menuUntuk } from './menu.js';
import { esc, konfirmasi, inisial } from './ui.js';

const IKON_MEREK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
       stroke-linecap="round" stroke-linejoin="round" class="size-5" aria-hidden="true">
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.1 1.9" />
  </svg>`;

const IKON_KELUAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
    <path d="M15 17l5-5-5-5" />
    <path d="M20 12H9" />
    <path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
  </svg>`;

// Pil, bukan kotak bersudut. Tombol bulat penuh adalah salah satu tanda paling
// khas dari bahasa tampilan Apple, jadi dipakai konsisten di seluruh aplikasi.
const KELAS_KELUAR =
  'flex cursor-pointer items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-3.5 py-2 ' +
  'text-sm font-medium text-ink transition duration-200 ease-apple hover:bg-white/90 active:scale-[0.97]';

const KELAS_DIAM = 'font-medium text-muted hover:bg-ink/6 hover:text-ink';
const KELAS_AKTIF = 'bg-merek font-semibold text-white shadow-naik';

function butirNav(b, jalurAktif, { samping }) {
  const aktif = b.jalur === jalurAktif;
  const ukuran = samping ? 'size-[1.15rem]' : 'size-4';

  // Nama kelas ditulis utuh, bukan dirakit. Tailwind memindai berkas ini
  // sebagai teks, jadi kelas hasil rangkaian tidak akan ikut dibuat.
  const kelas = samping
    ? `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] transition duration-200 ease-apple active:scale-[0.98] ${aktif ? KELAS_AKTIF : KELAS_DIAM}`
    : `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition duration-200 ease-apple active:scale-[0.97] ${aktif ? KELAS_AKTIF : 'text-muted hover:bg-white/70 hover:text-ink'}`;

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
        <p class="px-3 pt-5 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted uppercase">
          ${esc(bagian.bagian)}
        </p>
        ${bagian.butir.map((b) => butirNav(b, jalurAktif, { samping: true })).join('')}`,
    )
    .join('');

  const navAtas = menu
    .flatMap((bagian) => bagian.butir)
    .map((b) => butirNav(b, jalurAktif, { samping: false }))
    .join('');

  akar.innerHTML = `
    <div class="min-h-dvh lg:pl-[17rem]">

      <!-- Kabut di tepi atas: tanpa ini, teks yang digulir naik akan terlihat
           lewat celah 1rem di atas bilah dan tampak berantakan. -->
      <div class="pointer-events-none fixed top-0 right-0 left-0 z-10 h-24 backdrop-blur-md
                  [mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_100%)]
                  [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_100%)]
                  lg:left-[17rem]"></div>

      <aside class="kaca fixed top-4 bottom-4 left-4 z-30 hidden w-64 flex-col rounded-[1.75rem] lg:flex">
        <div class="flex h-16 shrink-0 items-center gap-2.5 px-5">
          <span class="grid size-9 place-items-center rounded-xl bg-merek text-white shadow-naik">${IKON_MEREK}</span>
          <span class="font-semibold tracking-tight text-ink">Aplikasi Absen</span>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 pb-3" aria-label="Navigasi utama">
          ${navSamping}
        </nav>

        <div class="shrink-0 p-3">
          <div class="flex items-center gap-2.5 rounded-2xl bg-white/55 p-2.5 ring-1 ring-ink/8">
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-merek text-xs font-semibold text-white">
              ${esc(inisial(p.nama))}
            </span>
            <span class="min-w-0 leading-tight">
              <span class="block truncate text-sm font-medium text-ink">${esc(p.nama)}</span>
              <span class="block truncate text-xs text-muted">${esc(p.divisi || p.peran)}</span>
            </span>
          </div>
        </div>
      </aside>

      <div class="flex min-h-dvh flex-col">
        <header class="kaca sticky top-4 z-20 mx-4 rounded-[1.75rem] lg:mx-6">
          <div class="flex h-16 items-center gap-3 px-4 sm:px-5">
            <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-merek text-white shadow-naik lg:hidden">
              ${IKON_MEREK}
            </span>
            <h1 class="truncate text-lg font-semibold tracking-tight text-ink">${esc(judul)}</h1>

            <div class="ml-auto flex shrink-0 items-center gap-2">
              ${aksi}
              <button type="button" data-keluar class="${KELAS_KELUAR}">
                ${IKON_KELUAR}
                <span class="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>

          <nav class="flex gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
               aria-label="Navigasi utama">
            ${navAtas}
          </nav>
        </header>

        <main class="flex-1 px-4 py-6 sm:px-6">
          <div data-isi class="mx-auto max-w-6xl"></div>
        </main>
      </div>
    </div>`;

  const tombol = akar.querySelector('[data-keluar]');
  tombol.addEventListener('click', async () => {
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

  return akar.querySelector('[data-isi]');
}
