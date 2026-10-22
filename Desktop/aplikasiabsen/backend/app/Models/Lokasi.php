<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lokasi extends Model
{
    protected $table = 'lokasi';

    protected $guarded = [];

    protected $casts = [
        'lintang' => 'float',
        'bujur' => 'float',
        'radius_m' => 'integer',
        'aktif' => 'boolean',
    ];

    public function magang(): HasMany
    {
        return $this->hasMany(Pengguna::class, 'lokasi_id')
            ->where('peran', 'magang')
            ->where('aktif', true);
    }
}
