<?php

namespace App\Support;

use App\Models\Absen;
use App\Models\Izin;
use App\Models\Pengguna;
use Illuminate\Support\Carbon;

class KuotaCuti
{
    public static function rekap(Pengguna $pengguna, ?int $kecualiIzinId = null, ?int $tahun = null): array
    {
        $tahun ??= now()->year;
        [$awal, $akhir] = self::rentangTahun($pengguna, $tahun);

        $izin = Izin::where('pengguna_id', $pengguna->id)
            ->where('jenis', 'cuti')
            ->whereIn('status', ['disetujui', 'menunggu'])
            ->whereDate('mulai', '<=', $akhir->toDateString())
            ->whereDate('selesai', '>=', $awal->toDateString())
            ->when($kecualiIzinId !== null, fn ($q) => $q->where('id', '!=', $kecualiIzinId))
            ->get();

        $absen = Absen::where('pengguna_id', $pengguna->id)
            ->where('tipe', 'masuk')
            ->whereDate('tanggal', '>=', $awal->toDateString())
            ->whereDate('tanggal', '<=', $akhir->toDateString())
            ->get(['tanggal'])
            ->map(fn (Absen $a) => $a->tanggal->format('Y-m-d'))
            ->flip();

        $terpakai = [];
        $menunggu = [];

        foreach ($izin as $z) {
            foreach (self::tanggalDalamKuota($pengguna, $z->mulai, $z->selesai, $tahun) as $tanggal) {
                if ($z->status === 'menunggu') {
                    $menunggu[$tanggal] = true;
                } elseif (! $absen->has($tanggal)) {
                    $terpakai[$tanggal] = true;
                }
            }
        }

        $jatah = (int) $pengguna->cuti_kuota;
        $jumlahTerpakai = count($terpakai);
        $jumlahMenunggu = count($menunggu);

        return [
            'jatah' => $jatah,
            'terpakai' => $jumlahTerpakai,
            'menunggu' => $jumlahMenunggu,
            'sisa' => $jatah - $jumlahTerpakai - $jumlahMenunggu,
        ];
    }

    public static function tanggalDalamKuota(Pengguna $pengguna, Carbon $mulai, Carbon $selesai, ?int $tahun = null): array
    {
        $tahun ??= now()->year;
        [$awal, $akhir] = self::rentangTahun($pengguna, $tahun);
        $mulai = $mulai->copy()->startOfDay();
        $selesai = $selesai->copy()->startOfDay();

        $dari = $mulai->greaterThan($awal) ? $mulai : $awal;
        $sampai = $selesai->lessThan($akhir) ? $selesai : $akhir;

        return Harian::tanggalHariKerja($dari, $sampai);
    }

    private static function rentangTahun(Pengguna $pengguna, int $tahun): array
    {
        $awal = Carbon::create($tahun, 1, 1, 0, 0, 0);
        $akhir = $awal->copy()->endOfYear()->startOfDay();

        if ($pengguna->masuk_kerja && $pengguna->masuk_kerja->greaterThan($awal)) {
            $awal = $pengguna->masuk_kerja->copy()->startOfDay();
        }

        return [$awal, $akhir];
    }
}
