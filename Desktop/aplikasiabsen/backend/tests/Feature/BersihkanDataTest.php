<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BersihkanDataTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $pengguna;

    private Lokasi $lokasi;

    private Shift $shift;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-10-28 02:00:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $this->shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);
        $this->pengguna = Pengguna::create([
            'nama' => 'Siti', 'nip' => 'MGG501', 'pin_hash' => Hash::make('1357'),
            'peran' => 'magang', 'divisi' => 'Pendataan', 'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id, 'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12, 'aktif' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_dry_run_tidak_menghapus_apa_pun(): void
    {
        $absen = $this->absenLama();

        $this->artisan('absen:bersihkan')
            ->expectsOutputToContain('dry run')
            ->assertExitCode(0);

        Storage::disk('local')->assertExists($absen->foto_path);
        $this->assertNotNull($absen->fresh()->foto_path);
    }

    public function test_force_menghapus_foto_lama_dan_menyisakan_baris(): void
    {
        $absen = $this->absenLama();
        $baru = $this->absenLama(now()->subDays(10), 'absen/baru.jpg');
        Storage::disk('local')->put('absen/baru.jpg', 'x');

        $this->artisan('absen:bersihkan', ['--force' => true])->assertExitCode(0);

        Storage::disk('local')->assertMissing($absen->foto_path);
        Storage::disk('local')->assertExists('absen/baru.jpg');
        $this->assertNull($absen->fresh()->foto_path);
        $this->assertSame(2, Absen::count());
        $this->assertNotNull($baru->fresh()->foto_path);
    }

    public function test_force_menghapus_sesi_kedaluwarsa(): void
    {
        Sesi::create([
            'pengguna_id' => $this->pengguna->id,
            'token_hash' => hash('sha256', 'token-lama'),
            'expires_at' => now()->subDay(),
            'last_used_at' => now()->subDays(2),
            'created_at' => now()->subDays(2),
        ]);

        $this->artisan('absen:bersihkan', ['--force' => true])->assertExitCode(0);

        $this->assertSame(0, Sesi::count());
    }

    public function test_force_menghapus_audit_lama_dan_menyisakan_yang_baru(): void
    {
        Audit::create([
            'pengguna_id' => $this->pengguna->id,
            'aksi' => 'uji_lama',
            'rincian' => [],
            'created_at' => now()->subDays(800),
        ]);
        Audit::create([
            'pengguna_id' => $this->pengguna->id,
            'aksi' => 'uji_baru',
            'rincian' => [],
            'created_at' => now()->subDays(10),
        ]);

        $this->artisan('absen:bersihkan', ['--force' => true])->assertExitCode(0);

        $this->assertSame(1, Audit::count());
        $this->assertSame('uji_baru', Audit::firstOrFail()->aksi);
    }

    private function absenLama(?Carbon $waktu = null, string $path = 'absen/lama.jpg'): Absen
    {
        $waktu ??= now()->subDays(200);
        Storage::disk('local')->put($path, 'x');

        return Absen::create([
            'pengguna_id' => $this->pengguna->id,
            'tanggal' => $waktu->toDateString(),
            'tipe' => 'masuk',
            'waktu' => $waktu,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->pengguna->nama,
            'nip_salinan' => $this->pengguna->nip,
            'foto_path' => $path,
            'kiosk_id' => 'kiosk-uji',
            'ip' => '10.0.0.1',
            'created_at' => $waktu,
        ]);
    }
}
