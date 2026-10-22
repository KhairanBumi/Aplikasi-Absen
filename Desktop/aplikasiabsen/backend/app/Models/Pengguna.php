<?php

namespace App\Models;

use App\Support\Foto;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pengguna extends Model
{
    protected $table = 'pengguna';

    protected $guarded = [];

    protected $hidden = ['pin_hash'];

    protected $casts = [
        'cuti_kuota' => 'integer',
        'aktif' => 'boolean',
        'masuk_kerja' => 'date',
        'lokasi_id' => 'integer',
        'shift_id' => 'integer',
    ];

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function lokasi(): BelongsTo
    {
        return $this->belongsTo(Lokasi::class, 'lokasi_id');
    }

    /** Bentuk objek `pengguna` yang dipakai /masuk dan /saya/profil. */
    public function apiArray(): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'email' => $this->email ?? '',
            'peran' => $this->peran,
            'nip' => $this->nip,
            'nik' => $this->nik,
            'divisi' => $this->divisi,
            'lokasi_id' => $this->lokasi_id,
            'shift_id' => $this->shift_id,
            'cuti_kuota' => $this->cuti_kuota,
            'aktif' => $this->aktif,
            'foto' => Foto::url($this->foto_path),
            'masuk_kerja' => $this->masuk_kerja?->format('Y-m-d'),
        ];
    }

    /** Baris Data Master: objek pengguna + nama shift dan lokasi. */
    public function adminArray(): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'email' => $this->email ?? '',
            'peran' => $this->peran,
            'nip' => $this->nip,
            'nik' => $this->nik,
            'divisi' => $this->divisi,
            'shift_id' => $this->shift_id,
            'lokasi_id' => $this->lokasi_id,
            'shift' => $this->shift?->nama,
            'lokasi' => $this->lokasi?->nama,
            'masuk_kerja' => $this->masuk_kerja?->format('Y-m-d'),
            'cuti_kuota' => $this->cuti_kuota,
            'aktif' => $this->aktif,
            'foto' => Foto::url($this->foto_path),
        ];
    }
}
