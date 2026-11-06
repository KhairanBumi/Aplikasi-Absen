import { describe, expect, it } from 'vitest';

import { susunMatriksCSV } from './laporan-csv.js';

function hari(tanggal, status, keterangan_libur = null) {
  return { tanggal, status, keterangan_libur };
}

function laporanContoh() {
  return {
    bulan: '2026-10',
    data: [
      {
        nip: 'MGG001',
        nama: 'Siti Rahayu',
        divisi: 'Pendataan',
        lokasi: 'Kantor Pusat',
        masuk_kerja: '2026-10-02',
        harian: [
          hari('2026-10-01', 'libur', 'Belum masuk kerja'),
          hari('2026-10-02', 'tepat'),
          hari('2026-10-03', 'libur', 'Hari Sabtu'),
          hari('2026-10-04', 'libur', 'Hari Minggu'),
          hari('2026-10-05', 'telat'),
          hari('2026-10-06', 'izin'),
          hari('2026-10-07', 'alpha'),
          hari('2026-10-08', 'belum'),
          hari('2026-10-09', 'cuti'),
          hari('2026-10-10', 'sakit'),
          hari('2026-10-20', 'libur', 'Libur Uji'),
        ],
      },
    ],
  };
}

describe('susunMatriksCSV', () => {
  it('menulis identitas laporan di atas tabel', () => {
    const baris = susunMatriksCSV({ laporan: laporanContoh(), admin: 'Rafa' });

    expect(baris[0]).toEqual(['Room', 'Kantor Pusat']);
    expect(baris[1]).toEqual(['Instructor Name', 'Rafa']);
    expect(baris[2]).toEqual(['Subject', 'Pendataan']);
    expect(baris[3]).toEqual(['Month', 'October']);
    expect(baris[4]).toEqual(['Year', '2026']);
    expect(baris[5]).toEqual([]);
  });

  it('membuat satu kolom per tanggal dengan nama hari', () => {
    const baris = susunMatriksCSV({ laporan: laporanContoh() });
    const kepala = baris[6];

    expect(kepala.slice(0, 3)).toEqual(['NIP', 'Student Name', 'Division']);
    expect(kepala[3]).toBe('Thu 1');
    expect(kepala[4]).toBe('Fri 2');
    expect(kepala[33]).toBe('Sat 31');
    expect(kepala.slice(34)).toEqual(['P', 'T', 'E', 'U']);
  });

  it('menerjemahkan status menjadi kode P/T/E/U/L dan mengosongkan hari sebelum masuk', () => {
    const baris = susunMatriksCSV({ laporan: laporanContoh() });
    const siswa = baris[7];
    const sel = siswa.slice(3, 34);

    expect(sel[0]).toBe(''); // 1 Okt, sebelum masuk kerja
    expect(sel[1]).toBe('P'); // 2 Okt
    expect(sel[2]).toBe('L'); // Sabtu
    expect(sel[3]).toBe('L'); // Minggu
    expect(sel[4]).toBe('T'); // 5 Okt
    expect(sel[5]).toBe('E'); // izin
    expect(sel[6]).toBe('U'); // alpha
    expect(sel[7]).toBe(''); // belum
    expect(sel[8]).toBe('E'); // cuti
    expect(sel[9]).toBe('E'); // sakit
    expect(sel[19]).toBe('L'); // libur nasional
  });

  it('menjumlahkan kode per magang di kolom akhir', () => {
    const baris = susunMatriksCSV({ laporan: laporanContoh() });
    const siswa = baris[7];

    expect(siswa.slice(34)).toEqual([1, 1, 3, 1]);
  });

  it('menuliskan legenda di bawah tabel', () => {
    const baris = susunMatriksCSV({ laporan: laporanContoh() });

    expect(baris.at(-2)).toEqual([]);
    expect(baris.at(-1)[0]).toBe('Legend');
    expect(baris.at(-1)[1]).toContain('P = Present');
    expect(baris.at(-1)[1]).toContain('L = Holiday');
  });

  it('memakai label gabungan kalau lokasi atau divisi lebih dari satu', () => {
    const laporan = laporanContoh();
    laporan.data.push({
      ...laporan.data[0],
      nip: 'MGG002',
      nama: 'Budi',
      divisi: 'Perhitungan',
      lokasi: 'Gudang Cikarang',
    });

    const baris = susunMatriksCSV({ laporan });

    expect(baris[0]).toEqual(['Room', 'All rooms']);
    expect(baris[2]).toEqual(['Subject', 'All divisions']);
  });

  it('mengosongkan seluruh sel kalau rincian harian tidak dikirim', () => {
    const laporan = laporanContoh();
    delete laporan.data[0].harian;

    const baris = susunMatriksCSV({ laporan });
    const siswa = baris[7];

    expect(siswa.slice(3, 34).every((s) => s === '')).toBe(true);
    expect(siswa.slice(34)).toEqual([0, 0, 0, 0]);
  });
});
