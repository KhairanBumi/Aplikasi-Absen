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
        'diputuskan_oleh' => 'integer',
        'diputuskan_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'pengguna_id');
    }

    public function pemutus(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'diputuskan_oleh');
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

    /** Bentuk satu baris absen dinas luar untuk endpoint magang dan admin. */
    public function apiArray(): array
    {
        return [
            'id' => $this->id,
            'pengguna_id' => $this->pengguna_id,
            'nama' => $this->pengguna?->nama ?? $this->nama_salinan,
            'nip' => $this->pengguna?->nip ?? $this->nip_salinan,
            'divisi' => $this->pengguna?->divisi,
            'tanggal' => $this->tanggal->format('Y-m-d'),
            'tipe' => $this->tipe,
            'waktu' => $this->waktu?->toIso8601String(),
            'status_persetujuan' => $this->status_persetujuan,
            'keterangan_dinas' => $this->keterangan_dinas,
            'catatan_admin' => $this->catatan_admin,
            'diputuskan_at' => $this->diputuskan_at?->toIso8601String(),
            'telat_menit' => $this->telat_menit,
            'lokasi_id' => $this->lokasi_id,
            'lokasi' => 'Dinas luar',
            'lokasi_kantor' => $this->lokasi?->nama,
            'mode' => $this->mode,
            'lintang' => $this->lintang,
            'bujur' => $this->bujur,
            'akurasi' => $this->akurasi,
            'jarak_m' => $this->jarak_m,
            'lokasi_teks' => $this->lokasi_teks,
            'lokasi_meragukan' => (bool) $this->lokasi_meragukan,
            'foto' => $this->fotoUrl(),
        ];
    }
}
