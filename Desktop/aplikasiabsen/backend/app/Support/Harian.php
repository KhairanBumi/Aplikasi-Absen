<?php

namespace App\Support;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Pengguna;
use Illuminate\Support\Carbon;

class Harian
{
    /**
     * Susun satu baris per hari untuk satu pengguna dalam satu bulan.
     *
     * Dipakai rincian laporan admin (dan nanti riwayat magang). Satu fungsi
     * untuk keduanya supaya admin dan magang tidak melihat hari yang berbeda.
     *
     * @return array{bulan: string, hari_kerja: int, ringkasan: array<string, int>, data: array<int, array<string, mixed>>}
     */
    public static function susun(Pengguna $pengguna, Carbon $awal): array
    {
        $awal = $awal->copy()->startOfDay();
        $akhir = $awal->copy()->endOfMonth()->startOfDay();
        $hariIni = now()->startOfDay();

        $absen = Absen::with('lokasi')
            ->where('pengguna_id', $pengguna->id)
            ->whereBetween('tanggal', [$awal->toDateString(), $akhir->toDateString()])
            ->orderBy('waktu')
            ->get()
            ->groupBy(fn (Absen $a) => $a->tanggal->format('Y-m-d'));

        $libur = HariLibur::whereBetween('tanggal', [$awal->toDateString(), $akhir->toDateString()])
            ->get()
            ->keyBy(fn (HariLibur $h) => $h->tanggal->format('Y-m-d'));

        $mulai = $pengguna->masuk_kerja && $pengguna->masuk_kerja->greaterThan($awal)
            ? $pengguna->masuk_kerja->copy()->startOfDay()
            : $awal;

        $data = [];
        $tepat = 0;
        $telat = 0;
        $telatMenit = 0;
        $izin = 0;
        $alpha = 0;

        for ($hari = $awal->copy(); $hari->lte($akhir); $hari->addDay()) {
            $kunci = $hari->format('Y-m-d');
            $baris = $absen->get($kunci, collect());
            $masuk = $baris->firstWhere('tipe', 'masuk');
            $pulang = $baris->firstWhere('tipe', 'pulang');
            $utama = $masuk ?? $pulang;
            $hariLibur = $libur->get($kunci);

            // shortcut: tabel izin belum ada, jadi izin/cuti/sakit tidak bisa jadi status; buat saat modul izin Fase 2 dikerjakan.
            if ($hariLibur || $hari->isWeekend()) {
                $status = 'libur';
                $keteranganLibur = $hariLibur?->keterangan
                    ?? ($hari->isSaturday() ? 'Hari Sabtu' : 'Hari Minggu');
            } elseif ($masuk) {
                $status = (int) $masuk->telat_menit > 0 ? 'telat' : 'tepat';
                $keteranganLibur = null;
            } elseif ($hari->lt($mulai)) {
                $status = 'libur';
                $keteranganLibur = 'Belum masuk kerja';
            } elseif ($hari->lt($hariIni)) {
                $status = 'alpha';
                $keteranganLibur = null;
            } else {
                $status = 'belum';
                $keteranganLibur = null;
            }

            $mode = $utama?->mode ?: 'kantor';
            $lokasi = $utama?->lokasi?->nama;

            $data[] = [
                'tanggal' => $kunci,
                'keterangan_libur' => $keteranganLibur,
                'masuk' => $masuk?->waktu?->toIso8601String(),
                'pulang' => $pulang?->waktu?->toIso8601String(),
                'telat_menit' => (int) ($masuk?->telat_menit ?? 0),
                'status' => $status,
                'keterangan_izin' => null,
                'alasan_izin' => null,
                'lokasi' => $utama ? ($mode === 'luar' ? 'Dinas luar' : $lokasi) : null,
                'lokasi_kantor' => $utama ? $lokasi : null,
                'foto' => $utama?->fotoUrl(),
                'mode' => $mode,
                'lintang' => $utama?->lintang,
                'bujur' => $utama?->bujur,
                'akurasi' => $utama?->akurasi,
                'jarak_m' => $utama?->jarak_m,
                'lokasi_meragukan' => $utama?->lokasi_meragukan,
                'lokasi_teks' => $utama?->lokasi_teks,
            ];

            if ($status === 'tepat') {
                $tepat++;
            } elseif ($status === 'telat') {
                $telat++;
            } elseif (in_array($status, ['izin', 'cuti', 'sakit'], true)) {
                $izin++;
            } elseif ($status === 'alpha') {
                $alpha++;
            }

            $telatMenit += (int) ($masuk?->telat_menit ?? 0);
        }

        $akhirKerja = $akhir->lt($hariIni) ? $akhir : $hariIni;

        return [
            'bulan' => $awal->format('Y-m'),
            'hari_kerja' => self::hitungHariKerja($mulai, $akhirKerja),
            'ringkasan' => [
                'hadir' => $tepat + $telat,
                'tepat' => $tepat,
                'telat' => $telat,
                'telat_menit' => $telatMenit,
                'izin' => $izin,
                'alpha' => $alpha,
            ],
            'data' => $data,
        ];
    }

    /** Jumlah hari kerja antara dua tanggal, tanpa Sabtu, Minggu, dan hari libur. */
    public static function hitungHariKerja(Carbon $dari, Carbon $sampai): int
    {
        if ($sampai->lt($dari)) {
            return 0;
        }

        $libur = HariLibur::whereBetween('tanggal', [$dari->toDateString(), $sampai->toDateString()])
            ->get()
            ->map(fn (HariLibur $h) => $h->tanggal->format('Y-m-d'))
            ->flip();

        $jumlah = 0;

        for ($hari = $dari->copy(); $hari->lte($sampai); $hari->addDay()) {
            if (! $hari->isWeekend() && ! $libur->has($hari->format('Y-m-d'))) {
                $jumlah++;
            }
        }

        return $jumlah;
    }
}
