<?php

namespace App\Console\Commands;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Sesi;
use App\Support\Foto;
use Illuminate\Console\Command;

class BersihkanData extends Command
{
    protected $signature = 'absen:bersihkan {--force} {--hari=}';

    protected $description = 'Menghapus foto lama, audit lama, dan sesi kedaluwarsa sesuai kebijakan retensi.';

    public function handle(): int
    {
        $hari = (int) ($this->option('hari') ?: config('absensi.foto_simpan_hari', 180));
        $batas = now()->subDays($hari);

        $foto = Absen::whereNotNull('foto_path')->where('waktu', '<', $batas);
        $jumlahFoto = (clone $foto)->count();
        $jumlahAudit = Audit::where('created_at', '<', now()->subDays(
            (int) config('absensi.audit_simpan_hari', 730)
        ))->count();
        $jumlahSesi = Sesi::where('expires_at', '<', now())->count();

        if (! $this->option('force')) {
            $this->line('dry run: tidak ada yang dihapus.');
            $this->line($jumlahFoto.' foto lebih lama dari '.$hari.' hari.');
            $this->line($jumlahAudit.' audit lebih lama dari batas audit.');
            $this->line($jumlahSesi.' sesi kedaluwarsa.');

            return 0;
        }

        $dihapus = 0;

        // Ambil id lebih dulu: `save()` mengubah `foto_path`, sehingga chunk
        // yang memakai kriteria sama bisa melewati baris.
        $idFoto = (clone $foto)->orderBy('id')->pluck('id');

        foreach ($idFoto->chunk(100) as $potongan) {
            foreach (Absen::whereIn('id', $potongan)->get() as $absen) {
                Foto::hapus($absen->foto_path);
                $absen->foto_path = null;
                $absen->save();
                $dihapus++;
            }
        }

        Audit::where('created_at', '<', now()->subDays(
            (int) config('absensi.audit_simpan_hari', 730)
        ))->delete();

        Sesi::where('expires_at', '<', now())->delete();

        $this->line($dihapus.' foto dihapus; baris absen dipertahankan.');
        $this->line($jumlahAudit.' audit dihapus.');
        $this->line($jumlahSesi.' sesi kedaluwarsa dihapus.');

        return 0;
    }
}
