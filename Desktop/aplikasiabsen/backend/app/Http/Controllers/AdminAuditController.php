<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'aksi' => ['nullable', 'string', 'max:80'],
            'pengguna_id' => ['nullable', 'integer', 'min:1'],
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
            'halaman' => ['nullable', 'integer', 'min:1'],
            'per' => ['nullable', 'integer', 'min:1', 'max:100'],
        ], [
            'dari.date_format' => 'Tanggal awal harus berformat YYYY-MM-DD.',
            'sampai.date_format' => 'Tanggal akhir harus berformat YYYY-MM-DD.',
        ]);

        $sampai = isset($data['sampai'])
            ? Carbon::createFromFormat('Y-m-d', $data['sampai'], 'Asia/Jakarta')->endOfDay()
            : now()->endOfDay();

        $dari = isset($data['dari'])
            ? Carbon::createFromFormat('Y-m-d', $data['dari'], 'Asia/Jakarta')->startOfDay()
            : $sampai->copy()->subDays(29)->startOfDay();

        if ($dari->greaterThan($sampai)) {
            return $this->galat('Tanggal awal tidak boleh setelah tanggal akhir.', 422, 'rentang_tidak_valid');
        }

        if ($dari->diffInDays($sampai) > 90) {
            return $this->galat('Rentang audit maksimal 90 hari.', 422, 'rentang_terlalu_lama');
        }

        $kueri = Audit::with('pengguna:id,nama,nip')
            ->whereBetween('created_at', [$dari, $sampai])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (! empty($data['aksi'])) {
            $kueri->where('aksi', $data['aksi']);
        }

        if (! empty($data['pengguna_id'])) {
            $kueri->where('pengguna_id', (int) $data['pengguna_id']);
        }

        $hasil = $kueri->paginate(
            (int) ($data['per'] ?? 50),
            ['id', 'pengguna_id', 'aksi', 'rincian', 'ip', 'user_agent', 'created_at'],
            'halaman',
            (int) ($data['halaman'] ?? 1),
        );

        return response()->json([
            'data' => collect($hasil->items())->map(fn (Audit $audit) => [
                'id' => $audit->id,
                'waktu' => $audit->created_at->toIso8601String(),
                'aksi' => $audit->aksi,
                'pengguna_id' => $audit->pengguna_id,
                'aktor' => $audit->pengguna ? [
                    'nama' => $audit->pengguna->nama,
                    'nip' => $audit->pengguna->nip,
                ] : null,
                'rincian' => $audit->rincian ?? [],
                'ip' => $audit->ip,
                'user_agent' => $audit->user_agent,
            ])->all(),
            'meta' => [
                'halaman' => $hasil->currentPage(),
                'per' => $hasil->perPage(),
                'total' => $hasil->total(),
                'terakhir' => $hasil->lastPage(),
            ],
        ]);
    }
}
