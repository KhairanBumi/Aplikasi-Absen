import { afterEach, describe, expect, it, vi } from 'vitest';

import { AKURASI_MAKS, ambilLokasi, jarakMeter } from './lokasi.js';

// Jarak yang dipakai sebagai pembanding berasal dari kalkulator jarak
// koordinat (haversine, jari-jari bumi 6.371 km). Toleransi 1 meter cukup:
// yang diuji hanya ketepatan rumus, bukan ketelitian GPS.
describe('jarakMeter', () => {
  it('nol untuk titik yang sama', () => {
    expect(jarakMeter(-6.2246, 106.8094, -6.2246, 106.8094)).toBe(0);
  });

  it('menghitung jarak pendek di dalam kota', () => {
    // Monas (-6.175392, 106.827153) ke Bundaran HI (-6.1944, 106.8229).
    const jarak = jarakMeter(-6.175392, 106.827153, -6.1944, 106.8229);
    expect(jarak).toBeGreaterThan(2100);
    expect(jarak).toBeLessThan(2250);
  });

  it('simetris terhadap urutan titik', () => {
    const a = jarakMeter(-6.2246, 106.8094, -6.2843, 107.166);
    const b = jarakMeter(-6.2843, 107.166, -6.2246, 106.8094);
    expect(a).toBeCloseTo(b, 6);
  });

  it('memberi angka masuk akal untuk jarak antar kota', () => {
    // Jakarta ke Bandung sekitar 120 km garis lurus.
    const jarak = jarakMeter(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(jarak).toBeGreaterThan(110000);
    expect(jarak).toBeLessThan(130000);
  });
});

function pos(akurasi) {
  return {
    coords: { latitude: -7.31, longitude: 112.77, accuracy: akurasi },
  };
}

// Geolocation palsu dengan urutan peristiwa. `watch` dipakai untuk membaca
// rangkaian error/sukses seperti browser sungguhan; `sekali` untuk fallback
// getCurrentPosition yang dipanggil setelah beberapa detik.
function geolocationPalsu({ watch = [], sekali = [] } = {}) {
  const log = { watch: [], sekali: [], clearWatch: [] };

  return {
    log,
    geo: {
      watchPosition(ok, gagal, opsi) {
        log.watch.push(opsi);
        for (const peristiwa of watch) {
          setTimeout(() => {
            if (peristiwa.galat) gagal(peristiwa.galat);
            else ok(peristiwa.posisi);
          }, peristiwa.ms);
        }
        return 9;
      },
      getCurrentPosition(ok, gagal, opsi) {
        log.sekali.push(opsi);
        for (const peristiwa of sekali) {
          setTimeout(() => {
            if (peristiwa.galat) gagal(peristiwa.galat);
            else ok(peristiwa.posisi);
          }, peristiwa.ms);
        }
      },
      clearWatch(id) {
        log.clearWatch.push(id);
      },
    },
  };
}

function pasang(peristiwa = {}) {
  const hasil = geolocationPalsu(peristiwa);
  vi.stubGlobal('window', { isSecureContext: true });
  vi.stubGlobal('navigator', { geolocation: hasil.geo });
  return hasil;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ambilLokasi', () => {
  it('tidak menyerah saat pembacaan pertama melaporkan posisi tidak tersedia', async () => {
    vi.useFakeTimers();
    const { log } = pasang({
      watch: [
        { ms: 20, galat: { code: 2 } },
        { ms: 80, posisi: pos(20) },
      ],
      sekali: [{ ms: 0, galat: { code: 2 } }],
    });

    const janji = ambilLokasi();
    const cek = expect(janji).resolves.toEqual({ lintang: -7.31, bujur: 112.77, akurasi: 20 });
    await vi.advanceTimersByTimeAsync(100);

    await cek;
    expect(log.clearWatch).toContain(9);
  });

  it('tetap menunggu setelah watch melaporkan timeout', async () => {
    vi.useFakeTimers();
    pasang({
      watch: [
        { ms: 20, galat: { code: 3 } },
        { ms: 90, posisi: pos(30) },
      ],
      sekali: [{ ms: 0, galat: { code: 3 } }],
    });

    const janji = ambilLokasi();
    const cek = expect(janji).resolves.toEqual({ lintang: -7.31, bujur: 112.77, akurasi: 30 });
    await vi.advanceTimersByTimeAsync(110);

    await cek;
  });

  it('gagal cepat dan menghentikan watch saat izin ditolak', async () => {
    vi.useFakeTimers();
    const { log } = pasang({
      watch: [{ ms: 20, galat: { code: 1 } }],
      sekali: [{ ms: 0, galat: { code: 1 } }],
    });

    const janji = ambilLokasi();
    const cek = expect(janji).rejects.toThrow(/Izin lokasi ditolak/);
    await vi.advanceTimersByTimeAsync(30);

    await cek;
    expect(log.clearWatch).toContain(9);
  });

  it('mencoba bacaan kasar dari cache bila GPS presisi belum memberi titik', async () => {
    vi.useFakeTimers();
    const { log } = pasang({ sekali: [{ ms: 20, posisi: pos(500) }] });

    const janji = ambilLokasi();
    const cek = expect(janji).resolves.toEqual({ lintang: -7.31, bujur: 112.77, akurasi: 500 });
    await vi.advanceTimersByTimeAsync(5200);
    await vi.advanceTimersByTimeAsync(7000);

    await cek;
    expect(log.sekali).toHaveLength(1);
    expect(log.sekali[0].enableHighAccuracy).toBe(false);
    expect(log.sekali[0].maximumAge).toBeGreaterThan(0);
  });

  it('menolak dengan pesan jelas bila tidak ada bacaan sampai batas waktu', async () => {
    vi.useFakeTimers();
    const { log } = pasang();

    const janji = ambilLokasi();
    const cek = expect(janji).rejects.toThrow(/Pencarian lokasi terlalu lama/);
    await vi.advanceTimersByTimeAsync(13000);

    await cek;
    expect(log.clearWatch).toContain(9);
  });
});

describe('AKURASI_MAKS', () => {
  it('sama dengan batas peringatan akurasi kasar', () => {
    expect(AKURASI_MAKS).toBe(150);
  });
});
