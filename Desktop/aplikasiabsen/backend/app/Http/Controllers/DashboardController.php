<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Pengguna;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tanggalInput = $request->query('tanggal');

        if ($tanggalInput !== null && $tanggalInput !== '') {
            try {
                $tanggal = Carbon::createFromFormat('!Y-m-d', (string) $tanggalInput);
            } catch (\Throwable) {
                return $this->galat('Tanggal harus berbentuk YYYY-MM-DD.', 422);
            }

            if ($tanggal->format('Y-m-d') !== $tanggalInput) {
                return $this->galat('Tanggal harus berbentuk YYYY-MM-DD.', 422);
            }
        } else {
            $tanggal = now()->startOfDay();
        }

        $tanggalStr = $tanggal->toDateString();

        $libur = HariLibur::whereDate('tanggal', $tanggalStr)->first();
        $hariKerja = ! $libur && ! $tanggal->isWeekend();

        $keteranganLibur = $libur?->keterangan;

        if (! $keteranganLibur) {
            if ($tanggal->isSaturday()) {
                $keteranganLibur = 'Hari Sabtu';
            } elseif ($tanggal->isSunday()) {
                $keteranganLibur = 'Hari Minggu';
            }
        }

        $absenHari = Absen::with(['pengguna', 'shift', 'lokasi'])
            ->whereDate('tanggal', $tanggalStr)
            ->orderBy('waktu')
            ->get();

        $idAbsen = $absenHari->pluck('pengguna_id')->unique()->values()->all();

        $kandidat = Pengguna::with(['shift', 'lokasi'])
            ->where(function ($q) use ($tanggalStr, $idAbsen) {
                $q->where(function ($q) use ($tanggalStr) {
                    $q->where('peran', 'magang')
                        ->where('aktif', true)
                        ->whereDate('masuk_kerja', '<=', $tanggalStr);
                })->orWhere(function ($q) use ($idAbsen) {
                    $q->where('peran', 'admin')->whereIn('id', $idAbsen);
                });
            })
            ->get();

        $masuk = $absenHari->where('tipe', 'masuk')->keyBy('pengguna_id');

        $sudahMasuk = $kandidat->filter(fn (Pengguna $p) => $masuk->has($p->id))->values();
        $belumMasuk = $hariKerja
            ? $kandidat->reject(fn (Pengguna $p) => $masuk->has($p->id))->values()
            : collect();

        $idSudahMasuk = $sudahMasuk->pluck('id')->all();

        $terlambat = $absenHari
            ->where('tipe', 'masuk')
            ->where('telat_menit', '>', 0)
            ->whereIn('pengguna_id', $idSudahMasuk)
            ->sortByDesc('waktu')
            ->values();

        $aktivitas = $absenHari->sortByDesc('waktu')->take(6)->values();

        return response()->json([
            'tanggal' => $tanggalStr,
            'hari_kerja' => $hariKerja,
            'keterangan_libur' => $keteranganLibur,
            'ringkasan' => [
                'total' => $sudahMasuk->count() + $belumMasuk->count(),
                'sudah_masuk' => $sudahMasuk->count(),
                'belum_masuk' => $belumMasuk->count(),
                'izin' => 0,
                'telat' => $terlambat->count(),
            ],
            'terlambat' => $terlambat->map(fn (Absen $a) => [
                'id' => $a->id,
                'nama' => $a->pengguna?->nama ?? $a->nama_salinan,
                'nip' => $a->pengguna?->nip ?? $a->nip_salinan,
                'divisi' => $a->pengguna?->divisi,
                'shift' => $a->shift?->nama ?? $a->pengguna?->shift?->nama,
                'waktu' => $a->waktu?->toIso8601String(),
                'telat_menit' => $a->telat_menit,
                'foto' => $a->fotoUrl(),
            ])->values(),
            'belum_masuk' => $belumMasuk->map(fn (Pengguna $p) => [
                'id' => $p->id,
                'nama' => $p->nama,
                'nip' => $p->nip,
                'divisi' => $p->divisi,
                'shift' => $p->shift?->nama,
            ])->values(),
            'izin' => [],
            'aktivitas' => $aktivitas->map(fn (Absen $a) => [
                'id' => $a->id,
                'nama' => $a->pengguna?->nama ?? $a->nama_salinan,
                'nip' => $a->pengguna?->nip ?? $a->nip_salinan,
                'tipe' => $a->tipe,
                'waktu' => $a->waktu?->toIso8601String(),
                'foto' => $a->fotoUrl(),
                'lokasi' => $a->mode === 'luar'
                    ? 'Dinas luar'
                    : ($a->lokasi?->nama ?? '—'),
                'lokasi_kantor' => $a->lokasi?->nama,
                'mode' => $a->mode ?: 'kantor',
                'lintang' => $a->lintang,
                'bujur' => $a->bujur,
                'akurasi' => $a->akurasi,
                'jarak_m' => $a->jarak_m,
                'lokasi_meragukan' => $a->lokasi_meragukan,
                'lokasi_teks' => $a->lokasi_teks,
            ])->values(),
        ]);
    }
}
