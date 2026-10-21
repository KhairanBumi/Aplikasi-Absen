// Pembungkus Geolocation API.
//
// Satu tempat untuk semua pesan gagal, sama seperti kamera.js: layar kiosk
// tidak perlu tahu kode `PERMISSION_DENIED` dan kawan-kawan, dan pesan yang
// menyebut sebabnya lebih berguna daripada "gagal".
//
// Soal akurasi, dan ini penting: di HP koordinatnya datang dari GPS dan
// biasanya meleset belasan meter. Di PC tidak ada GPS — browser menebak dari
// IP atau Wi-Fi, dan hasilnya bisa meleset ratusan meter sampai salah kota.
// Karena itu `akurasi` dikirim apa adanya, tidak dibulatkan supaya terlihat
// bagus. Angka itulah yang memberi tahu admin seberapa besar harus percaya.

const OPSI = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

// Batas yang sama dengan server. Di atas ini absen "di luar" ditolak karena
// titiknya terlalu kasar untuk dicatat; jarak dari kantor tidak ikut diperiksa.
export const AKURASI_MAKS = 150;

// Satu bacaan pertama sering masih kasar, apalagi di PC yang menebak lewat
// Wi-Fi/IP. Pantau sebentar dan pakai bacaan pertama yang sudah masuk batas.
const TUNGGU_MAKS = 15000;

function pesan(galat) {
  // Diperiksa lebih dulu. Di halaman http:// (selain localhost) API-nya memang
  // ada, tapi selalu berakhir "izin ditolak" — pesan itu menyesatkan, sebab
  // yang kurang bukan izinnya, melainkan HTTPS-nya.
  if (!window.isSecureContext) {
    return 'Lokasi hanya bisa diambil lewat HTTPS. Buka alamat berawalan https://, atau jalankan aplikasinya dari localhost di PC ini.';
  }
  if (!('geolocation' in navigator)) {
    return 'Perangkat ini tidak punya layanan lokasi. Pilih "Di perusahaan" saja.';
  }
  if (galat?.code === 1) {
    return 'Izin lokasi ditolak. Izinkan lewat ikon di address bar, lalu tekan Coba lagi.';
  }
  if (galat?.code === 3) {
    return 'Pencarian lokasi terlalu lama. Tekan Coba lagi, atau pilih "Di perusahaan".';
  }
  return 'Lokasi tidak bisa ditentukan. Periksa koneksi, lalu tekan Coba lagi.';
}

/**
 * Minta posisi, lalu tunggu sebentar sampai akurasinya masuk batas server.
 *
 * Hasilnya `{ lintang, bujur, akurasi }` — `akurasi` dalam meter, dan itu
 * perkiraan jari-jari, bukan jaminan. Selalu menolak dengan `Error` yang
 * `message`-nya sudah layak ditampilkan apa adanya.
 */
export function ambilLokasi() {
  return new Promise((selesai, gagal) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      gagal(new Error(pesan(null)));
      return;
    }

    let terbaik = null;
    let beres = false;
    let watchId = null;
    let timer = null;

    const akhiri = (adaGalat, nilai) => {
      if (beres) return;
      beres = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      if (adaGalat) gagal(nilai);
      else selesai(nilai);
    };

    const baca = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      const hasil = {
        // Enam angka di belakang koma sekitar 10 cm. Lebih dari itu cuma
        // memberi kesan presisi yang tidak dimiliki sumbernya.
        lintang: Number(latitude.toFixed(6)),
        bujur: Number(longitude.toFixed(6)),
        akurasi: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
      };

      if (
        !terbaik ||
        !Number.isFinite(terbaik.akurasi) ||
        (Number.isFinite(hasil.akurasi) && hasil.akurasi < terbaik.akurasi)
      ) {
        terbaik = hasil;
      }

      if (Number.isFinite(hasil.akurasi) && hasil.akurasi <= AKURASI_MAKS) {
        akhiri(false, hasil);
      }
    };

    timer = setTimeout(() => {
      if (terbaik) akhiri(false, terbaik);
      else {
        akhiri(
          true,
          new Error('Pencarian lokasi terlalu lama. Tekan Coba lagi, atau pilih "Di perusahaan".'),
        );
      }
    }, TUNGGU_MAKS);

    watchId = navigator.geolocation.watchPosition(
      baca,
      (galat) => {
        // Kalau sudah ada titik walau kasar, titik itu masih lebih berguna
        // daripada pesan gagal: server tetap yang memutuskan cukup atau tidak.
        if (terbaik) akhiri(false, terbaik);
        else akhiri(true, new Error(pesan(galat)));
      },
      OPSI,
    );
  });
}
