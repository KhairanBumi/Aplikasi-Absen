<?php

namespace Tests\Feature;

use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminLokasiTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor Pusat',
            'alamat' => 'Jl. Jenderal Sudirman No. 1, Jakarta',
            'lintang' => -6.2246,
            'bujur' => 106.8094,
            'radius_m' => 50,
            'aktif' => true,
        ]);

        $this->shift = Shift::create([
            'nama' => 'Reguler',
            'masuk' => '08:00',
            'pulang' => '17:00',
            'toleransi_menit' => 15,
            'aktif' => true,
        ]);

        Pengguna::create([
            'nama' => 'Administrator',
            'email' => 'adm001@kantor.id',
            'nip' => 'ADM001',
            'pin_hash' => Hash::make('2468'),
            'peran' => 'admin',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    public function test_admin_membuat_lokasi_baru(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson('/api/admin/lokasi', [
                'nama' => '  Kantor Bandung  ',
                'alamat' => '  Jl. Asia Afrika No. 3  ',
                'lintang' => '-6.921840',
                'bujur' => '107.607120',
                'radius_m' => '75',
                'aktif' => 'false',
            ])
            ->assertCreated()
            ->assertJsonPath('nama', 'Kantor Bandung')
            ->assertJsonPath('alamat', 'Jl. Asia Afrika No. 3')
            ->assertJsonPath('lintang', -6.92184)
            ->assertJsonPath('bujur', 107.60712)
            ->assertJsonPath('radius_m', 75)
            ->assertJsonPath('aktif', false)
            ->assertJsonPath('jumlah_magang', 0);

        $this->assertDatabaseHas('lokasi', [
            'nama' => 'Kantor Bandung',
            'lintang' => -6.92184,
            'bujur' => 107.60712,
            'radius_m' => 75,
            'aktif' => false,
        ]);

        $this->assertDatabaseHas('audit', [
            'aksi' => 'tambah_lokasi',
        ]);
    }

    public function test_nama_lokasi_tidak_boleh_kembar_tanpa_bedakan_huruf(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson('/api/admin/lokasi', [
                'nama' => 'kantor pusat',
                'lintang' => '-6.9',
                'bujur' => '107.6',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'nama_dipakai');
    }

    public function test_admin_mengubah_lokasi_sebagian(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/admin/lokasi/{$this->lokasi->id}", [
                'nama' => 'Kantor Pusat Baru',
            ])
            ->assertOk()
            ->assertJsonPath('nama', 'Kantor Pusat Baru')
            ->assertJsonPath('lintang', -6.2246)
            ->assertJsonPath('bujur', 106.8094);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/admin/lokasi/{$this->lokasi->id}", [
                'lintang' => '-6.3',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Lintang dan bujur harus dikirim berpasangan.');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/admin/lokasi/{$this->lokasi->id}", [
                'lintang' => '-6.3',
                'bujur' => '106.9',
                'radius_m' => 100,
            ])
            ->assertOk()
            ->assertJsonPath('lintang', -6.3)
            ->assertJsonPath('bujur', 106.9)
            ->assertJsonPath('radius_m', 100);

        $this->assertDatabaseHas('audit', [
            'aksi' => 'ubah_lokasi',
        ]);
    }

    public function test_koordinat_dan_id_lokasi_tidak_sah(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/lokasi', [
                'nama' => 'Kantor Salah',
                'lintang' => '-91',
                'bujur' => '107.6',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.lintang.0', 'Lintang harus antara -90 dan 90.');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/lokasi/999999', [
                'nama' => 'Tidak Ada',
            ])
            ->assertStatus(404)
            ->assertJsonPath('message', 'Lokasi tidak ditemukan.');
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }
}
