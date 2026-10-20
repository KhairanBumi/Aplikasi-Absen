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
 * Minta posisi sekali.
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        selesai({
          // Enam angka di belakang koma sekitar 10 cm. Lebih dari itu cuma
          // memberi kesan presisi yang tidak dimiliki sumbernya.
          lintang: Number(latitude.toFixed(6)),
          bujur: Number(longitude.toFixed(6)),
          akurasi: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
        });
      },
      (galat) => gagal(new Error(pesan(galat))),
      OPSI,
    );
  });
}
