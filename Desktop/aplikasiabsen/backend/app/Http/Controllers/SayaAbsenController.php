<?php

namespace App\Http\Controllers;

use App\Support\Harian;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SayaAbsenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bulan = $request->query->has('bulan')
            ? $request->query('bulan')
            : now()->format('Y-m');

        if (! is_string($bulan) || ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $bulan)) {
            return $this->galat('Bulan harus berbentuk YYYY-MM.', 422, 'bulan_tidak_valid');
        }

        $awal = Carbon::createFromFormat('!Y-m-d', $bulan.'-01')->startOfDay();

        return response()->json(
            Harian::susun($request->attributes->get('pengguna'), $awal)
        );
    }
}
