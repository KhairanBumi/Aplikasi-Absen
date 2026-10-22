<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FotoController extends Controller
{
    public function show(Request $request, string $kode): StreamedResponse
    {
        $kode = strtr($kode, '-_', '+/');
        $sisa = strlen($kode) % 4;

        if ($sisa) {
            $kode .= str_repeat('=', 4 - $sisa);
        }

        $path = base64_decode($kode, true);

        if ($path === false
            || ! str_starts_with($path, 'absen/')
            || str_contains($path, '..')
            || str_contains($path, '\\')) {
            abort(404);
        }

        $disk = Storage::disk('local');

        if (! $disk->exists($path)) {
            abort(404);
        }

        return $disk->response($path, null, [
            'Cache-Control' => 'private, max-age=600',
        ]);
    }
}
