<?php

namespace Tests\Feature;

use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAuditTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $admin;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-07 12:00:00', 'Asia/Jakarta'));

        $lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);

        $this->admin = Pengguna::create([
            'nama' => 'Administrator', 'nip' => 'ADM401', 'pin_hash' => Hash::make('1357'),
            'peran' => 'admin', 'divisi' => 'Management Data', 'shift_id' => $shift->id,
            'lokasi_id' => $lokasi->id, 'masuk_kerja' => '2026-01-01', 'cuti_kuota' => 12,
            'aktif' => true,
        ]);

        $this->token = bin2hex(random_bytes(32));
        Sesi::create([
            'pengguna_id' => $this->admin->id,
            'token_hash' => hash('sha256', $this->token),
            'expires_at' => now()->addHours(12),
            'last_used_at' => now(),
            'created_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_menampilkan_audit_terbaru_dengan_aktor(): void
    {
        Audit::create([
            'pengguna_id' => $this->admin->id,
            'aksi' => 'tambah_magang',
            'rincian' => ['pengguna_id' => 7, 'nip' => 'MGG002'],
            'ip' => '10.0.0.5',
            'user_agent' => 'Mozilla/5.0',
            'created_at' => now()->subMinute(),
        ]);
        Audit::create([
            'pengguna_id' => $this->admin->id,
            'aksi' => 'ubah_lokasi',
            'rincian' => ['lokasi_id' => 2],
            'ip' => '10.0.0.5',
            'user_agent' => 'Mozilla/5.0',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/audit')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.aksi', 'ubah_lokasi')
            ->assertJsonPath('data.0.aktor.nip', 'ADM401')
            ->assertJsonPath('data.1.aksi', 'tambah_magang');
    }

    public function test_filter_aksi_dan_paginasi(): void
    {
        foreach (['tambah_magang', 'ubah_magang', 'tambah_magang'] as $i => $aksi) {
            Audit::create([
                'pengguna_id' => $this->admin->id,
                'aksi' => $aksi,
                'rincian' => ['ke' => $i],
                'created_at' => now()->subMinutes($i),
            ]);
        }

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/audit?aksi=tambah_magang&per=1&halaman=2')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.halaman', 2)
            ->assertJsonPath('meta.terakhir', 2)
            ->assertJsonCount(1, 'data');
    }

    public function test_rentang_lebih_dari_90_hari_ditolak(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/audit?dari=2026-01-01&sampai=2026-06-01')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_terlalu_lama');
    }
}
