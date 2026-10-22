<?php

namespace App\Models;

use App\Support\Foto;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Absen extends Model
{
    protected $table = 'absen';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'tanggal' => 'date',
        'waktu' => 'datetime',
        'lintang' => 'float',
        'bujur' => 'float',
        'akurasi' => 'integer',
        'jarak_m' => 'integer',
        'lokasi_meragukan' => 'boolean',
        'telat_menit' => 'integer',
        'created_at' => 'datetime',
    ];

    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'pengguna_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function lokasi(): BelongsTo
    {
        return $this->belongsTo(Lokasi::class, 'lokasi_id');
    }

    public function fotoUrl(): ?string
    {
        return Foto::url($this->foto_path);
    }
}
