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

    /**
     * Baca data URI foto absen. Balasan galat memakai bentuk yang sama dengan
     * `Controller::galat()` supaya pemanggil tinggal meneruskannya.
     *
     * @return array{biner: string, ekstensi: string}|array{status: int, kode: string, pesan: string}
     */
    public static function baca(string $foto): array
    {
        if (strlen($foto) > 400_000) {
            return self::galatFoto(413, 'foto_terlalu_besar', 'Foto terlalu besar. Maksimal 200 KB.');
        }

        if (! preg_match('#^data:image/(jpeg|png);base64,#', $foto, $cocok)) {
            return self::galatFoto(422, 'foto_tidak_valid', 'Foto harus berupa gambar JPEG atau PNG.');
        }

        $biner = base64_decode(substr($foto, strlen($cocok[0])), true);

        if ($biner === false || $biner === '') {
            return self::galatFoto(422, 'foto_tidak_valid', 'Foto kosong atau rusak.');
        }

        if (strlen($biner) > (int) config('absensi.foto_max_bytes', 204800)) {
            return self::galatFoto(413, 'foto_terlalu_besar', 'Foto terlalu besar. Maksimal 200 KB.');
        }

        $jpeg = substr($biner, 0, 3) === "\xFF\xD8\xFF";
        $png = substr($biner, 0, 4) === "\x89PNG";

        if (($cocok[1] === 'jpeg' && ! $jpeg) || ($cocok[1] === 'png' && ! $png)) {
            return self::galatFoto(
                422,
                'foto_tidak_valid',
                'Isi foto tidak cocok dengan format gambar yang dikirim.'
            );
        }

        return ['biner' => $biner, 'ekstensi' => $cocok[1] === 'png' ? 'png' : 'jpg'];
    }

    private static function galatFoto(int $status, string $kode, string $pesan): array
    {
        return ['status' => $status, 'kode' => $kode, 'pesan' => $pesan];
    }
}
