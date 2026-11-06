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

const OPSI = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 };

// Cadangan untuk perangkat yang tidak bisa memberi titik presisi. Bacaan dari
// cache jaringan boleh lebih tua: tujuannya supaya absen luar tetap punya
// koordinat, bukan supaya angkanya terlihat bagus.
const OPSI_KASAR = { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 };

// Ambang peringatan, bukan penolakan. Di atas angka ini titiknya terlalu kasar
// untuk dipercaya, tetapi absen luar tetap boleh dikirim dan server menandainya
// di rekap. Koordinat yang tidak tersedia sama sekali juga bukan alasan
// menggagalkan absen.
export const AKURASI_MAKS = 150;

// Satu bacaan pertama sering masih kasar, apalagi di PC yang menebak lewat
// Wi-Fi/IP. Pantau sebentar dan pakai bacaan pertama yang sudah masuk batas.
// Dua belas detik cukup untuk perbaikan akurasi tanpa membuat antrean kiosk
// menunggu terlalu lama; setelah itu pengguna boleh lanjut tanpa koordinat.
const TUNGGU_MAKS = 12000;

// Setelah lima detik tanpa titik sama sekali, coba sekali bacaan kasar dari
// cache. Ini menyelamatkan perangkat yang GPS presisinya mati tetapi masih
// punya perkiraan lokasi dari Wi-Fi/IP.
const MULAI_KASAR = 5000;

/**
 * Jarak dua titik di permukaan bumi, dalam meter.
 *
 * Ini HANYA untuk tampilan status radius di kiosk. Angka yang disimpan di
 * baris absen tetap dihitung server dari koordinat yang dikirim; browser tidak
 * boleh menjadi hakim jarak karena koordinatnya bisa diubah sebelum dikirim.
 */
export function jarakMeter(lintang1, bujur1, lintang2, bujur2) {
  const bumi = 6371000;
  const rad = (derajat) => (derajat * Math.PI) / 180;

  const dLat = rad(lintang2 - lintang1);
  const dLon = rad(bujur2 - bujur1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lintang1)) * Math.cos(rad(lintang2)) * Math.sin(dLon / 2) ** 2;

  return 2 * bumi * Math.asin(Math.sqrt(Math.min(1, a)));
}

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
  if (galat?.code === 2) {
    return 'Perangkat tidak menemukan lokasi. Pastikan layanan lokasi menyala, atau lanjutkan tanpa koordinat.';
  }
  if (galat?.code === 3) {
    return 'Pencarian lokasi terlalu lama. Tekan Coba lagi, atau lanjutkan tanpa koordinat.';
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
    let timerKasar = null;

    const akhiri = (adaGalat, nilai) => {
      if (beres) return;
      beres = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      if (timerKasar !== null) clearTimeout(timerKasar);
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

      // Titik yang sudah cukup baik mengakhiri pencarian. Titik kasar tetap
      // disimpan dan dipakai kalau tidak ada yang lebih baik sampai batas waktu.
      if (Number.isFinite(hasil.akurasi) && hasil.akurasi <= AKURASI_MAKS) {
        akhiri(false, hasil);
      }
    };

    // Satu pemantauan sejak awal, bukan satu bacaan lalu menyerah. Di sebagian
    // perangkat bacaan pertama gagal sementara ("posisi tidak tersedia") tetapi
    // bacaan berikutnya berhasil; memutus pemantauan saat error justru membuat
    // kiosk melaporkan gagal padahal lokasinya bisa didapat beberapa detik
    // kemudian.
    try {
      watchId = navigator.geolocation.watchPosition(
        baca,
        (galat) => {
          // Hanya izin ditolak yang tidak akan berubah dengan menunggu.
          if (galat?.code === 1) akhiri(true, new Error(pesan(galat)));
          // Kode 2/3 (posisi tidak tersedia / timeout) dibiarkan: pemantauan
          // masih boleh menghasilkan bacaan berikutnya.
        },
        OPSI,
      );
    } catch (galat) {
      gagal(new Error(pesan(galat)));
      return;
    }

    timerKasar = setTimeout(() => {
      if (beres || terbaik) return;

      try {
        navigator.geolocation.getCurrentPosition(
          baca,
          (galat) => {
            // Kesalahan di sini tidak menghentikan pemantauan utama. Kalau
            // izinnya ternyata ditolak, pemantauan juga akan menerima kode 1.
            if (galat?.code === 1) akhiri(true, new Error(pesan(galat)));
          },
          OPSI_KASAR,
        );
      } catch {
        // Peramban yang tidak mendukung opsi ini cukup mengandalkan pemantauan.
      }
    }, MULAI_KASAR);

    timer = setTimeout(() => {
      if (terbaik) akhiri(false, terbaik);
      else {
        akhiri(
          true,
          new Error(
            'Pencarian lokasi terlalu lama. Tekan Coba lagi, atau lanjutkan tanpa koordinat.',
          ),
        );
      }
    }, TUNGGU_MAKS);
  });
}
