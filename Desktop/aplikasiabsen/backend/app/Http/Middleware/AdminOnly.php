<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $pengguna = $request->attributes->get('pengguna');

        if (! $pengguna || $pengguna->peran !== 'admin') {
            return response()->json([
                'message' => 'Anda tidak berhak membuka halaman ini.',
                'kode' => 'tidak_berhak',
            ], 403);
        }

        return $next($request);
    }
}
