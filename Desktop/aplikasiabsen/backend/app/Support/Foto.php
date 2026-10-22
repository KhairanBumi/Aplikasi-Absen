<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use RuntimeException;

class Foto
{
    /** URL bertanda tangan berumur pendek, atau null kalau file tidak ada. */
    public static function url(?string $path): ?string
    {
        if (! $path || ! Storage::disk('local')->exists($path)) {
            return null;
        }

        $kode = rtrim(strtr(base64_encode($path), '+/', '-_'), '=');

        return URL::temporarySignedRoute('foto', now()->addMinutes(10), ['kode' => $kode]);
    }

    /** Simpan foto absen di disk privat dan kembalikan path relatifnya. */
    public static function simpan(string $biner, string $ekstensi): string
    {
        $path = 'absen/'.now()->format('Y/m/d').'/'.Str::uuid().'.'.$ekstensi;

        if (! Storage::disk('local')->put($path, $biner)) {
            throw new RuntimeException('Gagal menyimpan foto absen.');
        }

        return $path;
    }

    public static function hapus(?string $path): void
    {
        if ($path) {
            Storage::disk('local')->delete($path);
        }
    }
}
