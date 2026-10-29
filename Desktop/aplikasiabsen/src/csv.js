// Penyusunan CSV dipisah dari layar supaya aturan escaping bisa diuji tanpa
// browser. Pemisah titik koma adalah yang diharapkan Excel berbahasa Indonesia;
// BOM ditambahkan saat berkas diunduh, bukan di dalam string ini.
export function selCSV(nilai) {
  let teks = String(nilai ?? '');

  if (/^[=+\-@\t\r]/.test(teks)) teks = `'${teks}`;

  return `"${teks.replace(/"/g, '""')}"`;
}

export function susunCSV(kepala, baris) {
  return [kepala, ...baris].map((b) => b.map(selCSV).join(';')).join('\r\n');
}

export function unduhCSV(namaBerkas, kepala, baris) {
  const isi = susunCSV(kepala, baris);
  const tautan = document.createElement('a');
  tautan.href = URL.createObjectURL(new Blob([`\ufeff${isi}`], { type: 'text/csv;charset=utf-8' }));
  tautan.download = namaBerkas;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();

  setTimeout(() => URL.revokeObjectURL(tautan.href), 2000);
}
