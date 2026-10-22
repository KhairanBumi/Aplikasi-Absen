<?php

namespace App\Http\Controllers;

use App\Models\Pengguna;
use App\Support\Harian;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminLaporanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $awal = $this->awalBulan($request);

        if ($awal instanceof JsonResponse) {
            return $awal;
        }

        $akhir = $awal->copy()->endOfMonth()->startOfDay();
        $rentang = [$awal->toDateString(), $akhir->toDateString()];

        $pengguna = Pengguna::with('shift')
            ->where(function ($q) use ($rentang) {
                $q->where(function ($q) {
                    $q->where('peran', 'magang')->where('aktif', true);
                })->orWhereExists(function ($q) use ($rentang) {
                    $q->selectRaw('1')
                        ->from('absen')
                        ->whereColumn('absen.pengguna_id', 'pengguna.id')
                        ->whereBetween('absen.tanggal', $rentang);
                });
            })
            ->orderBy('nama')
            ->get();

        $data = $pengguna->map(function (Pengguna $orang) use ($awal) {
            $harian = Harian::susun($orang, $awal);
            $hari = collect($harian['data']);
            $luar = $hari->where('mode', 'luar');

            return [
                'pengguna_id' => $orang->id,
                'nip' => $orang->nip,
                'nama' => $orang->nama,
                'divisi' => $orang->divisi,
                'nik' => $orang->nik,
                'shift' => $orang->shift?->nama,
                'aktif' => (bool) $orang->aktif,
                'hari_kerja' => $harian['hari_kerja'],
                'hadir' => $harian['ringkasan']['hadir'],
                'telat' => $harian['ringkasan']['telat'],
                'telat_menit' => $harian['ringkasan']['telat_menit'],
                'izin' => $hari->where('status', 'izin')->count(),
                'cuti' => $hari->where('status', 'cuti')->count(),
                'sakit' => $hari->where('status', 'sakit')->count(),
                'alpha' => $harian['ringkasan']['alpha'],
                'luar' => $luar->count(),
                'luar_kasar' => $luar->filter(
                    fn (array $h) => $h['lokasi_meragukan'] === true
                        || (is_numeric($h['akurasi']) && $h['akurasi'] > 50)
                )->count(),
            ];
        })->values();

        $hariIni = now()->startOfDay();
        $akhirKerja = $akhir->lt($hariIni) ? $akhir : $hariIni;

        return response()->json([
            'bulan' => $awal->format('Y-m'),
            'hari_kerja' => Harian::hitungHariKerja($awal, $akhirKerja),
            'ringkasan' => [
                'magang' => $data->count(),
                'hadir' => $data->sum('hadir'),
                'telat' => $data->sum('telat'),
                'telat_menit' => $data->sum('telat_menit'),
                'izin' => $data->sum('izin') + $data->sum('cuti') + $data->sum('sakit'),
                'alpha' => $data->sum('alpha'),
            ],
            'data' => $data,
        ]);
    }

    public function harian(Request $request): JsonResponse
    {
        $awal = $this->awalBulan($request);

        if ($awal instanceof JsonResponse) {
            return $awal;
        }

        $id = $request->query('pengguna_id');

        if ($id === null || $id === '' || ! ctype_digit((string) $id)) {
            return $this->galat(
                'pengguna_id wajib diisi dengan angka.',
                422,
                'pengguna_id_tidak_valid'
            );
        }

        $pengguna = Pengguna::with('shift')->find((int) $id);

        if (! $pengguna) {
            return $this->galat('Pengguna tidak ditemukan.', 404, 'tidak_ditemukan');
        }

        $harian = Harian::susun($pengguna, $awal);

        return response()->json([
            'bulan' => $harian['bulan'],
            'pengguna' => $pengguna->apiArray(),
            'data' => $harian['data'],
        ]);
    }

    private function awalBulan(Request $request): Carbon|JsonResponse
    {
        $bulan = (string) $request->query('bulan', now()->format('Y-m'));

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $bulan)) {
            return $this->galat('Bulan harus berbentuk YYYY-MM.', 422, 'bulan_tidak_valid');
        }

        return Carbon::createFromFormat('!Y-m-d', $bulan.'-01')->startOfDay();
    }
}
