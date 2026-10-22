<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sesi extends Model
{
    protected $table = 'sesi';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'last_used_at' => 'datetime',
    ];

    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'pengguna_id');
    }

    public static function terbitkan(Pengguna $pengguna, string $ip, ?string $userAgent): string
    {
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

        static::create([
            'pengguna_id' => $pengguna->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHours((int) config('absensi.token_ttl_hours', 12)),
            'created_at' => now(),
            'ip' => $ip,
            'user_agent' => $userAgent ? mb_substr($userAgent, 0, 255) : null,
        ]);

        return $token;
    }
}
