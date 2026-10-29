<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Izin;
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

        $izinHari = Izin::with('pengguna')
            ->where('status', 'disetujui')
            ->whereIn('jenis', Izin::JENIS)
            ->whereDate('mulai', '<=', $tanggalStr)
            ->whereDate('selesai', '>=', $tanggalStr)
            ->orderBy('id')
            ->get()
            ->keyBy('pengguna_id');

        $idTerlibat = $absenHari->pluck('pengguna_id')
            ->merge($izinHari->keys())
            ->unique()
            ->values()
            ->all();

        $kandidat = Pengguna::with(['shift', 'lokasi'])
            ->where(function ($q) use ($tanggalStr, $idTerlibat) {
                $q->where(function ($q) use ($tanggalStr) {
                    $q->where('peran', 'magang')
                        ->where('aktif', true)
                        ->whereDate('masuk_kerja', '<=', $tanggalStr);
                })->orWhereIn('id', $idTerlibat);
            })
            ->get();

        $masuk = $absenHari->where('tipe', 'masuk')->keyBy('pengguna_id');

        $sudahMasuk = $kandidat->filter(fn (Pengguna $p) => $masuk->has($p->id))->values();

        $izinOrang = $hariKerja
            ? $kandidat->filter(
                fn (Pengguna $p) => $izinHari->has($p->id) && ! $masuk->has($p->id)
            )->values()
            : collect();

        $idIzin = array_flip($izinOrang->pluck('id')->all());

        $belumMasuk = $hariKerja
            ? $kandidat->reject(
                fn (Pengguna $p) => $masuk->has($p->id) || isset($idIzin[$p->id])
            )->values()
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
                'total' => $sudahMasuk->count() + $belumMasuk->count() + $izinOrang->count(),
                'sudah_masuk' => $sudahMasuk->count(),
                'belum_masuk' => $belumMasuk->count(),
                'izin' => $izinOrang->count(),
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
            'izin' => $izinOrang->map(function (Pengguna $p) use ($izinHari) {
                $izin = $izinHari->get($p->id);

                return [
                    'id' => $izin->id,
                    'nama' => $p->nama,
                    'nip' => $p->nip,
                    'divisi' => $p->divisi,
                    'jenis' => $izin->jenis,
                    'mulai' => $izin->mulai->format('Y-m-d'),
                    'selesai' => $izin->selesai->format('Y-m-d'),
                    'alasan' => $izin->alasan,
                ];
            })->values(),
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
