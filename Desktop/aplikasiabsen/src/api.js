// Satu-satunya pintu ke backend. Semua layar bicara lewat sini, tidak ada fetch
// di tempat lain. Saat backend asli siap: set VITE_USE_MOCK=false di .env.
import * as tiruan from './mock.js';

export const MODE_TIRUAN = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';
const PANGKAL = import.meta.env.VITE_API_BASE ?? '/api';
const KUNCI = 'absen-sesi';

let sesi = bacaSesi();

function bacaSesi() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI)) ?? null;
  } catch {
    return null;
  }
}

export function pengguna() {
  return sesi?.pengguna ?? null;
}

export function simpanSesi(data) {
  sesi = data;
  localStorage.setItem(KUNCI, JSON.stringify(data));
}

export function hapusSesi() {
  sesi = null;
  localStorage.removeItem(KUNCI);
}

async function minta(metode, jalur, data) {
  // Token ikut diteruskan ke lapisan tiruan supaya endpoint yang butuh sesi
  // (/admin/dashboard, /saya/absen) benar-benar menguji jalur 401-nya di
  // mode tiruan, bukan cuma bekerja karena kebetulan tidak diperiksa.
  if (MODE_TIRUAN) return tiruan.tanggapi(metode, jalur, data, sesi?.token);

  let res;
  try {
    res = await fetch(PANGKAL + jalur, {
      method: metode,
      headers: {
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(sesi?.token ? { Authorization: `Bearer ${sesi.token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    // fetch hanya melempar di tingkat jaringan: server mati, kabel putus, atau
    // diblokir CORS. Pesan aslinya "Failed to fetch" — tidak berarti apa pun
    // bagi magang yang sedang berdiri di depan kiosk jam tujuh pagi.
    throw new Error('Tidak bisa menghubungi server. Periksa jaringan kantor, lalu coba lagi.');
  }

  // Backend bisa mengirim halaman HTML saat error, jadi parse-nya jangan diasumsikan JSON.
  const isi = await res.json().catch(() => null);

  if (!res.ok) {
    const pesan = isi?.message ?? isi?.pesan ?? `Permintaan gagal (${res.status})`;
    const galat = new Error(pesan);
    galat.status = res.status;
    galat.errors = isi?.errors;
    throw galat;
  }

  return isi;
}

export const api = {
  get: (jalur) => minta('GET', jalur),
  post: (jalur, data) => minta('POST', jalur, data),
  put: (jalur, data) => minta('PUT', jalur, data),
  del: (jalur) => minta('DELETE', jalur),
};

/**
 * Cocokkan sesi tersimpan dengan keadaan di server.
 *
 * Dipanggil sekali saat aplikasi dibuka. Tanpa ini, nama, divisi, dan peran
 * yang tampil diambil dari salinan di localStorage — salinan yang bisa basi
 * berhari-hari. Akibat paling ringan adalah nama yang salah tampil; akibat
 * paling serius adalah orang yang sudah dinonaktifkan tetap bisa membuka
 * aplikasi.
 *
 * Dua jenis kegagalan sengaja diperlakukan berbeda:
 * - 401 atau 403: tokennya memang tidak berlaku lagi, sesi dihapus.
 * - Kegagalan jaringan: sesi DIPERTAHANKAN. Jaringan kantor yang sedang
 *   bermasalah bukan alasan mengeluarkan orang dari aplikasinya.
 */
export async function segarkanSesi() {
  if (!sesi?.token) return null;

  try {
    const profil = await minta('GET', '/saya/profil');
    simpanSesi({ ...sesi, pengguna: profil });
    return profil;
  } catch (galat) {
    if (galat.status === 401 || galat.status === 403) {
      hapusSesi();
      return null;
    }
    return sesi.pengguna;
  }
}
