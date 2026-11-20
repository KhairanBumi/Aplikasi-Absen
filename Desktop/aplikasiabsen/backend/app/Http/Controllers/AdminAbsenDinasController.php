<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAbsenDinasController extends Controller
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

        // Absen kiosk boleh bermode luar, tetapi bukan pengajuan dinas mandiri.
        $query = Absen::with(['pengguna', 'lokasi'])
            ->whereNotNull('keterangan_dinas')
            ->orderByDesc('waktu')
            ->orderByDesc('id');

        if ($status !== 'semua') {
            $query->where('status_persetujuan', $status);
        }

        $data = $query->get()
            ->map(fn (Absen $absen) => $absen->apiArray())
            ->values();

        $jumlah = Absen::whereNotNull('keterangan_dinas')
            ->selectRaw('status_persetujuan, COUNT(*) as jumlah')
            ->groupBy('status_persetujuan')
            ->pluck('jumlah', 'status_persetujuan');

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
                'catatan' => ['required', 'string'],
            ], [
                'catatan.required' => 'Catatan wajib diisi saat menolak pengajuan.',
                'catatan.string' => 'Catatan harus berupa teks.',
            ]);

            $catatan = trim($data['catatan']);
            $panjang = mb_strlen($catatan);

            if ($panjang < 4 || $panjang > 500) {
                $pesan = $panjang < 4
                    ? 'Catatan minimal 4 karakter.'
                    : 'Catatan maksimal 500 karakter.';

                return $this->galat($pesan, 422, null, ['catatan' => [$pesan]]);
            }
        }

        $aktor = $request->attributes->get('pengguna');

        $hasil = DB::transaction(function () use ($id, $keputusan, $catatan, $request, $aktor) {
            $absen = Absen::lockForUpdate()->find($id);

            if (! $absen || $absen->keterangan_dinas === null) {
                return ['galat' => ['Baris absen dinas tidak ditemukan.', 404, 'tidak_ditemukan']];
            }

            if ($absen->status_persetujuan !== 'menunggu') {
                return ['galat' => ['Absen dinas ini sudah diputuskan.', 409, 'sudah_diputuskan']];
            }

            $absen->update([
                'status_persetujuan' => $keputusan,
                'catatan_admin' => $catatan,
                'diputuskan_at' => now(),
                'diputuskan_oleh' => $aktor->id,
            ]);

            Audit::catat(
                $aktor->id,
                $keputusan === 'disetujui' ? 'setujui_absen_dinas' : 'tolak_absen_dinas',
                [
                    'absen_id' => $absen->id,
                    'pengguna_id' => $absen->pengguna_id,
                    'tipe' => $absen->tipe,
                    'tanggal' => $absen->tanggal->format('Y-m-d'),
                ],
                $request
            );

            return ['absen' => $absen];
        });

        if (isset($hasil['galat'])) {
            return $this->galat($hasil['galat'][0], $hasil['galat'][1], $hasil['galat'][2]);
        }

        return response()->json($hasil['absen']->fresh(['pengguna', 'lokasi'])->apiArray());
    }
}
