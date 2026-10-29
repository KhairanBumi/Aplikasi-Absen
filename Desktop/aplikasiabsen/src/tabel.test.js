import { describe, expect, it } from 'vitest';
import { tabel } from './tabel.js';

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
