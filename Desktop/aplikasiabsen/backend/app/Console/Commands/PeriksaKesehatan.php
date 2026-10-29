<?php

namespace App\Console\Commands;

use App\Models\Absen;
use App\Models\Sesi;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PeriksaKesehatan extends Command
{
    protected $signature = 'absen:periksa {--json}';

    protected $description = 'Memeriksa database, penyimpanan, kapasitas disk, dan absen hari ini.';

    public function handle(): int
    {
        $hasil = [];
        $adaGalat = false;
        $adaPeringatan = false;

        try {
            DB::select('select 1');
            $hasil[] = ['nama' => 'database', 'status' => 'ok', 'pesan' => 'Terhubung.'];
        } catch (Throwable $e) {
            $hasil[] = ['nama' => 'database', 'status' => 'error', 'pesan' => 'Tidak bisa terhubung.'];
            $adaGalat = true;
        }

        try {
            Storage::disk('local')->put('.periksa-kesehatan', now()->toIso8601String());
            Storage::disk('local')->delete('.periksa-kesehatan');
            $hasil[] = ['nama' => 'penyimpanan', 'status' => 'ok', 'pesan' => 'Bisa ditulis.'];
        } catch (Throwable $e) {
            $hasil[] = ['nama' => 'penyimpanan', 'status' => 'error', 'pesan' => 'Tidak bisa ditulis.'];
            $adaGalat = true;
        }

        $bebas = @disk_free_space(storage_path());
        $total = @disk_total_space(storage_path());

        if ($bebas !== false && $total !== false && $total > 0) {
            $persenBebas = $bebas / $total * 100;
            $status = $persenBebas < 10 ? 'warning' : 'ok';
            $adaPeringatan = $adaPeringatan || $status === 'warning';
            $hasil[] = [
                'nama' => 'disk',
                'status' => $status,
                'pesan' => round($persenBebas, 1).'% bebas dari '.round($total / 1073741824, 1).' GB.',
            ];
        }

        $jumlahFoto = count(Storage::disk('local')->allFiles('absen'));
        $hasil[] = [
            'nama' => 'foto',
            'status' => 'ok',
            'pesan' => $jumlahFoto.' berkas di folder absen.',
        ];

        $absenHariIni = Absen::whereDate('tanggal', now()->toDateString())->count();
        $jam = now()->format('H:i');

        if (now()->isWeekday() && $jam >= '10:00' && $jam <= '17:00' && $absenHariIni === 0) {
            $hasil[] = [
                'nama' => 'absen_hari_ini',
                'status' => 'warning',
                'pesan' => 'Belum ada absen pada hari kerja setelah pukul 10.00.',
            ];
            $adaPeringatan = true;
        } else {
            $hasil[] = [
                'nama' => 'absen_hari_ini',
                'status' => 'ok',
                'pesan' => $absenHariIni.' absen hari ini.',
            ];
        }

        $hasil[] = [
            'nama' => 'sesi_aktif',
            'status' => 'ok',
            'pesan' => Sesi::where('expires_at', '>', now())->count().' sesi aktif.',
        ];

        $status = $adaGalat ? 'error' : ($adaPeringatan ? 'warning' : 'ok');

        if ($this->option('json')) {
            $this->line(json_encode([
                'status' => $status,
                'waktu' => now()->toIso8601String(),
                'pemeriksaan' => $hasil,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->line('status: '.$status);
            $this->table(['Pemeriksaan', 'Status', 'Pesan'], $hasil);
        }

        return $adaGalat ? 2 : ($adaPeringatan ? 1 : 0);
    }
}
