<?php

namespace Tests\Feature;

use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminHariLiburTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-21 12:00:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor Pusat',
            'lintang' => -6.2,
            'bujur' => 106.8,
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

        $this->admin = Pengguna::create([
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

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_daftar_urut_tanggal_naik(): void
    {
        HariLibur::create(['tanggal' => '2026-12-25', 'keterangan' => 'Natal']);
        HariLibur::create(['tanggal' => '2026-01-01', 'keterangan' => 'Tahun Baru']);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/hari-libur')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.tanggal', '2026-01-01')
            ->assertJsonPath('data.1.tanggal', '2026-12-25');

        $this->assertSame('Tahun Baru', $res->json('data.0.keterangan'));
    }

    public function test_tambah_ubah_dan_hapus_hari_libur(): void
    {
        $token = $this->tokenAdmin();

        $id = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-10-19',
                'keterangan' => '  Cuti bersama  ',
            ])
            ->assertCreated()
            ->assertJsonPath('tanggal', '2026-10-19')
            ->assertJsonPath('keterangan', 'Cuti bersama')
            ->json('id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/admin/hari-libur/{$id}", [
                'keterangan' => 'Cuti bersama panjang',
            ])
            ->assertOk()
            ->assertJsonPath('tanggal', '2026-10-19')
            ->assertJsonPath('keterangan', 'Cuti bersama panjang');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/admin/hari-libur/{$id}")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('hari_libur', ['id' => $id]);
        $this->assertDatabaseHas('audit', ['aksi' => 'tambah_hari_libur']);
        $this->assertDatabaseHas('audit', ['aksi' => 'ubah_hari_libur']);
        $this->assertDatabaseHas('audit', ['aksi' => 'hapus_hari_libur']);
    }

    public function test_tanggal_kembar_dan_tidak_sah_ditolak(): void
    {
        HariLibur::create(['tanggal' => '2026-10-19', 'keterangan' => 'Libur Uji']);
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-10-19',
                'keterangan' => 'Libur Lain',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'tanggal_dipakai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-02-31',
                'keterangan' => 'Tanggal Salah',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('tanggal');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/hari-libur/999999', [
                'keterangan' => 'Tidak Ada',
            ])
            ->assertStatus(404);
    }

    public function test_id_hari_libur_non_angka_ditolak_404(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/hari-libur/abc', ['keterangan' => 'Salah'])
            ->assertNotFound();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/admin/hari-libur/abc')
            ->assertNotFound();
    }

    public function test_perubahan_langsung_terlihat_di_dashboard(): void
    {
        $token = $this->tokenAdmin();

        $id = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-10-21',
                'keterangan' => 'Libur Uji',
            ])
            ->assertCreated()
            ->json('id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('keterangan_libur', 'Libur Uji')
            ->assertJsonPath('ringkasan.belum_masuk', 0);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/admin/hari-libur/{$id}")
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('hari_kerja', true);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }
}
