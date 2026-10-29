<?php

namespace App\Support;

use App\Models\Absen;
use App\Models\Pengguna;
use App\Models\PercobaanMasuk;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class Anomali
{
    public static function kumpulkan(Carbon $dari, Carbon $sampai): array
    {
        return collect()
            ->merge(self::pinSalah($dari, $sampai))
            ->merge(self::lokasiKasar($dari, $sampai))
            ->merge(self::jarakJauh($dari, $sampai))
            ->merge(self::perpindahanMustahil($dari, $sampai))
            ->merge(self::ipLuarKantor($dari, $sampai))
            ->merge(self::fotoHilang($dari, $sampai))
            ->sortByDesc('waktu')
            ->values()
            ->all();
    }

    private static function pinSalah(Carbon $dari, Carbon $sampai): Collection
    {
        return PercobaanMasuk::query()
            ->where('berhasil', false)
            ->whereBetween('created_at', [$dari, $sampai])
            ->orderBy('created_at')
            ->get()
            ->groupBy('nip')
            ->map(function (Collection $daftar, string $nip) {
                $jendela = self::jendelaSepuluhMenit($daftar);

                if ($jendela === null) {
                    return null;
                }

                $terakhir = $jendela->last();
                $nama = Pengguna::where('nip', $nip)->value('nama');

                return [
                    'jenis' => 'pin_salah_berulang',
                    'tingkat' => 'tinggi',
                    'judul' => 'PIN salah berulang',
                    'keterangan' => $jendela->count().' percobaan gagal untuk NIP '.$nip.' dalam 10 menit.',
                    'absen_id' => null,
                    'pengguna_id' => $terakhir->pengguna_id,
                    'nama' => $nama,
                    'nip' => $nip,
                    'waktu' => $terakhir->created_at->toIso8601String(),
                ];
            })
            ->filter()
            ->values();
    }

    private static function jendelaSepuluhMenit(Collection $daftar): ?Collection
    {
        for ($i = 0; $i + 5 <= $daftar->count(); $i++) {
            $jendela = $daftar->slice($i, 5);

            if ($jendela->first()->created_at->diffInMinutes($jendela->last()->created_at) <= 10) {
                return $jendela;
            }
        }

        return null;
    }

    private static function lokasiKasar(Carbon $dari, Carbon $sampai): Collection
    {
        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->where('mode', 'luar')
            ->where(function ($q) {
                $q->where('lokasi_meragukan', true)->orWhere('akurasi', '>', 50);
            })
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'lokasi_meragukan',
                'sedang',
                $a->lintang === null ? 'Lokasi tidak tersedia' : 'Lokasi kasar',
                match (true) {
                    $a->lintang === null => 'Absen luar dikirim tanpa koordinat perangkat.',
                    $a->akurasi === null => 'Absen luar tanpa akurasi GPS.',
                    default => 'Absen luar dengan akurasi '.$a->akurasi.' m.',
                }
            ));
    }

    private static function jarakJauh(Carbon $dari, Carbon $sampai): Collection
    {
        $batas = (int) config('absensi.anomali_jarak_m', 100000);

        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->where('mode', 'luar')
            ->where('jarak_m', '>', $batas)
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'jarak_jauh',
                'rendah',
                'Jarak jauh dari kantor',
                'Absen luar '.round($a->jarak_m / 1000).' km dari kantor. Dinas luar boleh jauh; periksa hanya jika tidak sesuai.',
            ));
    }

    private static function perpindahanMustahil(Carbon $dari, Carbon $sampai): Collection
    {
        $baris = Absen::whereBetween('tanggal', [
            $dari->copy()->subDay(),
            $sampai,
        ])
            ->whereNotNull('lintang')
            ->whereNotNull('bujur')
            ->orderBy('pengguna_id')
            ->orderBy('waktu')
            ->get();

        $hasil = collect();

        foreach ($baris->groupBy('pengguna_id') as $daftar) {
            $sebelum = null;

            foreach ($daftar as $sekarang) {
                if ($sebelum && $sekarang->waktu->between($dari, $sampai)) {
                    $detik = (int) $sebelum->waktu->diffInSeconds($sekarang->waktu);
                    $meter = Geo::jarakMeter(
                        (float) $sebelum->lintang,
                        (float) $sebelum->bujur,
                        (float) $sekarang->lintang,
                        (float) $sekarang->bujur
                    );

                    $kmJam = $detik > 0 ? ($meter / 1000) / ($detik / 3600) : 0;

                    if ($detik > 0 && $meter >= 5000 && $kmJam > 900) {
                        $hasil->push(self::dariAbsen(
                            $sekarang,
                            'perpindahan_mustahil',
                            'tinggi',
                            'Perpindahan mustahil',
                            'Berpindah '.round($meter / 1000).' km dalam '.round($detik / 60).' menit.'
                        ));
                    }
                }

                $sebelum = $sekarang;
            }
        }

        return $hasil;
    }

    private static function ipLuarKantor(Carbon $dari, Carbon $sampai): Collection
    {
        $daftar = config('absensi.ip_kantor', []);

        if ($daftar === []) {
            return collect();
        }

        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->whereNotNull('ip')
            ->whereNotIn('ip', $daftar)
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'ip_di_luar_kantor',
                'rendah',
                'IP di luar kantor',
                'Absen datang dari IP '.$a->ip.'.'
            ));
    }

    private static function fotoHilang(Carbon $dari, Carbon $sampai): Collection
    {
        return Absen::whereBetween('waktu', [$dari, $sampai])
            ->whereNull('foto_path')
            ->orderByDesc('waktu')
            ->get()
            ->map(fn (Absen $a) => self::dariAbsen(
                $a,
                'foto_hilang',
                'sedang',
                'Foto tidak tersedia',
                'Baris absen tidak punya foto.'
            ));
    }

    private static function dariAbsen(
        Absen $absen,
        string $jenis,
        string $tingkat,
        string $judul,
        string $keterangan
    ): array {
        return [
            'jenis' => $jenis,
            'tingkat' => $tingkat,
            'judul' => $judul,
            'keterangan' => $keterangan,
            'absen_id' => $absen->id,
            'pengguna_id' => $absen->pengguna_id,
            'nama' => $absen->nama_salinan,
            'nip' => $absen->nip_salinan,
            'waktu' => $absen->waktu->toIso8601String(),
        ];
    }
}
