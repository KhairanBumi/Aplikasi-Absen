<?php

namespace App\Support;

class Geo
{
    /** Jarak dua titik dalam meter (Haversine). */
    public static function jarakMeter(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371000;
        $rad = fn (float $d): float => $d * M_PI / 180;

        $dLat = $rad($lat2 - $lat1);
        $dLon = $rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos($rad($lat1)) * cos($rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * $r * asin(min(1, sqrt($a)));
    }
}
