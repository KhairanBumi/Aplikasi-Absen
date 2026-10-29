<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class HarianIzinTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    private Pengguna $magang;

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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin', true);
        $this->magang = $this->buatPengguna('MGG001', 'Magang Uji', 'magang', true);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_prioritas_libur_absen_lalu_izin(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $this->izin('cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->izin('sakit', '2026-10-20', '2026-10-20', 'disetujui');
        $this->izin('izin', '2026-10-26', '2026-10-26', 'menunggu');

        $this->absen('2026-10-22');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenMagang())
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk();

        $hari = collect($res->json('data'))->keyBy('tanggal');

        $this->assertSame('libur', $hari['2026-10-20']['status']);
        $this->assertSame('Libur Uji', $hari['2026-10-20']['keterangan_libur']);

        // Absen menang atas izin pada hari yang sama.
        $this->assertSame('tepat', $hari['2026-10-22']['status']);
        $this->assertNull($hari['2026-10-22']['keterangan_izin']);

        $this->assertSame('cuti', $hari['2026-10-23']['status']);
        $this->assertSame('cuti', $hari['2026-10-23']['keterangan_izin']);
        $this->assertSame('Alasan uji', $hari['2026-10-23']['alasan_izin']);
        $this->assertNull($hari['2026-10-23']['masuk']);

        // Pengajuan menunggu belum menjadi status.
        $this->assertSame('belum', $hari['2026-10-26']['status']);
        $this->assertNull($hari['2026-10-26']['keterangan_izin']);

        // Hanya 23 Oktober yang benar-benar berstatus cuti.
        $this->assertSame(1, $res->json('ringkasan.izin'));
    }

    public function test_laporan_memuat_nonaktif_yang_hanya_punya_izin_disetujui(): void
    {
        $nonaktif = $this->buatPengguna('MGG002', 'Magang Nonaktif', 'magang', false);
        $this->izinUntuk($nonaktif, 'cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->izinUntuk($this->magang, 'sakit', '2026-10-27', '2026-10-27', 'disetujui');
        $this->izinUntuk($this->magang, 'izin', '2026-10-28', '2026-10-28', 'menunggu');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/laporan?bulan=2026-10')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $baris = collect($res->json('data'))->keyBy('nip');

        $this->assertFalse($baris['MGG002']['aktif']);
        $this->assertSame(2, $baris['MGG002']['cuti']);
        $this->assertSame(0, $baris['MGG002']['hadir']);
        $this->assertSame(1, $baris['MGG001']['sakit']);
        $this->assertSame(0, $baris['MGG001']['izin']);
        $this->assertSame(3, $res->json('ringkasan.izin'));
    }

    private function buatPengguna(string $nip, string $nama, string $peran, bool $aktif): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => $aktif,
        ]);
    }

    private function izin(string $jenis, string $mulai, string $selesai, string $status): Izin
    {
        return $this->izinUntuk($this->magang, $jenis, $mulai, $selesai, $status);
    }

    private function izinUntuk(
        Pengguna $pengguna,
        string $jenis,
        string $mulai,
        string $selesai,
        string $status
    ): Izin {
        return Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function absen(string $tanggal): Absen
    {
        return Absen::create([
            'pengguna_id' => $this->magang->id,
            'tanggal' => $tanggal,
            'tipe' => 'masuk',
            'waktu' => Carbon::parse($tanggal.' 08:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);
    }

    private function tokenMagang(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
