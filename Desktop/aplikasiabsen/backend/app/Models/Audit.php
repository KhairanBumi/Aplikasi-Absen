<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class Audit extends Model
{
    protected $table = 'audit';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'rincian' => 'array',
        'created_at' => 'datetime',
    ];

    public static function catat(?int $penggunaId, string $aksi, array $rincian, Request $request): void
    {
        static::create([
            'pengguna_id' => $penggunaId,
            'aksi' => $aksi,
            'rincian' => $rincian,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent() ? mb_substr($request->userAgent(), 0, 255) : null,
            'created_at' => now(),
        ]);
    }
}
