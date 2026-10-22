<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
}
