<?php

namespace App\Http\Middleware;

use App\Models\Sesi;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TokenAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return $this->sesiHabis();
        }

        $sesi = Sesi::with('pengguna')
            ->where('token_hash', hash('sha256', $token))
            ->first();

        if (! $sesi || $sesi->expires_at->isPast()) {
            $sesi?->delete();

            return $this->sesiHabis();
        }

        $pengguna = $sesi->pengguna;

        if (! $pengguna) {
            $sesi->delete();

            return $this->sesiHabis();
        }

        if (! $pengguna->aktif) {
            return response()->json([
                'message' => 'Akun Anda sudah dinonaktifkan. Hubungi admin.',
                'kode' => 'akun_nonaktif',
            ], 403);
        }

        $sesi->last_used_at = now();
        $sesi->save();

        $request->attributes->set('pengguna', $pengguna);
        $request->attributes->set('sesi', $sesi);

        return $next($request);
    }

    private function sesiHabis(): Response
    {
        return response()->json([
            'message' => 'Sesi Anda sudah berakhir. Silakan masuk lagi.',
            'kode' => 'sesi_habis',
        ], 401);
    }
}
