<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use App\Models\Izin;
use App\Models\Pengguna;
use App\Support\Harian;
use App\Support\KuotaCuti;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminIzinController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->query->has('status') ? $request->query('status') : 'menunggu';

        if (! is_string($status) || ! in_array($status, ['menunggu', 'disetujui', 'ditolak', 'semua'], true)) {
            return $this->galat(
                'Status harus menunggu, disetujui, ditolak, atau semua.',
                422,
                'status_tidak_valid'
            );
        }

        $query = Izin::with('pengguna')
            ->orderByDesc('diajukan_at')
            ->orderByDesc('id');

        if ($status !== 'semua') {
            $query->where('status', $status);
        }

        $data = $query->get()
            ->map(fn (Izin $izin) => $izin->apiArray())
            ->values();

        $jumlah = Izin::selectRaw('status, COUNT(*) as jumlah')
            ->groupBy('status')
            ->pluck('jumlah', 'status');

        return response()->json([
            'data' => $data,
            'jumlah' => [
                'menunggu' => (int) ($jumlah['menunggu'] ?? 0),
                'disetujui' => (int) ($jumlah['disetujui'] ?? 0),
                'ditolak' => (int) ($jumlah['ditolak'] ?? 0),
                'semua' => (int) $jumlah->sum(),
            ],
        ]);
    }

    public function setujui(Request $request, int $id): JsonResponse
    {
        return $this->putuskan($request, $id, 'disetujui');
    }

    public function tolak(Request $request, int $id): JsonResponse
    {
        return $this->putuskan($request, $id, 'ditolak');
    }

    private function putuskan(Request $request, int $id, string $keputusan): JsonResponse
    {
        $catatan = null;

        if ($keputusan === 'ditolak') {
            $data = $request->validate([
                'catatan' => ['required', 'string', 'min:4', 'max:500'],
            ], [
                'catatan.required' => 'Catatan wajib diisi saat menolak pengajuan.',
                'catatan.string' => 'Catatan harus berupa teks.',
                'catatan.min' => 'Catatan minimal 4 karakter.',
                'catatan.max' => 'Catatan maksimal 500 karakter.',
            ]);

            $catatan = trim($data['catatan']);
        }

        $aktor = $request->attributes->get('pengguna');

        $hasil = DB::transaction(function () use ($id, $keputusan, $catatan, $request, $aktor) {
            $izinAwal = Izin::find($id);

            if (! $izinAwal) {
                return ['galat' => ['Pengajuan izin tidak ditemukan.', 404, 'tidak_ditemukan']];
            }

            $pengguna = Pengguna::whereKey($izinAwal->pengguna_id)->lockForUpdate()->first();
            $izin = Izin::with('pengguna')->lockForUpdate()->find($id);

            if (! $izin || ! $pengguna) {
                return ['galat' => ['Pengajuan izin tidak ditemukan.', 404, 'tidak_ditemukan']];
            }

            if ($izin->status !== 'menunggu') {
                return ['galat' => ['Pengajuan ini sudah diputuskan.', 409, 'sudah_diputuskan']];
            }

            if ($keputusan === 'disetujui') {
                $hariKerja = Harian::tanggalHariKerja($izin->mulai, $izin->selesai);

                if (count($hariKerja) === 0 || $izin->selesai->lt(now()->startOfDay())) {
                    return ['galat' => [
                        'Rentang pengajuan ini sudah lewat atau tidak memuat hari kerja.',
                        422,
                        'rentang_tidak_sah',
                    ]];
                }

                $bentrok = Izin::where('pengguna_id', $izin->pengguna_id)
                    ->where('status', 'disetujui')
                    ->where('id', '!=', $izin->id)
                    ->whereDate('mulai', '<=', $izin->selesai->toDateString())
                    ->whereDate('selesai', '>=', $izin->mulai->toDateString())
                    ->exists();

                if ($bentrok) {
                    return ['galat' => [
                        'Sudah ada pengajuan lain yang disetujui pada tanggal itu.',
                        409,
                        'bentrok_izin',
                    ]];
                }

                if ($izin->jenis === 'cuti') {
                    $galat = $this->periksaKuota($izin, $pengguna);

                    if ($galat !== null) {
                        return ['galat' => $galat];
                    }
                }
            }

            $izin->update([
                'status' => $keputusan,
                'catatan_admin' => $catatan,
                'diputuskan_at' => now(),
                'diputuskan_oleh' => $aktor->id,
            ]);

            Audit::catat(
                $aktor->id,
                $keputusan === 'disetujui' ? 'setujui_izin' : 'tolak_izin',
                [
                    'izin_id' => $izin->id,
                    'pengguna_id' => $izin->pengguna_id,
                    'jenis' => $izin->jenis,
                    'mulai' => $izin->mulai->format('Y-m-d'),
                    'selesai' => $izin->selesai->format('Y-m-d'),
                ],
                $request
            );

            return ['izin' => $izin];
        });

        if (isset($hasil['galat'])) {
            return $this->galat($hasil['galat'][0], $hasil['galat'][1], $hasil['galat'][2]);
        }

        return response()->json($hasil['izin']->fresh(['pengguna'])->apiArray());
    }

    /** @return array{0: string, 1: int, 2: string}|null */
    private function periksaKuota(Izin $izin, Pengguna $pengguna): ?array
    {
        $tahunAwal = (int) $izin->mulai->format('Y');
        $tahunAkhir = (int) $izin->selesai->format('Y');

        for ($tahun = $tahunAwal; $tahun <= $tahunAkhir; $tahun++) {
            $jumlah = count(KuotaCuti::tanggalDalamKuota(
                $pengguna,
                $izin->mulai,
                $izin->selesai,
                $tahun
            ));

            if ($jumlah === 0) {
                continue;
            }

            $sisa = KuotaCuti::rekap($pengguna, $izin->id, $tahun)['sisa'];

            if ($jumlah > $sisa) {
                $pesan = "Sisa cuti {$pengguna->nama} {$sisa} hari, sedangkan yang diajukan {$jumlah} hari.";

                if ($tahunAwal !== $tahunAkhir) {
                    $pesan .= " Kekurangan ada pada tahun {$tahun}.";
                }

                return [$pesan, 422, 'kuota_tidak_cukup'];
            }
        }

        return null;
    }
}
