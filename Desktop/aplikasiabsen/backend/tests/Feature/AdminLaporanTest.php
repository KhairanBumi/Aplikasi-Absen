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

class AdminLaporanTest extends TestCase
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

        $this->admin = $this->buatPengguna('ADM001', 'Admin Uji', 'admin', '2026-01-05');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_laporan_bulanan_menghitung_absen_libur_luar_dan_pengguna_nonaktif(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $magangA = $this->buatPengguna('MGG001', 'Magang A', 'magang', '2026-01-05');
        $magangB = $this->buatPengguna('MGG002', 'Magang B', 'magang', '2026-10-15');
        $nonaktif = $this->buatPengguna('MGG003', 'Magang Nonaktif', 'magang', '2026-01-05', false);
        $this->buatPengguna('MGG004', 'Magang Nonaktif Tanpa Absen', 'magang', '2026-01-05', false);
        $adminAbsen = $this->buatPengguna('ADM002', 'Admin Absen', 'admin', '2026-01-05');

        $this->absen($magangA, '2026-10-01', 'masuk', '2026-10-01 08:43:00', ['telat_menit' => 28]);
        $this->absen($magangA, '2026-10-01', 'pulang', '2026-10-01 17:05:00');
        $this->absen($magangA, '2026-10-02', 'masuk', '2026-10-02 08:00:00', [
            'mode' => 'luar',
            'lintang' => -6.9,
            'bujur' => 107.6,
            'akurasi' => 80,
            'jarak_m' => 1234,
            'lokasi_meragukan' => true,
            'lokasi_teks' => 'Jl. Luar No. 2',
        ]);
        $this->absen($nonaktif, '2026-10-05', 'masuk', '2026-10-05 07:55:00');
        $this->absen($adminAbsen, '2026-10-06', 'masuk', '2026-10-06 07:55:00');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/laporan?bulan=2026-10')
            ->assertOk()
            ->assertJsonPath('bulan', '2026-10')
            ->assertJsonPath('hari_kerja', 14)
            ->assertJsonPath('ringkasan.magang', 4)
            ->assertJsonPath('ringkasan.hadir', 4)
            ->assertJsonPath('ringkasan.telat', 1)
            ->assertJsonPath('ringkasan.telat_menit', 28)
            ->assertJsonPath('ringkasan.izin', 0)
            ->assertJsonPath('ringkasan.alpha', 38)
            ->assertJsonCount(4, 'data');

        $this->assertSame(
            ['Admin Absen', 'Magang A', 'Magang B', 'Magang Nonaktif'],
            array_column($res->json('data'), 'nama')
        );

        $baris = collect($res->json('data'))->keyBy('pengguna_id');

        $this->assertSame(14, $baris[$magangA->id]['hari_kerja']);
        $this->assertSame(2, $baris[$magangA->id]['hadir']);
        $this->assertSame(1, $baris[$magangA->id]['telat']);
        $this->assertSame(28, $baris[$magangA->id]['telat_menit']);
        $this->assertSame(1, $baris[$magangA->id]['luar']);
        $this->assertSame(1, $baris[$magangA->id]['luar_kasar']);
        $this->assertSame('Reguler', $baris[$magangA->id]['shift']);

        $this->assertSame(4, $baris[$magangB->id]['hari_kerja']);
        $this->assertSame(3, $baris[$magangB->id]['alpha']);

        $this->assertFalse($baris[$nonaktif->id]['aktif']);
        $this->assertSame(1, $baris[$nonaktif->id]['hadir']);
    }

    public function test_rincian_harian_memuat_seluruh_hari_dan_status_yang_benar(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $magang = $this->buatPengguna('MGG010', 'Magang Harian', 'magang', '2026-01-05');

        $this->absen($magang, '2026-10-01', 'masuk', '2026-10-01 08:43:00', ['telat_menit' => 28]);
        $this->absen($magang, '2026-10-01', 'pulang', '2026-10-01 17:05:00');
        $this->absen($magang, '2026-10-02', 'masuk', '2026-10-02 08:00:00', [
            'mode' => 'luar',
            'lintang' => -6.9,
            'bujur' => 107.6,
            'akurasi' => 80,
            'jarak_m' => 1234,
            'lokasi_meragukan' => true,
            'lokasi_teks' => 'Jl. Luar No. 2',
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/laporan/harian?bulan=2026-10&pengguna_id='.$magang->id)
            ->assertOk()
            ->assertJsonPath('bulan', '2026-10')
            ->assertJsonPath('pengguna.id', $magang->id)
            ->assertJsonMissingPath('pengguna.pin_hash')
            ->assertJsonCount(31, 'data')
            ->assertJsonStructure([
                'data' => [[
                    'tanggal', 'keterangan_libur', 'masuk', 'pulang', 'telat_menit',
                    'status', 'keterangan_izin', 'alasan_izin', 'lokasi', 'lokasi_kantor',
                    'foto', 'mode', 'lintang', 'bujur', 'akurasi', 'jarak_m',
                    'lokasi_meragukan', 'lokasi_teks',
                ]],
            ]);

        $hari = collect($res->json('data'))->keyBy('tanggal');

        $this->assertSame('telat', $hari['2026-10-01']['status']);
        $this->assertSame(28, $hari['2026-10-01']['telat_menit']);
        $this->assertSame('Kantor Pusat', $hari['2026-10-01']['lokasi']);
        $this->assertNotNull($hari['2026-10-01']['masuk']);
        $this->assertNotNull($hari['2026-10-01']['pulang']);

        $this->assertSame('tepat', $hari['2026-10-02']['status']);
        $this->assertSame('luar', $hari['2026-10-02']['mode']);
        $this->assertSame('Dinas luar', $hari['2026-10-02']['lokasi']);
        $this->assertSame('Kantor Pusat', $hari['2026-10-02']['lokasi_kantor']);
        $this->assertSame(1234, $hari['2026-10-02']['jarak_m']);
        $this->assertSame(80, $hari['2026-10-02']['akurasi']);
        $this->assertTrue($hari['2026-10-02']['lokasi_meragukan']);

        $this->assertSame('libur', $hari['2026-10-04']['status']);
        $this->assertSame('Hari Minggu', $hari['2026-10-04']['keterangan_libur']);
        $this->assertSame('libur', $hari['2026-10-20']['status']);
        $this->assertSame('Libur Uji', $hari['2026-10-20']['keterangan_libur']);
        $this->assertSame('belum', $hari['2026-10-21']['status']);
        $this->assertSame('kantor', $hari['2026-10-21']['mode']);
        $this->assertNull($hari['2026-10-21']['masuk']);
    }

    public function test_bulan_dan_pengguna_id_divalidasi(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/laporan?bulan=2026-13')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'bulan_tidak_valid');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/laporan/harian?bulan=2026-10')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'pengguna_id_tidak_valid');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/laporan/harian?bulan=2026-10&pengguna_id=999')
            ->assertStatus(404);
    }

    private function buatPengguna(
        string $nip,
        string $nama,
        string $peran,
        string $masukKerja,
        bool $aktif = true
    ): Pengguna {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'nik' => null,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => $masukKerja,
            'cuti_kuota' => 12,
            'aktif' => $aktif,
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

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
