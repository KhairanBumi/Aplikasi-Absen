<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminShiftTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $reguler;

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

        $this->reguler = Shift::create([
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
            'shift_id' => $this->reguler->id,
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

    public function test_admin_membuat_shift_malam_tanpa_menolak_pulang_lebih_kecil(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson('/api/admin/shift', [
                'nama' => '  Shift Malam  ',
                'masuk' => '22:00',
                'pulang' => '06:00',
                'toleransi_menit' => '10',
                'aktif' => 'true',
            ])
            ->assertCreated()
            ->assertJsonPath('nama', 'Shift Malam')
            ->assertJsonPath('masuk', '22:00')
            ->assertJsonPath('pulang', '06:00')
            ->assertJsonPath('toleransi_menit', 10)
            ->assertJsonPath('aktif', true)
            ->assertJsonPath('jumlah_magang', 0);

        $this->assertDatabaseHas('shift', ['nama' => 'Shift Malam', 'pulang' => '06:00']);
        $this->assertDatabaseHas('audit', ['aksi' => 'tambah_shift']);
    }

    public function test_nama_kembar_dan_validasi_jam(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/shift', [
                'nama' => 'reguler',
                'masuk' => '08:00',
                'pulang' => '17:00',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'nama_dipakai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/shift', [
                'nama' => 'Sore',
                'masuk' => '25:00',
                'pulang' => '17:00',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('masuk');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/shift', [
                'nama' => 'Sore',
                'masuk' => '08:00',
                'pulang' => '17:00',
                'toleransi_menit' => 121,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('toleransi_menit');
    }

    public function test_put_parsial_tidak_menyentuh_jam_lain(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->putJson("/api/admin/shift/{$this->reguler->id}", [
                'nama' => 'Reguler Baru',
            ])
            ->assertOk()
            ->assertJsonPath('nama', 'Reguler Baru')
            ->assertJsonPath('masuk', '08:00')
            ->assertJsonPath('pulang', '17:00')
            ->assertJsonPath('toleransi_menit', 15);

        $this->assertDatabaseHas('audit', ['aksi' => 'ubah_shift']);
    }

    public function test_id_shift_non_angka_ditolak_404(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/shift/abc', ['nama' => 'Salah'])
            ->assertNotFound();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/admin/shift/abc')
            ->assertNotFound();
    }

    public function test_shift_terakhir_tidak_bisa_dihapus(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$this->reguler->id}")
            ->assertStatus(409)
            ->assertJsonPath('kode', 'shift_terakhir')
            ->assertJsonPath(
                'message',
                'Ini satu-satunya shift. Tanpa shift, tidak ada yang bisa dipilih saat menambah anak magang.'
            );
    }

    public function test_shift_yang_dipakai_pengguna_tidak_bisa_dihapus(): void
    {
        Shift::create([
            'nama' => 'Sore',
            'masuk' => '13:00',
            'pulang' => '21:00',
            'toleransi_menit' => 10,
            'aktif' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$this->reguler->id}")
            ->assertStatus(409)
            ->assertJsonPath('kode', 'shift_dipakai_pengguna')
            ->assertJsonPath(
                'message',
                'Shift ini masih dipakai 1 orang. Pindahkan mereka ke shift lain dulu, atau nonaktifkan shift ini.'
            );
    }

    public function test_shift_yang_dipakai_absen_tidak_bisa_dihapus(): void
    {
        $sore = Shift::create([
            'nama' => 'Sore',
            'masuk' => '13:00',
            'pulang' => '21:00',
            'toleransi_menit' => 10,
            'aktif' => true,
        ]);

        $this->admin->update(['shift_id' => $sore->id]);

        Absen::create([
            'pengguna_id' => $this->admin->id,
            'tanggal' => '2026-10-20',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-20 13:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->reguler->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->admin->nama,
            'nip_salinan' => $this->admin->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$this->reguler->id}")
            ->assertStatus(409)
            ->assertJsonPath('kode', 'shift_dipakai_absen')
            ->assertJsonPath(
                'message',
                'Shift ini dipakai 1 catatan absen. Menghapusnya membuat riwayat itu kehilangan jam kerjanya — nonaktifkan saja.'
            );
    }

    public function test_shift_tanpa_referensi_bisa_dihapus(): void
    {
        $sore = Shift::create([
            'nama' => 'Sore',
            'masuk' => '13:00',
            'pulang' => '21:00',
            'toleransi_menit' => 10,
            'aktif' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$sore->id}")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('shift', ['id' => $sore->id]);
        $this->assertDatabaseHas('audit', ['aksi' => 'hapus_shift']);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }
}
