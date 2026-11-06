<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PeriksaKesehatanTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_status_ok_pada_pagi_hari_kerja_tanpa_absen(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-10-19 09:00:00', 'Asia/Jakarta'));

        $this->artisan('absen:periksa', ['--json' => true])
            ->assertExitCode(0)
            ->expectsOutputToContain('"status": "ok"');
    }

    public function test_memberi_peringatan_kalau_belum_ada_absen_setelah_jam_sepuluh(): void
    {
        Storage::fake('local');
        Carbon::setTestNow(Carbon::parse('2026-10-19 11:00:00', 'Asia/Jakarta'));

        $this->artisan('absen:periksa', ['--json' => true])
            ->assertExitCode(1)
            ->expectsOutputToContain('"status": "warning"');
    }

    public function test_jadwal_terdaftar(): void
    {
        $this->artisan('schedule:list')
            ->assertSuccessful()
            ->expectsOutputToContain('absen:periksa');
    }
}
