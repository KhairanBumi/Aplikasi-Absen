<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PerangkatKiosk;
use App\Models\Sesi;
use App\Models\Shift;
use App\Support\Foto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Fase1Test extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    private PerangkatKiosk $kiosk;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Cache::flush();

        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                'display_name' => 'Jl. Uji No. 1, Jakarta',
                'address' => [
                    'road' => 'Jl. Uji',
                    'house_number' => '1',
                    'village' => 'Gambir',
                    'city' => 'Jakarta Pusat',
                ],
            ]),
        ]);

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

        $this->admin = $this->buatPengguna('ADM001', '2468', 'admin');

        $this->kiosk = PerangkatKiosk::create([
            'id' => 'kiosk-kantor-pusat',
            'nama' => 'Kiosk Kantor Pusat',
            'lokasi_id' => $this->lokasi->id,
            'aktif' => true,
            'created_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_masuk_profil_dan_keluar(): void
    {
        $masuk = $this->postJson('/api/masuk', [
            'nip' => 'adm001',
            'pin' => '2468',
        ]);

        $masuk->assertOk()
            ->assertJsonPath('pengguna.nip', 'ADM001')
            ->assertJsonPath('pengguna.peran', 'admin');

        $this->assertNotEmpty($masuk->json('token'));
        $this->assertArrayNotHasKey('pin', $masuk->json('pengguna'));
        $this->assertArrayNotHasKey('pin_hash', $masuk->json('pengguna'));

        $token = $masuk->json('token');
        $sesi = Sesi::firstOrFail();

        $this->assertNotSame($token, $sesi->token_hash);
        $this->assertSame(hash('sha256', $token), $sesi->token_hash);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/saya/profil')
            ->assertOk()
            ->assertJsonPath('nip', 'ADM001')
            ->assertJsonPath('email', 'adm001@kantor.id')
            ->assertJsonMissingPath('pin_hash');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/keluar')
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/saya/profil')
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');
    }

    public function test_login_salah_dan_rate_limit_percobaan_kelima(): void
    {
        $this->buatPengguna('MGG001', '1357');

        for ($i = 1; $i <= 4; $i++) {
            $this->postJson('/api/masuk', [
                'nip' => 'MGG001',
                'pin' => '0000',
            ])->assertStatus(401)
                ->assertJsonPath('kode', 'kredensial_salah')
                ->assertJsonPath('message', 'NIP atau PIN salah.');
        }

        $this->postJson('/api/masuk', [
            'nip' => 'MGG001',
            'pin' => '0000',
        ])->assertStatus(429)
            ->assertJsonPath('kode', 'terlalu_banyak');

        $this->postJson('/api/masuk', [
            'nip' => 'MGG001',
            'pin' => '1357',
        ])->assertStatus(429);
    }

    public function test_admin_membuat_dan_mengubah_magang(): void
    {
        $token = $this->tokenAdmin();

        $buat = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/magang', [
                'nama' => 'Magang Satu',
                'nip' => 'mgg001',
                'email' => 'MGG001@KANTOR.ID',
                'nik' => '3171234567890001',
                'divisi' => 'Pendataan',
                'peran' => 'magang',
                'shift_id' => $this->shift->id,
                'lokasi_id' => $this->lokasi->id,
                'masuk_kerja' => '2026-01-05',
                'cuti_kuota' => 10,
                'pin' => '1357',
                'aktif' => true,
            ]);

        $buat->assertCreated()
            ->assertJsonPath('nip', 'MGG001')
            ->assertJsonPath('email', 'mgg001@kantor.id')
            ->assertJsonPath('shift', 'Reguler')
            ->assertJsonPath('lokasi', 'Kantor Pusat')
            ->assertJsonPath('cuti_kuota', 10);

        $this->assertArrayNotHasKey('pin', $buat->json());
        $this->assertArrayNotHasKey('pin_hash', $buat->json());

        $id = $buat->json('id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/magang')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('divisi', ['Pendataan', 'Perhitungan', 'Management Data']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/lokasi')
            ->assertOk()
            ->assertJsonPath('data.0.jumlah_magang', 1)
            ->assertJsonPath('data.0.lintang', -6.2246);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/shift')
            ->assertOk()
            ->assertJsonPath('data.0.masuk', '08:00')
            ->assertJsonPath('data.0.pulang', '17:00')
            ->assertJsonPath('data.0.jumlah_magang', 1);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/magang', [
                'nama' => 'NIP Kembar',
                'nip' => 'MGG001',
                'divisi' => 'Pendataan',
                'shift_id' => $this->shift->id,
                'lokasi_id' => $this->lokasi->id,
                'masuk_kerja' => '2026-01-05',
                'pin' => '8642',
            ])->assertStatus(409)
            ->assertJsonPath('kode', 'nip_dipakai')
            ->assertJsonPath('message', 'NIP MGG001 sudah dipakai magang lain.');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/magang', [
                'nama' => 'Email Kembar',
                'nip' => 'MGG004',
                'email' => 'mgg001@kantor.id',
                'divisi' => 'Pendataan',
                'shift_id' => $this->shift->id,
                'lokasi_id' => $this->lokasi->id,
                'masuk_kerja' => '2026-01-05',
                'pin' => '9753',
            ])->assertStatus(409)
            ->assertJsonPath('kode', 'email_dipakai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/magang', [
                'nama' => 'PIN Kembar',
                'nip' => 'MGG002',
                'divisi' => 'Pendataan',
                'shift_id' => $this->shift->id,
                'lokasi_id' => $this->lokasi->id,
                'masuk_kerja' => '2026-01-05',
                'pin' => '1357',
            ])->assertStatus(409)
            ->assertJsonPath('kode', 'pin_dipakai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/magang', [
                'nama' => 'NIK Salah',
                'nip' => 'MGG003',
                'nik' => '123',
                'divisi' => 'Pendataan',
                'shift_id' => $this->shift->id,
                'lokasi_id' => $this->lokasi->id,
                'masuk_kerja' => '2026-01-05',
                'pin' => '9753',
            ])->assertStatus(422);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/magang/'.$id, [
                'nama' => 'Magang Satu Diubah',
                'aktif' => false,
            ])->assertOk()
            ->assertJsonPath('nama', 'Magang Satu Diubah')
            ->assertJsonPath('aktif', false);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/magang/'.$this->admin->id, ['peran' => 'magang'])
            ->assertStatus(422);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/magang/'.$this->admin->id, ['aktif' => false])
            ->assertStatus(422);
    }

    public function test_kiosk_menolak_perangkat_asing_dan_mencatat_masuk_pulang(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-19 08:43:00', 'Asia/Jakarta'));

        $magang = $this->buatPengguna('MGG010', '1357');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG010',
            'pin' => '1357',
            'kiosk_id' => 'kiosk-asing',
            'lokasi_id' => $this->lokasi->id,
            'foto' => $this->foto(),
        ])->assertStatus(403)
            ->assertJsonPath('kode', 'tidak_berhak');

        $masuk = $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG010',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ]);

        $masuk->assertOk()
            ->assertJsonPath('tipe', 'masuk')
            ->assertJsonPath('nama', $magang->nama)
            ->assertJsonPath('lokasi_id', $this->lokasi->id)
            ->assertJsonPath('mode', 'kantor');

        $absenMasuk = Absen::where('tipe', 'masuk')->firstOrFail();

        $this->assertSame(28, $absenMasuk->telat_menit);
        $this->assertStringStartsWith('absen/', $absenMasuk->foto_path);
        Storage::disk('local')->assertExists($absenMasuk->foto_path);
        $this->assertNotSame('1357', $magang->fresh()->pin_hash);

        $pulang = $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG010',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ]);

        $pulang->assertOk()->assertJsonPath('tipe', 'pulang');

        $this->assertSame(0, Absen::where('tipe', 'pulang')->firstOrFail()->telat_menit);

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG010',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ])->assertStatus(409)
            ->assertJsonPath('kode', 'sudah_absen');

        $url = Foto::url($absenMasuk->foto_path);
        $this->assertNotNull($url);
        $this->get($url)->assertOk();

        $this->get('/storage/'.$absenMasuk->foto_path)->assertNotFound();
    }

    public function test_kiosk_validasi_foto_dan_mode_luar(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-19 09:00:00', 'Asia/Jakarta'));

        $this->buatPengguna('MGG020', '1357');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG020',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'foto' => 'bukan-foto',
        ])->assertStatus(422)
            ->assertJsonPath('kode', 'foto_tidak_valid');

        $this->assertDatabaseCount('absen', 0);

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG020',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'luar',
            'foto' => $this->foto(),
        ])->assertStatus(422)
            ->assertJsonPath('kode', 'koordinat_tidak_lengkap');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG020',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'luar',
            'lintang' => -6.9,
            'bujur' => 107.6,
            'akurasi' => 151,
            'foto' => $this->foto(),
        ])->assertStatus(422)
            ->assertJsonPath('kode', 'akurasi_terlalu_kasar');

        $jauh = $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG020',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'luar',
            'lintang' => -6.9,
            'bujur' => 107.6,
            'akurasi' => 150,
            'foto' => $this->foto(),
        ]);

        $jauh->assertOk()
            ->assertJsonPath('mode', 'luar')
            ->assertJsonPath('akurasi', 150)
            ->assertJsonPath('lokasi_meragukan', true)
            ->assertJsonPath('lokasi_teks', 'Jl. Uji 1, Gambir, Jakarta Pusat');

        $this->assertGreaterThan(50_000, $jauh->json('jarak_m'));

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG020',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => 999,
            'foto' => $this->foto(),
        ])->assertStatus(403)
            ->assertJsonPath('kode', 'tidak_berhak');
    }

    public function test_dashboard_menghitung_hari_kerja_dan_libur(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-19 09:00:00', 'Asia/Jakarta'));

        $masuk = $this->buatPengguna('MGG030', '1357');
        $belum = $this->buatPengguna('MGG031', '8642');

        Absen::create([
            'pengguna_id' => $masuk->id,
            'tanggal' => '2026-10-19',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-19 08:43:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 28,
            'nama_salinan' => $masuk->nama,
            'nip_salinan' => $masuk->nip,
            'kiosk_id' => $this->kiosk->id,
            'created_at' => now(),
        ]);

        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-19')
            ->assertOk()
            ->assertJsonPath('tanggal', '2026-10-19')
            ->assertJsonPath('hari_kerja', true)
            ->assertJsonPath('ringkasan.total', 2)
            ->assertJsonPath('ringkasan.sudah_masuk', 1)
            ->assertJsonPath('ringkasan.belum_masuk', 1)
            ->assertJsonPath('ringkasan.izin', 0)
            ->assertJsonPath('ringkasan.telat', 1)
            ->assertJsonCount(1, 'terlambat')
            ->assertJsonPath('terlambat.0.nama', $masuk->nama)
            ->assertJsonPath('terlambat.0.telat_menit', 28)
            ->assertJsonCount(1, 'belum_masuk')
            ->assertJsonPath('belum_masuk.0.nama', $belum->nama)
            ->assertJsonCount(1, 'aktivitas')
            ->assertJsonPath('aktivitas.0.lokasi', 'Kantor Pusat');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-24')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('keterangan_libur', 'Hari Sabtu')
            ->assertJsonPath('ringkasan.total', 0)
            ->assertJsonCount(0, 'belum_masuk');

        HariLibur::create(['tanggal' => '2026-10-19', 'keterangan' => 'Libur Uji']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-19')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('keterangan_libur', 'Libur Uji')
            ->assertJsonCount(0, 'belum_masuk');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-02-31')
            ->assertStatus(422);
    }

    private function buatPengguna(string $nip, string $pin, string $peran = 'magang'): Pengguna
    {
        return Pengguna::create([
            'nama' => 'Nama '.$nip,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'nik' => null,
            'pin_hash' => Hash::make($pin),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }

    private function foto(): string
    {
        return 'data:image/jpeg;base64,'.base64_encode(
            "\xFF\xD8\xFF\xE0".str_repeat("\0", 128)
        );
    }
}
