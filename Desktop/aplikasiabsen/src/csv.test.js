import { describe, expect, it } from 'vitest';
import { selCSV, susunCSV } from './csv.js';

describe('selCSV', () => {
  it('membungkus sel dengan kutip dan menggandakan kutip di dalamnya', () => {
    expect(selCSV('Siti "Rahayu"')).toBe('"Siti ""Rahayu"""');
  });

  it('mengamankan sel yang akan dieksekusi Excel sebagai rumus', () => {
    expect(selCSV('=1+1')).toBe("\"'=1+1\"");
    expect(selCSV('+62')).toBe("\"'+62\"");
    expect(selCSV('-1')).toBe("\"'-1\"");
    expect(selCSV('@SUM(A1)')).toBe("\"'@SUM(A1)\"");
  });

  it('mengubah null dan undefined menjadi sel kosong', () => {
    expect(selCSV(null)).toBe('""');
    expect(selCSV(undefined)).toBe('""');
  });
});

describe('susunCSV', () => {
  it('memakai titik koma dan CRLF tanpa BOM', () => {
    expect(susunCSV(['Nama', 'Hadir'], [['Siti', 20], ['Budi', null]])).toBe(
      '"Nama";"Hadir"\r\n"Siti";"20"\r\n"Budi";""',
    );
  });
});
