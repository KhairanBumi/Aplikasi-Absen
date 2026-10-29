<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PercobaanMasuk;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAnomaliTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $admin;

    private Pengguna $magang;

    private Lokasi $lokasi;

    private Shift $shift;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-07 12:00:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $this->shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);
        $this->admin = $this->buatPengguna('ADM301', 'admin');
        $this->magang = $this->buatPengguna('MGG301', 'magang');
        $this->token = $this->tokenUntuk($this->admin);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_menandai_pin_salah_berulang(): void
    {
        for ($i = 0; $i < 5; $i++) {
            PercobaanMasuk::create([
                'pengguna_id' => $this->magang->id,
                'nip' => 'MGG301',
                'kiosk_id' => 'kiosk-uji',
                'ip' => '10.0.0.1',
                'berhasil' => false,
                'alasan' => 'kredensial_salah',
                'created_at' => now()->subMinutes($i),
            ]);
        }

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-10-07&sampai=2026-10-07')
            ->assertOk()
            ->assertJsonFragment([
                'jenis' => 'pin_salah_berulang',
                'tingkat' => 'tinggi',
                'nama' => 'Orang MGG301',
            ]);
    }

    public function test_pin_salah_tersebar_lebih_dari_sepuluh_menit_tidak_ditandai(): void
    {
        for ($i = 0; $i < 5; $i++) {
            PercobaanMasuk::create([
                'pengguna_id' => $this->magang->id,
                'nip' => 'MGG301',
                'kiosk_id' => 'kiosk-uji',
                'ip' => '10.0.0.1',
                'berhasil' => false,
                'alasan' => 'kredensial_salah',
                'created_at' => now()->subMinutes($i * 5),
            ]);
        }

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-10-07&sampai=2026-10-07')
            ->assertOk()
            ->assertJsonMissing(['jenis' => 'pin_salah_berulang']);
    }

    public function test_menandai_lokasi_kasar_dan_perpindahan_mustahil(): void
    {
        Absen::create($this->absen([
            'waktu' => now()->subMinutes(10),
            'mode' => 'luar',
            'lintang' => -6.2,
            'bujur' => 106.8,
            'akurasi' => 80,
            'lokasi_meragukan' => true,
            'jarak_m' => 400,
        ]));

        Absen::create($this->absen([
            'tipe' => 'pulang',
            'waktu' => now()->subMinutes(5),
            'mode' => 'luar',
            'lintang' => -7.2575,
            'bujur' => 112.7521,
            'akurasi' => 20,
            'lokasi_meragukan' => false,
            'jarak_m' => 700000,
        ]));

        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-10-07&sampai=2026-10-07')
            ->assertOk()
            ->assertJsonFragment(['jenis' => 'lokasi_meragukan'])
            ->assertJsonFragment(['jenis' => 'perpindahan_mustahil'])
            ->assertJsonFragment(['jenis' => 'jarak_jauh']);
    }

    public function test_rentang_lebih_dari_31_hari_ditolak(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token)
            ->getJson('/api/admin/anomali?dari=2026-01-01&sampai=2026-03-01')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_terlalu_lama');
    }

    private function buatPengguna(string $nip, string $peran): Pengguna
    {
        return Pengguna::create([
            'nama' => 'Orang '.$nip, 'nip' => $nip, 'pin_hash' => Hash::make('1357'),
            'peran' => $peran, 'divisi' => 'Pendataan', 'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id, 'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12, 'aktif' => true,
        ]);
    }

    private function tokenUntuk(Pengguna $pengguna): string
    {
        $token = bin2hex(random_bytes(32));
        Sesi::create([
            'pengguna_id' => $pengguna->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHours(12),
            'last_used_at' => now(),
            'created_at' => now(),
        ]);

        return $token;
    }

    private function absen(array $ubah): array
    {
        return array_merge([
            'pengguna_id' => $this->magang->id,
            'tanggal' => now()->toDateString(),
            'tipe' => 'masuk',
            'waktu' => now(),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'foto_path' => 'absen/uji.jpg',
            'kiosk_id' => 'kiosk-uji',
            'ip' => '10.0.0.1',
            'created_at' => now(),
        ], $ubah);
    }
}
