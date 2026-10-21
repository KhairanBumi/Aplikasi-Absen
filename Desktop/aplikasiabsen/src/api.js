// Satu-satunya pintu ke backend. Semua layar bicara lewat sini, tidak ada fetch
// di tempat lain. Saat backend asli siap: set VITE_USE_MOCK=false di .env.
//
// Mode tiruan HANYA boleh hidup di development. Build produksi selalu memakai
// backend asli, walaupun VITE_USE_MOCK lupa diisi atau masih bernilai true.
// Tanpa aturan ini, `dist` bisa membawa akun demo dan seluruh data localStorage.
export const MODE_TIRUAN = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false';
const PANGKAL = import.meta.env.VITE_API_BASE ?? '/api';
const KUNCI = 'absen-sesi';
const KUNCI_PERANGKAT = 'absen-kiosk-perangkat';

let sesi = bacaSesi();
let modulTiruan = null;

async function tiruan() {
  if (!modulTiruan) modulTiruan = await import('./mock.js');
  return modulTiruan;
}

/**
 * Identitas perangkat kiosk.
 *
 * Dipakai sebagai dasar device enrollment: server boleh menolak kiosk yang
 * belum terdaftar atau yang lokasinya tidak cocok. Nilainya sengaja tidak
 * rahasia — token pendaftaran yang sebenarnya tetap harus divalidasi server.
 */
export function idPerangkat() {
  try {
    let id = localStorage.getItem(KUNCI_PERANGKAT);
    if (!id) {
      if (crypto.randomUUID) id = crypto.randomUUID();
      else {
        const b = new Uint8Array(16);
        crypto.getRandomValues(b);
        id = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      }
      localStorage.setItem(KUNCI_PERANGKAT, id);
    }
    return id;
  } catch {
    return 'kiosk-tanpa-penyimpanan';
  }
}

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
  if (MODE_TIRUAN) {
    const { tanggapi } = await tiruan();
    return tanggapi(metode, jalur, data, sesi?.token);
  }

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
    galat.kode = isi?.kode;
    galat.errors = isi?.errors;

    // `401` hanya berarti sesi tidak valid. Kredensial salah di `/masuk` dan
    // `/kiosk/absen` dikecualikan: PIN salah di kiosk tidak boleh melempar
    // petugas kembali ke halaman login di tengah antrean.
    //
    // `403` tidak menghapus sesi. Role yang tidak berhak atau akun nonaktif
    // bukan bukti tokennya sudah kedaluwarsa; pesannya ditampilkan di layar.
    const jalurBersih = jalur.split('?')[0];
    const kredensial = ['/masuk', '/kiosk/absen'].includes(jalurBersih);
    const sesiHabis = res.status === 401 || (res.status === 403 && isi?.kode === 'sesi_habis');
    if (sesiHabis && !kredensial && sesi?.token) {
      hapusSesi();
      if (location.hash !== '#/masuk') location.replace('#/masuk');
    }

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
    // Token yang tidak berlaku atau akun yang dinonaktifkan memang harus
    // mengakhiri sesi. `403` karena role tidak berhak tidak masuk ke sini:
    // endpoint ini tidak memeriksa role, jadi `403` di sini berarti akunnya
    // sudah tidak boleh dipakai.
    if (galat.status === 401 || galat.kode === 'sesi_habis' || galat.kode === 'akun_nonaktif') {
      hapusSesi();
      return null;
    }
    return sesi.pengguna;
  }
}
