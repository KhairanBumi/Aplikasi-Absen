// Kamera untuk kiosk absen.
//
// Dipisah dari layarnya karena urusannya berbeda: izin, pembersihan track, dan
// pengambilan gambar. Kesalahan paling mahal di sini adalah lupa mematikan
// track — lampu kamera tetap menyala dan magang mengira sedang direkam.

export const LEBAR = 640;
export const TINGGI = 480;

// 0.7 adalah titik di mana wajah masih jelas dikenali tapi berkasnya kecil.
// Pada 640x480 hasilnya sekitar 40-60 KB, jadi sekitar 55-80 KB setelah
// base64. Di 0.85 ukurannya hampir dua kali lipat tanpa beda yang berarti
// untuk keperluan bukti kehadiran.
const MUTU = 0.7;

/** Apakah browser mengizinkan akses kamera sama sekali. */
export function kameraTersedia() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Terjemahkan galat getUserMedia jadi kalimat yang bisa ditindaklanjuti.
 * Nama galat teknisnya ikut disebut di beberapa cabang dengan sengaja: yang
 * membaca layar kiosk mungkin bukan programmer, tapi yang diminta memperbaiki
 * biasanya perlu tahu persis apa yang gagal.
 */
export function pesanKamera(galat) {
  if (!kameraTersedia()) {
    return (
      'Browser memblokir akses kamera karena halaman ini tidak dibuka lewat HTTPS. ' +
      'Hubungi admin — ini masalah alamat server, bukan webcam-nya.'
    );
  }

  switch (galat?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return (
        'Akses kamera ditolak. Klik ikon kamera di address bar, pilih "Izinkan", ' +
        'lalu muat ulang halaman ini.'
      );
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak terdeteksi. Pastikan webcam terpasang, lalu muat ulang halaman ini.';
    case 'NotReadableError':
      return (
        'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu (Zoom, Teams, ' +
        'aplikasi Kamera Windows), lalu coba lagi.'
      );
    default:
      return `Kamera gagal dinyalakan${galat?.name ? ` (${galat.name})` : ''}. Coba muat ulang halaman ini.`;
  }
}

/**
 * Menyalakan kamera dan menempelkan gambarannya ke <video>.
 * Mengembalikan fungsi penghenti — WAJIB dipanggil saat layar kiosk ditinggalkan
 * atau saat kembali ke langkah sebelumnya, kalau tidak kameranya menyala terus.
 */
export async function nyalakan(video) {
  const aliran = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: LEBAR }, height: { ideal: TINGGI } },
    audio: false,
  });

  video.srcObject = aliran;
  // `play()` bisa ditolak kalau tab tidak aktif. Bukan alasan untuk gagal total:
  // kalau gambarnya toh jalan, absen tetap bisa lanjut.
  await video.play().catch(() => {});

  return () => {
    for (const track of aliran.getTracks()) track.stop();
    video.srcObject = null;
  };
}

/**
 * Menunggu sampai <video> benar-benar punya gambar.
 *
 * Ini bukan kehati-hatian berlebihan. Webcam — apalagi yang murah — butuh
 * 1 sampai 2 detik sebelum frame pertamanya muncul. Kalau kita memotret
 * sebelum itu, hasilnya gambar kosong yang tersimpan sebagai bukti kehadiran,
 * dan yang muncul di laporan adalah kotak hitam. Menunggu di sini jauh lebih
 * murah daripada menjelaskan ke HRD kenapa foto absennya hitam.
 *
 * Mengembalikan false kalau batas waktunya lewat — pemanggil yang memutuskan
 * mau berbuat apa, bukan fungsi ini.
 */
export function tungguSiap(video, batas = 6000) {
  if (video.videoWidth > 0 && video.readyState >= 2) return Promise.resolve(true);

  return new Promise((selesai) => {
    let beres = false;

    const akhiri = (ok) => {
      if (beres) return;
      beres = true;
      clearTimeout(timer);
      video.removeEventListener('loadeddata', cek);
      video.removeEventListener('playing', cek);
      selesai(ok);
    };

    const cek = () => {
      if (video.videoWidth > 0 && video.readyState >= 2) akhiri(true);
    };

    const timer = setTimeout(() => akhiri(false), batas);
    video.addEventListener('loadeddata', cek);
    video.addEventListener('playing', cek);
  });
}

/**
 * Potret satu gambar dari <video> sebagai data URL JPEG.
 *
 * Hasilnya dicerminkan supaya sama dengan yang dilihat magang di pratinjau.
 * Tanpa itu, orang melihat dirinya di kiri lalu fotonya tersimpan di kanan dan
 * mengira fotonya salah ambil.
 */
export function potret(video) {
  const kanvas = document.createElement('canvas');
  kanvas.width = LEBAR;
  kanvas.height = TINGGI;

  const ctx = kanvas.getContext('2d');
  ctx.translate(LEBAR, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, LEBAR, TINGGI);

  return kanvas.toDataURL('image/jpeg', MUTU);
}
