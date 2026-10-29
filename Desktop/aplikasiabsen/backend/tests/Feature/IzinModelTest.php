<?php

namespace Tests\Feature;

use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use App\Support\Harian;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class IzinModelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-21 12:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_serializer_izin_memakai_bentuk_kontrak(): void
    {
        $pengguna = $this->buatPengguna();

        $izin = Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-23',
            'selesai' => '2026-10-26',
            'alasan' => 'Keperluan keluarga',
            'status' => 'menunggu',
            'diajukan_at' => now(),
        ])->load('pengguna');

        $hasil = $izin->apiArray();

        $this->assertSame([
            'id', 'pengguna_id', 'nama', 'nip', 'divisi', 'jenis', 'mulai', 'selesai',
            'hari_kerja', 'alasan', 'status', 'diajukan', 'catatan_admin', 'diputuskan',
        ], array_keys($hasil));

        $this->assertSame([
            'id' => $izin->id,
            'pengguna_id' => $pengguna->id,
            'nama' => 'Nurul Hidayah',
            'nip' => 'MGG009',
            'divisi' => 'Perhitungan',
            'jenis' => 'cuti',
            'mulai' => '2026-10-23',
            'selesai' => '2026-10-26',
            'hari_kerja' => 2,
            'alasan' => 'Keperluan keluarga',
            'status' => 'menunggu',
            'diajukan' => '2026-10-21T12:00:00+07:00',
            'catatan_admin' => null,
            'diputuskan' => null,
        ], $hasil);
    }

    public function test_rentang_jumat_sampai_senin_dihitung_dua_hari_kerja(): void
    {
        $this->assertSame(2, Harian::hitungHariKerja(
            Carbon::parse('2026-10-23', 'Asia/Jakarta'),
            Carbon::parse('2026-10-26', 'Asia/Jakarta')
        ));
    }

    public function test_izin_sehari_disimpan_dan_dimuat_ulang_tanpa_menggeser_tanggal(): void
    {
        $pengguna = $this->buatPengguna();

        $izin = Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => 'izin',
            'mulai' => '2026-10-21',
            'selesai' => '2026-10-21',
            'alasan' => 'Keperluan pribadi',
            'diajukan_at' => now(),
        ]);

        $this->assertDatabaseHas('izin', [
            'id' => $izin->id,
            'mulai' => '2026-10-21 00:00:00',
            'selesai' => '2026-10-21 00:00:00',
        ]);

        $izin = Izin::findOrFail($izin->id);

        $this->assertInstanceOf(Carbon::class, $izin->mulai);
        $this->assertInstanceOf(Carbon::class, $izin->selesai);
        $this->assertInstanceOf(Carbon::class, $izin->diajukan_at);
        $this->assertTrue($izin->pengguna->is($pengguna));
        $this->assertNull($izin->pemutus);
        $this->assertSame([
            'id' => $izin->id,
            'pengguna_id' => $pengguna->id,
            'nama' => 'Nurul Hidayah',
            'nip' => 'MGG009',
            'divisi' => 'Perhitungan',
            'jenis' => 'izin',
            'mulai' => '2026-10-21',
            'selesai' => '2026-10-21',
            'hari_kerja' => 1,
            'alasan' => 'Keperluan pribadi',
            'status' => 'menunggu',
            'diajukan' => '2026-10-21T12:00:00+07:00',
            'catatan_admin' => null,
            'diputuskan' => null,
        ], $izin->apiArray());

        $this->assertSame([$izin->id], Izin::query()
            ->whereDate('mulai', '<=', '2026-10-21')
            ->whereDate('selesai', '>=', '2026-10-21')
            ->pluck('id')->all());
    }

    public function test_keputusan_memuat_pemutus_dan_tetap_tersimpan_setelah_pemutus_dihapus(): void
    {
        $pengguna = $this->buatPengguna();
        $admin = $this->buatPengguna('ADM001', 'admin');

        $izin = Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => 'sakit',
            'mulai' => '2026-10-21',
            'selesai' => '2026-10-21',
            'alasan' => 'Perlu istirahat',
            'status' => 'disetujui',
            'catatan_admin' => 'Semoga lekas sembuh',
            'diajukan_at' => Carbon::parse('2026-10-21 09:00:00', 'Asia/Jakarta'),
            'diputuskan_at' => now(),
            'diputuskan_oleh' => $admin->id,
        ])->fresh(['pengguna', 'pemutus']);

        $this->assertSame(['cuti', 'izin', 'sakit'], Izin::JENIS);
        $this->assertSame(['menunggu', 'disetujui', 'ditolak'], Izin::STATUS);
        $this->assertTrue($izin->pengguna->is($pengguna));
        $this->assertTrue($izin->pemutus->is($admin));
        $this->assertInstanceOf(Carbon::class, $izin->diputuskan_at);

        $hasil = $izin->apiArray();

        $this->assertSame('disetujui', $hasil['status']);
        $this->assertSame('Semoga lekas sembuh', $hasil['catatan_admin']);
        $this->assertSame('2026-10-21T09:00:00+07:00', $hasil['diajukan']);
        $this->assertSame('2026-10-21T12:00:00+07:00', $hasil['diputuskan']);

        $admin->delete();
        $izin->refresh();

        $this->assertNull($izin->diputuskan_oleh);
        $this->assertNull($izin->pemutus);
        $this->assertSame($hasil, $izin->apiArray());
    }

    private function buatPengguna(string $nip = 'MGG009', string $peran = 'magang'): Pengguna
    {
        $lokasi = Lokasi::firstOrCreate(['nama' => 'Kantor Pusat'], [
            'lintang' => -6.2,
            'bujur' => 106.8,
            'radius_m' => 50,
            'aktif' => true,
        ]);

        $shift = Shift::firstOrCreate(['nama' => 'Reguler'], [
            'masuk' => '08:00',
            'pulang' => '17:00',
            'toleransi_menit' => 15,
            'aktif' => true,
        ]);

        return Pengguna::create([
            'nama' => 'Nurul Hidayah',
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Perhitungan',
            'shift_id' => $shift->id,
            'lokasi_id' => $lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }
}
