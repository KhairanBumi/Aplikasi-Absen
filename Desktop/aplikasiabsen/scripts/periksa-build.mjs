// Gagalkan build kalau artefak produksi masih membawa akun demo, token tiruan,
// atau kunci localStorage mode tiruan. Pemeriksaan ini sengaja membaca hasil
// build, bukan kode sumber: yang dikirim ke pengguna adalah isi `dist`.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const folder = join('dist', 'assets');
const pola = /ADM001|1111|tiruan\.|absen-tiruan/;

let berkas = [];
try {
  berkas = (await readdir(folder)).filter((nama) => nama.endsWith('.js'));
} catch {
  console.error('Folder dist/assets tidak ditemukan. Jalankan vite build lebih dulu.');
  process.exit(1);
}

let temuan = [];
for (const nama of berkas) {
  const isi = await readFile(join(folder, nama), 'utf8');
  if (pola.test(isi)) temuan.push(nama);
}

if (temuan.length > 0) {
  console.error(
    `Build produksi masih memuat kredensial/kode mode tiruan di: ${temuan.join(', ')}.`,
  );
  process.exit(1);
}

console.log('Pemeriksaan build produksi lulus: tidak ada akun demo atau kode mode tiruan.');
