<?php

namespace App\Http\Controllers;

use App\Models\Pengguna;
use App\Models\Sesi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function masuk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nip' => ['required', 'string', 'max:30'],
            'pin' => ['required', 'regex:/^\d{4,6}$/'],
        ], [
            'nip.required' => 'NIP wajib diisi.',
            'pin.required' => 'PIN wajib diisi.',
            'pin.regex' => 'PIN harus 4 sampai 6 angka.',
        ]);

        $nip = strtoupper(trim($data['nip']));
        $pin = (string) $data['pin'];
        $ip = $request->ip() ?? 'tidak-diketahui';
        $kunci = "masuk:{$nip}:{$ip}";

        if (RateLimiter::tooManyAttempts($kunci, 5)) {
            return $this->terlaluBanyak();
        }

        $pengguna = Pengguna::where('nip', $nip)->first();

        if (! $pengguna || ! Hash::check($pin, $pengguna->pin_hash)) {
            RateLimiter::hit($kunci, 60);

            if (RateLimiter::attempts($kunci) >= 5) {
                return $this->terlaluBanyak();
            }

            return $this->galat('NIP atau PIN salah.', 401, 'kredensial_salah');
        }

        RateLimiter::clear($kunci);

        if (! $pengguna->aktif) {
            return $this->galat(
                'Akun Anda sudah dinonaktifkan. Hubungi admin.',
                403,
                'akun_nonaktif'
            );
        }

        $token = Sesi::terbitkan($pengguna, $ip, $request->userAgent());

        return response()->json([
            'token' => $token,
            'pengguna' => $pengguna->apiArray(),
        ]);
    }

    public function keluar(Request $request): JsonResponse
    {
        $request->attributes->get('sesi')?->delete();

        return response()->json(['ok' => true]);
    }

    public function profil(Request $request): JsonResponse
    {
        return response()->json(
            $request->attributes->get('pengguna')->apiArray()
        );
    }
}
