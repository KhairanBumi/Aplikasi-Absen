<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class Nominatim
{
    /**
     * Alamat pendek dari koordinat. Layanan gratis: 1 permintaan/detik,
     * hasil di-cache 30 hari, dan kegagalan tidak boleh menggagalkan absen.
     */
    public static function alamat(?float $lat, ?float $lon): ?string
    {
        if ($lat === null || $lon === null) {
            return null;
        }

        $kunci = 'geokode:'.round($lat, 4).','.round($lon, 4);

        try {
            return Cache::remember($kunci, now()->addDays(30), function () use ($lat, $lon) {
                return Cache::lock('nominatim', 2)->block(2, function () use ($lat, $lon) {
                    $jawab = Http::withHeaders([
                        'User-Agent' => config('absensi.nominatim_user_agent'),
                        'Accept' => 'application/json',
                    ])->timeout(3)->get('https://nominatim.openstreetmap.org/reverse', [
                        'format' => 'jsonv2',
                        'lat' => $lat,
                        'lon' => $lon,
                        'zoom' => 18,
                        'addressdetails' => 1,
                        'accept-language' => 'id',
                    ]);

                    if (! $jawab->ok()) {
                        return null;
                    }

                    $a = $jawab->json('address', []);
                    $jalan = trim(($a['road'] ?? '').' '.($a['house_number'] ?? ''));
                    $daerah = $a['village'] ?? $a['suburb'] ?? $a['city_district'] ?? $a['town'] ?? null;
                    $kota = $a['city'] ?? $a['county'] ?? $a['state'] ?? null;

                    return collect([$jalan ?: ($a['amenity'] ?? $a['shop'] ?? null), $daerah, $kota])
                        ->filter()
                        ->unique()
                        ->implode(', ') ?: $jawab->json('display_name');
                });
            });
        } catch (\Throwable) {
            return null;
        }
    }
}
