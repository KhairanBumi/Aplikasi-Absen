// Layar bersama untuk menu yang belum punya layar sendiri.
//
// Sekarang tidak ada butir menu yang memakainya — seluruh layar sudah jadi.
// Berkasnya sengaja tetap ada sebagai jaring pengaman: menu baru yang
// ditambahkan tanpa layar tetap bisa diklik dan menjelaskan dirinya sendiri,
// alih-alih membuat router menabrak rute yang tidak punya berkas.

import { pasangKerangka } from '../kerangka.js';
import { butirMenu } from '../menu.js';
import { pengguna } from '../api.js';

export default {
  judul: 'Sedang disiapkan',

  mount(akar) {
    const butir = butirMenu(location.hash.split('?')[0]);
    const isi = pasangKerangka(akar, { judul: butir?.label ?? 'Sedang disiapkan' });

    isi.innerHTML = `
      <div class="kaca mx-auto flex max-w-2xl flex-col items-center rounded-[1.75rem] px-6 py-16 text-center sm:py-20">
        <span class="grid size-16 place-items-center rounded-full bg-white/70 text-merek
                     ring-1 ring-ink/8">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" class="size-8" aria-hidden="true">
            <path d="M12 3.5v3" /><path d="M12 17.5v3" />
            <path d="M3.5 12h3" /><path d="M17.5 12h3" />
            <path d="M5.6 5.6l2.1 2.1" /><path d="M16.3 16.3l2.1 2.1" />
            <path d="M18.4 5.6l-2.1 2.1" /><path d="M7.7 16.3l-2.1 2.1" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        </span>

        <h2 class="mt-5 text-xl font-semibold tracking-tight text-ink">Layar ini sedang disiapkan</h2>
        <p class="mx-auto mt-2 max-w-md text-muted">
          ${
            butir?.fase
              ? `Rencananya dikerjakan pada <span class="font-medium text-ink">Fase ${butir.fase}</span>.`
              : 'Rencananya dikerjakan setelah kerangka aplikasi selesai.'
          }
          Tampilannya sudah ada di menu supaya susunan navigasinya bisa Anda nilai sekarang.
        </p>

        <a href="${pengguna()?.peran === 'magang' ? '#/riwayat' : '#/beranda'}"
           class="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-merek px-5 py-2.5
                  text-sm font-medium text-white shadow-naik transition duration-200 ease-apple
                  hover:bg-merek-gelap active:scale-[0.98]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
               stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
            <path d="M14.5 6.5 9 12l5.5 5.5" />
          </svg>
          Kembali ke beranda
        </a>
      </div>`;
  },
};
