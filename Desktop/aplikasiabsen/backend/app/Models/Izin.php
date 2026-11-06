<?php

namespace App\Models;

use App\Support\Harian;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Izin extends Model
{
    public const JENIS = ['cuti', 'izin', 'sakit'];

    public const STATUS = ['menunggu', 'disetujui', 'ditolak'];

    protected $table = 'izin';

    protected $guarded = [];

    protected $casts = [
        'mulai' => 'date',
        'selesai' => 'date',
        'diajukan_at' => 'datetime',
        'diputuskan_at' => 'datetime',
    ];

    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'pengguna_id');
    }

    public function pemutus(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'diputuskan_oleh');
    }

    public function apiArray(): array
    {
        return [
            'id' => $this->id,
            'pengguna_id' => $this->pengguna_id,
            'nama' => $this->pengguna?->nama,
            'nip' => $this->pengguna?->nip,
            'divisi' => $this->pengguna?->divisi,
            'jenis' => $this->jenis,
            'mulai' => $this->mulai->format('Y-m-d'),
            'selesai' => $this->selesai->format('Y-m-d'),
            'hari_kerja' => Harian::hitungHariKerja($this->mulai, $this->selesai),
            'alasan' => $this->alasan,
            'status' => $this->status,
            'diajukan' => $this->diajukan_at?->toIso8601String(),
            'catatan_admin' => $this->catatan_admin,
            'diputuskan' => $this->diputuskan_at?->toIso8601String(),
        ];
    }
}
