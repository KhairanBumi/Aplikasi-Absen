<?php

namespace Tests\Feature;

use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PerangkatKiosk;
use App\Models\PercobaanMasuk;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PercobaanMasukTest extends TestCase
{
    use RefreshDatabase;

    private PerangkatKiosk $kiosk;

    private Lokasi $lokasi;

    private Shift $shift;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Cache::flush();
        Http::fake(['nominatim.openstreetmap.org/*' => Http::response([], 500)]);
        Carbon::setTestNow(Carbon::parse('2026-10-19 08:30:00', 'Asia/Jakarta'));

        $this->lokasi = Lokasi::create([
            'nama' => 'Kantor', 'alamat' => 'Jl. Uji', 'lintang' => -6.2,
            'bujur' => 106.8, 'radius_m' => 50, 'aktif' => true,
        ]);
        $this->shift = Shift::create([
            'nama' => 'Reguler', 'masuk' => '08:00', 'pulang' => '17:00',
            'toleransi_menit' => 15, 'aktif' => true,
        ]);
        $this->kiosk = PerangkatKiosk::create([
            'id' => 'kiosk-catatan', 'nama' => 'Kiosk Catatan',
            'lokasi_id' => $this->lokasi->id, 'aktif' => true, 'created_at' => now(),
        ]);

        Pengguna::create([
            'nama' => 'Siti', 'nip' => 'MGG201', 'pin_hash' => Hash::make('1357'),
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

    public function test_pin_salah_dicatat_tanpa_pin_mentah(): void
    {
        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG201',
            'pin' => '9999',
            'kiosk_id' => $this->kiosk->id,
            'foto' => $this->foto(),
        ])->assertStatus(401);

        $catatan = PercobaanMasuk::firstOrFail();

        $this->assertFalse($catatan->berhasil);
        $this->assertSame('kredensial_salah', $catatan->alasan);
        $this->assertSame('MGG201', $catatan->nip);
        $this->assertStringNotContainsString('9999', json_encode($catatan->toArray()));
    }

    public function test_pin_benar_dicatat_berhasil(): void
    {
        $this->postJson('/api/kiosk/absen', [
            'nip' => 'MGG201',
            'pin' => '1357',
            'kiosk_id' => $this->kiosk->id,
            'mode' => 'kantor',
            'foto' => $this->foto(),
        ])->assertOk();

        $catatan = PercobaanMasuk::firstOrFail();

        $this->assertTrue($catatan->berhasil);
        $this->assertNull($catatan->alasan);
    }

    private function foto(): string
    {
        return 'data:image/jpeg;base64,'.base64_encode(
            "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9"
        );
    }
}
