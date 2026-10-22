<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BerandaController extends Controller
{
    public function index(): BinaryFileResponse|JsonResponse
    {
        $index = public_path('index.html');

        return file_exists($index)
            ? response()->file($index)
            : response()->json(['ok' => true, 'aplikasi' => 'Aplikasi Absen']);
    }
}
