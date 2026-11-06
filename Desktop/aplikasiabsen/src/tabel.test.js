import { describe, expect, it } from 'vitest';
import { kartuHarian, tabel } from './tabel.js';

describe('tabel', () => {
  it('memberi caption tersembunyi untuk pembaca layar', () => {
    const html = tabel({
      judul: 'Daftar hari libur',
      kolom: [{ judul: 'Tanggal', sel: (b) => b.tanggal }],
      baris: [{ tanggal: '2026-01-01' }],
    });

    expect(html).toContain('<caption class="sr-only">Daftar hari libur</caption>');
    expect(html).toContain('<th scope="col"');
  });
});

describe('kartuHarian', () => {
  it('meringkas hari tanpa catatan masuk menjadi satu baris', () => {
    const html = kartuHarian({
      tanggal: '2026-10-29',
      status: 'libur',
      keterangan_libur: 'Hari libur nasional',
    });

    expect(html).toContain('Hari libur nasional');
    expect(html).not.toContain('<dl');
    expect(html).not.toContain('Masuk');
  });

  it('menampilkan jam dan lokasi saat ada catatan masuk', () => {
    const html = kartuHarian({
      tanggal: '2026-10-29',
      status: 'telat',
      masuk: '2026-10-29T08:12:00+07:00',
      pulang: '2026-10-29T17:01:00+07:00',
      telat_menit: 12,
      lokasi: 'Kantor Pusat',
    });

    expect(html).toContain('<dl');
    expect(html).toContain('12 menit');
    expect(html).toContain('Kantor Pusat');
  });
});
