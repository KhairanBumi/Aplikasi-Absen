<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PerangkatKiosk;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class KioskIdempotenTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private PerangkatKiosk $kiosk;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Cache::flush();

        Http::fake([
            'nominatim.openstreetmap.org/*' => Http::response([
                'display_name' => 'Jl. Uji No. 1, Jakarta',
                'address' => ['road' => 'Jl. Uji', 'house_number' => '1', 'city' => 'Jakarta Pusat'],
            ]),
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-19 08:43:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor Pusat',
            'alamat' => 'Jl. Uji No. 1',
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

        $this->kiosk = PerangkatKiosk::create([
            'id' => 'kiosk-idempoten',
            'nama' => 'Kiosk Idempoten',
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

    public function test_kunci_sama_mengembalikan_hasil_pertama_tanpa_baris_baru(): void
    {
        $magang = $this->buatPengguna('MGG101');

        $payload = [
            'nip' => 'MGG101',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
            'kunci_idempoten' => 'uji-idempoten-0001',
        ];

        $pertama = $this->postJson('/api/kiosk/absen', $payload)
            ->assertOk()
            ->assertJsonPath('idempoten', false)
            ->assertJsonPath('tipe', 'masuk');

        $kedua = $this->postJson('/api/kiosk/absen', $payload)
            ->assertOk()
            ->assertJsonPath('idempoten', true)
            ->assertJsonPath('tipe', 'masuk')
            ->assertJsonPath('id', $pertama->json('id'));

        $this->assertSame(1, Absen::count());
        $this->assertCount(1, Storage::disk('local')->allFiles('absen'));
        $this->assertSame($magang->id, Absen::firstOrFail()->pengguna_id);
    }

    public function test_kunci_sama_untuk_nip_lain_ditolak_tanpa_membocorkan_data(): void
    {
        $this->buatPengguna('MGG102');
        $this->buatPengguna('MGG103');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG102',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
            'kunci_idempoten' => 'uji-idempoten-0002',
        ])->assertOk();

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG103',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
            'kunci_idempoten' => 'uji-idempoten-0002',
        ])->assertStatus(409)
            ->assertJsonPath('kode', 'kunci_bentrok')
            ->assertJsonMissingPath('nama');

        $this->assertSame(1, Absen::count());
    }

    public function test_tanpa_kunci_tetap_bisa_absen(): void
    {
        $this->buatPengguna('MGG104');

        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG104',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ])->assertOk()
            ->assertJsonPath('idempoten', false);

        $this->assertSame(1, Absen::count());
    }

    private function buatPengguna(string $nip): Pengguna
    {
        return Pengguna::create([
            'nama' => 'Magang '.$nip,
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-01',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    private function foto(): string
    {
        return 'data:image/jpeg;base64,'.base64_encode(
            "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9"
        );
    }
}
