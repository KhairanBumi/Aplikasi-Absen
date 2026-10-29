<?php

namespace App\Http\Controllers;

use App\Support\Anomali;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminAnomaliController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d'],
        ], [
            'dari.date_format' => 'Tanggal awal harus berformat YYYY-MM-DD.',
            'sampai.date_format' => 'Tanggal akhir harus berformat YYYY-MM-DD.',
        ]);

        $sampai = isset($data['sampai'])
            ? Carbon::createFromFormat('Y-m-d', $data['sampai'], 'Asia/Jakarta')->endOfDay()
            : now()->endOfDay();

        $dari = isset($data['dari'])
            ? Carbon::createFromFormat('Y-m-d', $data['dari'], 'Asia/Jakarta')->startOfDay()
            : $sampai->copy()->subDays(6)->startOfDay();

        if ($dari->greaterThan($sampai)) {
            return $this->galat('Tanggal awal tidak boleh setelah tanggal akhir.', 422, 'rentang_tidak_valid');
        }

        if ($dari->diffInDays($sampai) > 31) {
            return $this->galat('Rentang anomali maksimal 31 hari.', 422, 'rentang_terlalu_lama');
        }

        return response()->json([
            'dari' => $dari->toDateString(),
            'sampai' => $sampai->toDateString(),
            'data' => Anomali::kumpulkan($dari, $sampai),
        ]);
    }
}
