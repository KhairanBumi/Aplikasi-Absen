// Penyusun CSV rekap bulanan berbentuk matriks kehadiran: satu baris per
// magang, satu kolom per tanggal, seperti lembar absensi kelas.
//
// Dipisah dari layar supaya bentuk berkasnya bisa diuji tanpa DOM. Baris
// pertama sampai kelima adalah identitas laporan, baris keenam kosong, lalu
// kepala tabel, baris magang, dan legenda di bawah.

const HARI = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BULAN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// E memuat izin, cuti, dan sakit sekaligus: di lembar absensi ketiganya sama —
// hari yang tidak masuk dengan alasan yang sudah disetujui.
const KODE = {
  tepat: 'P',
  telat: 'T',
  izin: 'E',
  cuti: 'E',
  sakit: 'E',
  alpha: 'U',
  libur: 'L',
  belum: '',
};

/**
 * @param {{ laporan: { bulan: string, data: object[] }, admin?: string }} isian
 * @returns {string[][]} baris CSV siap dikirim ke `susunCSV`
 */
export function susunMatriksCSV({ laporan, admin = '' }) {
  const [tahun, nomorBulan] = String(laporan.bulan ?? '')
    .split('-')
    .map(Number);

  const sah =
    Number.isInteger(tahun) &&
    Number.isInteger(nomorBulan) &&
    nomorBulan >= 1 &&
    nomorBulan <= 12;
  const jumlahHari = sah ? new Date(tahun, nomorBulan, 0).getDate() : 0;

  const tanggal = [];
  for (let hari = 1; hari <= jumlahHari; hari += 1) {
    const tgl = new Date(tahun, nomorBulan - 1, hari);
    tanggal.push({
      kunci: `${tahun}-${String(nomorBulan).padStart(2, '0')}-${String(hari).padStart(2, '0')}`,
      label: `${HARI[tgl.getDay()]} ${hari}`,
    });
  }

  const baris = Array.isArray(laporan?.data) ? laporan.data : [];

  const hasil = [
    ['Room', satuNilai(baris.map((u) => u.lokasi), 'All rooms')],
    ['Instructor Name', admin ?? ''],
    ['Subject', satuNilai(baris.map((u) => u.divisi), 'All divisions')],
    ['Month', sah ? BULAN[nomorBulan - 1] : ''],
    ['Year', sah ? String(tahun) : ''],
    [],
    [
      'NIP',
      'Student Name',
      'Division',
      ...tanggal.map((t) => t.label),
      'P',
      'T',
      'E',
      'U',
    ],
  ];

  for (const orang of baris) {
    const perHari = new Map((orang.harian ?? []).map((h) => [h.tanggal, h]));
    const sel = tanggal.map((t) => kodeSel(orang, perHari.get(t.kunci)));
    const hitung = (kode) => sel.filter((s) => s === kode).length;

    hasil.push([
      orang.nip,
      orang.nama,
      orang.divisi ?? '',
      ...sel,
      hitung('P'),
      hitung('T'),
      hitung('E'),
      hitung('U'),
    ]);
  }

  hasil.push([]);
  hasil.push([
    'Legend',
    'P = Present, T = Tardy, U = Unexcused, E = Excused, L = Holiday, blank = no record.',
  ]);

  return hasil;
}

function kodeSel(orang, hari) {
  if (!hari) return '';

  // Hari sebelum orang itu masuk kerja bukan "libur kantor" dan bukan alpha.
  // Selnya dibiarkan kosong supaya tidak terbaca sebagai cuti bersama.
  if (orang.masuk_kerja && hari.tanggal < orang.masuk_kerja) return '';
  if (hari.status === 'libur' && hari.keterangan_libur === 'Belum masuk kerja') return '';

  return KODE[hari.status] ?? '';
}

function satuNilai(daftar, kalauBanyak) {
  const unik = [...new Set(daftar.filter((nilai) => nilai))];
  if (unik.length === 0) return '';
  return unik.length === 1 ? unik[0] : kalauBanyak;
}
