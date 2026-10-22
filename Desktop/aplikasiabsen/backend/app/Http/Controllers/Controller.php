<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class Controller
{
    protected function galat(string $message, int $status, ?string $kode = null, array $errors = []): JsonResponse
    {
        $body = ['message' => $message];

        if ($kode) {
            $body['kode'] = $kode;
        }

        if ($errors) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }

    protected function terlaluBanyak(): JsonResponse
    {
        return $this->galat(
            'Terlalu banyak percobaan. Coba lagi dalam 60 detik.',
            429,
            'terlalu_banyak'
        );
    }
}
