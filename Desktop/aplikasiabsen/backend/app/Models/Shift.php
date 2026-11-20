<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Shift extends Model
{
    protected $table = 'shift';

    protected $guarded = [];

    protected $casts = [
        'toleransi_menit' => 'integer',
        'aktif' => 'boolean',
    ];

    public function magang(): HasMany
    {
        return $this->hasMany(Pengguna::class, 'shift_id')
            ->where('peran', 'magang')
            ->where('aktif', true);
    }

    /** Menit keterlambatan terhadap jam masuk; 0 kalau masih dalam toleransi. */
    public function telatMenit(Carbon $waktu): int
    {
        $masuk = $waktu->copy()->startOfDay()->setTimeFromTimeString($this->masuk);

        if (strcmp((string) $this->pulang, (string) $this->masuk) < 0
            && $waktu->format('H:i:s') < (string) $this->pulang) {
            $masuk->subDay();
        }

        $batas = $masuk->copy()->addMinutes((int) $this->toleransi_menit);

        return max(0, intdiv($waktu->getTimestamp() - $batas->getTimestamp(), 60));
    }
}
