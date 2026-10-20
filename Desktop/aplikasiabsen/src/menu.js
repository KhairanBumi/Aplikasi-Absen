// Daftar menu: satu tempat untuk dua hal sekaligus — penamaan rute dan isi
// sidebar. Menambah layar berarti menambah satu baris di sini.
//
// `fase` menandai layar yang belum dibuat; selama ada, rutenya memakai layar
// "sedang disiapkan" di segera.js. Tidak ada butir yang memakainya lagi —
// seluruh layar sudah jadi — tapi mekanismenya sengaja dibiarkan hidup: menu
// baru yang ditambahkan tanpa layar tetap bisa diklik, bukan menabrak.

export const MENU = [
  {
    bagian: 'Utama',
    butir: [
      {
        jalur: '#/beranda',
        label: 'Beranda',
        // Magang tidak punya beranda. Seluruh isinya hanya dua hal — melihat
        // rekap absennya sendiri dan mengajukan izin — dan dua menu di bawah
        // itu sudah mencakup keduanya.
        peran: ['admin'],
        ikon: '<path d="M3.5 10.7 12 3.8l8.5 6.9"/><path d="M6 9.6V20h12V9.6"/>',
      },
    ],
  },
  {
    bagian: 'Kehadiran',
    butir: [
      {
        jalur: '#/absen',
        label: 'Kiosk Absen',
        // `peran` mengatur siapa yang melihat menunya di sidebar.
        // `publik` mengatur siapa yang boleh membuka rutenya. Dua hal berbeda:
        // kiosk cuma perlu dilihat admin, tapi alamatnya harus bisa dibuka PC
        // kiosk tanpa login sama sekali.
        peran: ['admin'],
        publik: true,
        ikon: '<path d="M4 8.5V5.8A1.8 1.8 0 0 1 5.8 4H8.5"/><path d="M15.5 4h2.7A1.8 1.8 0 0 1 20 5.8v2.7"/><path d="M20 15.5v2.7a1.8 1.8 0 0 1-1.8 1.8h-2.7"/><path d="M8.5 20H5.8A1.8 1.8 0 0 1 4 18.2v-2.7"/><path d="M8 12h8"/>',
      },
      {
        jalur: '#/riwayat',
        label: 'Riwayat Absen',
        peran: ['magang'],
        ikon: '<path d="M3.8 12a8.2 8.2 0 1 0 2.5-5.9"/><path d="M3.8 4.8V9h4.2"/><path d="M12 8.2V12l3 1.8"/>',
      },
      {
        jalur: '#/laporan',
        label: 'Rekap & Laporan',
        peran: ['admin'],
        ikon: '<path d="M3.5 20h17"/><path d="M6.5 20v-7"/><path d="M11 20V5"/><path d="M15.5 20v-4.5"/><path d="M20 20v-9"/>',
      },
    ],
  },
  {
    bagian: 'Pengajuan',
    butir: [
      {
        jalur: '#/izin-masuk',
        label: 'Persetujuan Izin',
        peran: ['admin'],
        ikon: '<path d="M4 13.5V6.5A2 2 0 0 1 6 4.5h12a2 2 0 0 1 2 2v7"/><path d="M4 13.5h4.2l1.3 2.2h5l1.3-2.2H20"/><path d="M4 20h16"/><path d="M4 13.5V20"/>',
      },
      {
        jalur: '#/izin',
        label: 'Izin & Cuti',
        peran: ['magang'],
        ikon: '<path d="M6.5 3.5h7.2l4.8 4.8V20a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5v5h5"/><path d="M9 13h6"/><path d="M9 16.5h4"/>',
      },
    ],
  },
  {
    bagian: 'Data Master',
    butir: [
      {
        jalur: '#/magang',
        label: 'Anak Magang',
        peran: ['admin'],
        ikon: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2"/><path d="M16 5.6a3.2 3.2 0 0 1 0 6"/><path d="M18 14.6c2 .7 3.2 2.3 3.2 4.9"/>',
      },
      {
        jalur: '#/lokasi',
        label: 'Lokasi Kantor',
        peran: ['admin'],
        ikon: '<path d="M12 20.5s6.5-5.3 6.5-10.4a6.5 6.5 0 1 0-13 0C5.5 15.2 12 20.5 12 20.5Z"/><circle cx="12" cy="10" r="2.4"/>',
      },
      {
        jalur: '#/shift',
        label: 'Shift Kerja',
        peran: ['admin'],
        ikon: '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.4V12l3.1 1.9"/>',
      },
      {
        jalur: '#/hari-libur',
        label: 'Hari Libur',
        peran: ['admin'],
        ikon: '<rect x="3.8" y="5.2" width="16.4" height="15" rx="2"/><path d="M3.8 9.6h16.4"/><path d="M8.2 3.6v3.2"/><path d="M15.8 3.6v3.2"/>',
      },
    ],
  },
];

const SEMUA_PERAN = ['admin', 'magang'];

/** Butir menu yang boleh dilihat peran tertentu, tanpa bagian yang jadi kosong. */
export function menuUntuk(peran) {
  return MENU.map((bagian) => ({
    bagian: bagian.bagian,
    butir: bagian.butir.filter((b) => (b.peran ?? SEMUA_PERAN).includes(peran)),
  })).filter((bagian) => bagian.butir.length > 0);
}

/** Semua butir, datar. Dipakai router untuk daftar rute dan perannya. */
export function semuaButir() {
  return MENU.flatMap((bagian) => bagian.butir);
}

export function butirMenu(jalur) {
  return semuaButir().find((b) => b.jalur === jalur) ?? null;
}
