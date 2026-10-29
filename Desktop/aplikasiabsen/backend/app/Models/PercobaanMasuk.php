<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PercobaanMasuk extends Model
{
    protected $table = 'percobaan_masuk';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'berhasil' => 'boolean',
        'created_at' => 'datetime',
    ];
}
