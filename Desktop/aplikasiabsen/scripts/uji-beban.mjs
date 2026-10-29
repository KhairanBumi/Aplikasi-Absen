// Mengukur waktu balasan laporan admin pada data 50 magang. Token tidak pernah
// dicetak. Jalankan di staging, bukan produksi.
const PANGKAL = process.env.ABSEN_BASE_URL ?? 'http://127.0.0.1:8000';
const NIP = process.env.ABSEN_NIP;
const PIN = process.env.ABSEN_PIN;
const BULAN = process.env.ABSEN_BULAN;

if (!NIP || !PIN || !BULAN) {
  console.error('Isi ABSEN_NIP, ABSEN_PIN, dan ABSEN_BULAN (YYYY-MM).');
  process.exit(2);
}

async function minta(jalur, opsi = {}) {
  const pengawas = new AbortController();
  const timer = setTimeout(() => pengawas.abort(), 30_000);

  try {
    const res = await fetch(PANGKAL + jalur, { ...opsi, signal: pengawas.signal });
    const isi = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`Permintaan ${jalur} gagal (${res.status}): ${isi?.message ?? ''}`);
    }

    return isi;
  } finally {
    clearTimeout(timer);
  }
}

const masuk = await minta('/api/masuk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ nip: NIP, pin: PIN }),
});

const token = masuk.token;
if (!token) {
  console.error('Login tidak mengembalikan token.');
  process.exit(2);
}

const kepala = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
const waktuRekap = [];

for (let i = 0; i < 20; i++) {
  const mulai = performance.now();
  await minta(`/api/admin/laporan?bulan=${encodeURIComponent(BULAN)}`, { headers: kepala });
  waktuRekap.push(performance.now() - mulai);
}

const rekap = await minta(`/api/admin/laporan?bulan=${encodeURIComponent(BULAN)}`, { headers: kepala });
const contoh = rekap.data?.[0];

if (!contoh?.pengguna_id) {
  console.error('Laporan kosong; jalankan UjiBebanSeeder lebih dulu.');
  process.exit(2);
}

const waktuHarian = [];

for (let i = 0; i < 10; i++) {
  const mulai = performance.now();
  await minta(
    `/api/admin/laporan/harian?bulan=${encodeURIComponent(BULAN)}&pengguna_id=${contoh.pengguna_id}`,
    { headers: kepala },
  );
  waktuHarian.push(performance.now() - mulai);
}

function ringkas(nama, daftar) {
  const urut = [...daftar].sort((a, b) => a - b);
  const p95 = urut[Math.floor(urut.length * 0.95) - 1] ?? urut.at(-1);
  return {
    nama,
    jumlah: urut.length,
    p50_ms: Math.round(urut[Math.floor(urut.length * 0.5)]),
    p95_ms: Math.round(p95),
    maks_ms: Math.round(urut.at(-1)),
  };
}

const hasil = [ringkas('laporan', waktuRekap), ringkas('laporan_harian', waktuHarian)];
console.log(JSON.stringify(hasil, null, 2));

if (hasil.some((h) => h.p95_ms > 2000)) {
  console.error('GAGAL: p95 melebihi 2000 ms.');
  process.exit(1);
}
