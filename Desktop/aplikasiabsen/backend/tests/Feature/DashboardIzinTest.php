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

class DashboardIzinTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-21 09:00:00', 'Asia/Jakarta'));

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
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_izin_mengurangi_belum_masuk_dan_total_tetap_pas(): void
    {
        $cuti = $this->buatPengguna('MGG001', 'Dewi Lestari', 'magang', true);
        $belum = $this->buatPengguna('MGG002', 'Rizal Fadillah', 'magang', true);
        $hadir = $this->buatPengguna('MGG003', 'Lukman Hakim', 'magang', true);
        $adminIzin = $this->buatPengguna('ADM002', 'Admin Izin', 'admin', true);
        $this->buatPengguna('ADM003', 'Admin Tanpa Catatan', 'admin', true);

        $this->izin($cuti, 'cuti', '2026-10-21', '2026-10-21', 'disetujui');
        $this->izin($adminIzin, 'izin', '2026-10-21', '2026-10-21', 'disetujui');
        $this->izin($belum, 'sakit', '2026-10-22', '2026-10-22', 'disetujui');

        // Absen menang atas izin: orang ini tetap dihitung hadir, bukan izin.
        $this->izin($hadir, 'izin', '2026-10-21', '2026-10-21', 'disetujui');
        $this->absen($hadir);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('ringkasan.total', 4)
            ->assertJsonPath('ringkasan.sudah_masuk', 1)
            ->assertJsonPath('ringkasan.belum_masuk', 1)
            ->assertJsonPath('ringkasan.izin', 2)
            ->assertJsonCount(1, 'belum_masuk')
            ->assertJsonPath('belum_masuk.0.nama', 'Rizal Fadillah')
            ->assertJsonCount(2, 'izin');

        $namaIzin = array_column($res->json('izin'), 'nama');
        sort($namaIzin);
        $this->assertSame(['Admin Izin', 'Dewi Lestari'], $namaIzin);

        $baris = collect($res->json('izin'))->keyBy('nama');
        $this->assertSame('cuti', $baris['Dewi Lestari']['jenis']);
        $this->assertSame('2026-10-21', $baris['Dewi Lestari']['mulai']);
        $this->assertSame('2026-10-21', $baris['Dewi Lestari']['selesai']);
        $this->assertSame('Alasan uji', $baris['Dewi Lestari']['alasan']);
    }

    public function test_hari_libur_tidak_menampilkan_izin(): void
    {
        $cuti = $this->buatPengguna('MGG010', 'Magang Libur', 'magang', true);
        $this->izin($cuti, 'cuti', '2026-10-24', '2026-10-24', 'disetujui');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/dashboard?tanggal=2026-10-24')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('ringkasan.total', 0)
            ->assertJsonPath('ringkasan.izin', 0)
            ->assertJsonCount(0, 'belum_masuk')
            ->assertJsonCount(0, 'izin');

        HariLibur::create(['tanggal' => '2026-10-21', 'keterangan' => 'Libur Uji']);
        $this->izin($cuti, 'izin', '2026-10-21', '2026-10-21', 'disetujui');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('ringkasan.izin', 0)
            ->assertJsonCount(0, 'izin');
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

    private function izin(
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

    private function absen(Pengguna $pengguna): Absen
    {
        return Absen::create([
            'pengguna_id' => $pengguna->id,
            'tanggal' => '2026-10-21',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-21 07:55:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $pengguna->nama,
            'nip_salinan' => $pengguna->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
