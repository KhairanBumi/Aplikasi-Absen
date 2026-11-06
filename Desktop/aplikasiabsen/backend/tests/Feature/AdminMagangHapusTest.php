<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PercobaanMasuk;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminMagangHapusTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    private Pengguna $magang;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 10:00:00', 'Asia/Jakarta'));
        Storage::fake('local');

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor Pusat',
            'lintang' => -6.2,
            'bujur' => 106.8,
            'radius_m' => 250,
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

        $this->magang = Pengguna::create([
            'nama' => 'Magang Uji',
            'nip' => 'MGG001',
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
            'foto_path' => 'profil/magang-uji.jpg',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_menghapus_akun_beserta_riwayat_dan_izin(): void
    {
        $fotoAbsen = 'absen/2026/10/29/uji.jpg';
        Storage::disk('local')->put($fotoAbsen, 'foto');
        Storage::disk('local')->put('profil/magang-uji.jpg', 'profil');

        Absen::create([
            'pengguna_id' => $this->magang->id,
            'tanggal' => '2026-10-28',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-28 08:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'foto_path' => $fotoAbsen,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);

        Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'izin',
            'mulai' => '2026-10-30',
            'selesai' => '2026-10-30',
            'alasan' => 'Keperluan keluarga.',
            'status' => 'menunggu',
            'diajukan_at' => now(),
        ]);

        $lain = Pengguna::create([
            'nama' => 'Magang Lain',
            'nip' => 'MGG002',
            'pin_hash' => Hash::make('9753'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);

        $izinLain = Izin::create([
            'pengguna_id' => $lain->id,
            'jenis' => 'cuti',
            'mulai' => '2026-11-02',
            'selesai' => '2026-11-02',
            'alasan' => 'Acara keluarga.',
            'status' => 'disetujui',
            'diajukan_at' => now(),
            'diputuskan_at' => now(),
            'diputuskan_oleh' => $this->magang->id,
        ]);

        Sesi::terbitkan($this->magang, '127.0.0.1', 'uji');
        PercobaanMasuk::create([
            'pengguna_id' => $this->magang->id,
            'nip' => $this->magang->nip,
            'kiosk_id' => 'kiosk-uji',
            'berhasil' => true,
        ]);
        Audit::create([
            'pengguna_id' => $this->magang->id,
            'aksi' => 'absen_masuk',
            'rincian' => [],
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/magang/{$this->magang->id}")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('pengguna', ['id' => $this->magang->id]);
        $this->assertDatabaseMissing('absen', ['pengguna_id' => $this->magang->id]);
        $this->assertDatabaseMissing('izin', ['pengguna_id' => $this->magang->id]);
        $this->assertDatabaseMissing('sesi', ['pengguna_id' => $this->magang->id]);

        Storage::disk('local')->assertMissing($fotoAbsen);
        Storage::disk('local')->assertMissing('profil/magang-uji.jpg');

        $this->assertDatabaseHas('izin', [
            'id' => $izinLain->id,
            'diputuskan_oleh' => null,
        ]);
        $this->assertDatabaseHas('audit', [
            'aksi' => 'absen_masuk',
            'pengguna_id' => null,
        ]);
        $this->assertDatabaseHas('percobaan_masuk', [
            'nip' => $this->magang->nip,
            'pengguna_id' => null,
        ]);
        $this->assertDatabaseHas('audit', [
            'aksi' => 'hapus_magang',
            'pengguna_id' => $this->admin->id,
        ]);
    }

    public function test_admin_tidak_bisa_menghapus_akun_sendiri(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/magang/{$this->admin->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Anda tidak bisa menghapus akun sendiri.');

        $this->assertDatabaseHas('pengguna', ['id' => $this->admin->id]);
    }

    public function test_magang_tidak_boleh_menghapus_akun(): void
    {
        $token = $this->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/admin/magang/{$this->admin->id}")
            ->assertStatus(403)
            ->assertJsonPath('kode', 'tidak_berhak');

        $this->assertDatabaseHas('pengguna', ['id' => $this->admin->id]);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }
}
