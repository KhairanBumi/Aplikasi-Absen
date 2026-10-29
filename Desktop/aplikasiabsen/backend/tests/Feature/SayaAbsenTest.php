<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SayaAbsenTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $magang;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-21 12:00:00', 'Asia/Jakarta'));

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

        $this->magang = $this->buatPengguna('MGG001', 'Magang Uji', '2026-10-15');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_riwayat_memuat_seluruh_hari_dan_hari_kerja_sejak_masuk(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $this->absen($this->magang, '2026-10-15', 'masuk', '2026-10-15 08:20:00', ['telat_menit' => 5]);
        $this->absen($this->magang, '2026-10-15', 'pulang', '2026-10-15 17:02:00');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk()
            ->assertJsonPath('bulan', '2026-10')
            ->assertJsonPath('hari_kerja', 4)
            ->assertJsonCount(31, 'data')
            ->assertJsonStructure([
                'bulan',
                'hari_kerja',
                'ringkasan' => ['hadir', 'tepat', 'telat', 'telat_menit', 'izin', 'alpha'],
                'data' => [[
                    'tanggal', 'keterangan_libur', 'masuk', 'pulang', 'telat_menit',
                    'status', 'keterangan_izin', 'alasan_izin', 'lokasi', 'lokasi_kantor',
                    'foto', 'mode', 'lintang', 'bujur', 'akurasi', 'jarak_m',
                    'lokasi_meragukan', 'lokasi_teks',
                ]],
            ]);

        $this->assertSame(['bulan', 'hari_kerja', 'ringkasan', 'data'], array_keys($res->json()));
        $this->assertSame([
            'hadir' => 1,
            'tepat' => 0,
            'telat' => 1,
            'telat_menit' => 5,
            'izin' => 0,
            'alpha' => 2,
        ], $res->json('ringkasan'));

        $tanggal = array_column($res->json('data'), 'tanggal');
        $urut = $tanggal;
        sort($urut);
        $this->assertSame($urut, $tanggal);
        $this->assertSame('2026-10-01', $tanggal[0]);
        $this->assertSame('2026-10-31', $tanggal[30]);
        $this->assertCount(31, array_unique($tanggal));

        $hari = collect($res->json('data'))->keyBy('tanggal');

        $this->assertSame('libur', $hari['2026-10-01']['status']);
        $this->assertSame('Belum masuk kerja', $hari['2026-10-01']['keterangan_libur']);
        $this->assertSame('Hari Sabtu', $hari['2026-10-03']['keterangan_libur']);
        $this->assertSame('Hari Minggu', $hari['2026-10-04']['keterangan_libur']);
        $this->assertSame('Libur Uji', $hari['2026-10-20']['keterangan_libur']);
        $this->assertSame('telat', $hari['2026-10-15']['status']);
        $this->assertSame(5, $hari['2026-10-15']['telat_menit']);
        $this->assertSame('2026-10-15T08:20:00+07:00', $hari['2026-10-15']['masuk']);
        $this->assertSame('2026-10-15T17:02:00+07:00', $hari['2026-10-15']['pulang']);
        $this->assertSame('belum', $hari['2026-10-21']['status']);
        $this->assertSame('kantor', $hari['2026-10-21']['mode']);
        $this->assertNull($hari['2026-10-21']['masuk']);
    }

    public function test_bulan_tidak_sah_dan_token_wajib(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang));

        foreach (['2026-13', '2026-1', '2026-00', 'bukan-bulan', ''] as $bulan) {
            $this->getJson('/api/saya/absen?bulan='.$bulan)
                ->assertStatus(422)
                ->assertExactJson([
                    'message' => 'Bulan harus berbentuk YYYY-MM.',
                    'kode' => 'bulan_tidak_valid',
                ]);
        }

        $this->flushHeaders()
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');
    }

    public function test_bulan_berbentuk_array_ditolak(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan[]=2026-10')
            ->assertStatus(422)
            ->assertExactJson([
                'message' => 'Bulan harus berbentuk YYYY-MM.',
                'kode' => 'bulan_tidak_valid',
            ]);
    }

    public function test_tanpa_token_ditolak_sebelum_memproses_bulan(): void
    {
        foreach (['/api/saya/absen', '/api/saya/absen?bulan=2026-13'] as $url) {
            $this->getJson($url)
                ->assertStatus(401)
                ->assertJsonPath('kode', 'sesi_habis');
        }
    }

    public function test_bulan_opsional_memakai_bulan_berjalan(): void
    {
        $this->absen($this->magang, '2026-10-15', 'masuk', '2026-10-15 08:00:00');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan=2026-09')
            ->assertOk()
            ->assertJsonPath('bulan', '2026-09')
            ->assertJsonPath('hari_kerja', 0)
            ->assertJsonPath('ringkasan.hadir', 0)
            ->assertJsonCount(30, 'data');

        $this->getJson('/api/saya/absen')
            ->assertOk()
            ->assertJsonPath('bulan', '2026-10')
            ->assertJsonPath('hari_kerja', 5)
            ->assertJsonPath('ringkasan.hadir', 1)
            ->assertJsonCount(31, 'data');
    }

    public function test_riwayat_hanya_memuat_absen_pemilik_token(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', '2026-10-01');
        $this->absen($this->magang, '2026-10-15', 'masuk', '2026-10-15 08:20:00', ['telat_menit' => 5]);
        $this->absen($lain, '2026-10-15', 'masuk', '2026-10-15 08:00:00');
        $this->absen($lain, '2026-10-16', 'masuk', '2026-10-16 08:00:00');
        $this->absen($lain, '2026-10-16', 'pulang', '2026-10-16 17:00:00');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan=2026-10&pengguna_id='.$lain->id)
            ->assertOk()
            ->assertJsonPath('hari_kerja', 5)
            ->assertJsonPath('ringkasan.hadir', 1)
            ->assertJsonPath('ringkasan.telat', 1)
            ->assertJsonPath('ringkasan.telat_menit', 5);

        $hari = collect($res->json('data'))->keyBy('tanggal');
        $this->assertSame('2026-10-15T08:20:00+07:00', $hari['2026-10-15']['masuk']);
        $this->assertSame('alpha', $hari['2026-10-16']['status']);
        $this->assertNull($hari['2026-10-16']['masuk']);
        $this->assertNull($hari['2026-10-16']['pulang']);

        $this->flushHeaders()
            ->withHeader('Authorization', 'Bearer '.$this->token($lain))
            ->getJson('/api/saya/absen?bulan=2026-10&pengguna_id='.$this->magang->id)
            ->assertOk()
            ->assertJsonPath('hari_kerja', 15)
            ->assertJsonPath('ringkasan.hadir', 2)
            ->assertJsonPath('ringkasan.tepat', 2)
            ->assertJsonPath('ringkasan.telat_menit', 0);
    }

    private function buatPengguna(string $nip, string $nama, string $masukKerja): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'nik' => null,
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => $masukKerja,
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    private function absen(Pengguna $pengguna, string $tanggal, string $tipe, string $waktu, array $atribut = []): Absen
    {
        return Absen::create(array_merge([
            'pengguna_id' => $pengguna->id,
            'tanggal' => $tanggal,
            'tipe' => $tipe,
            'waktu' => Carbon::parse($waktu, 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $pengguna->nama,
            'nip_salinan' => $pengguna->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ], $atribut));
    }

    private function token(Pengguna $pengguna): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $pengguna->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
