<?php

namespace Tests\Feature;

use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AdminIzinListTest extends TestCase
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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin');
        $this->magang = $this->buatPengguna('MGG001', 'Nurul Hidayah', 'magang');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_daftar_default_menunggu_dan_jumlah_semua_status(): void
    {
        $baru = $this->izin('cuti', 'menunggu', '2026-10-20 09:15:00');
        $this->izin('izin', 'disetujui', '2026-10-17 09:15:00');
        $this->izin('sakit', 'ditolak', '2026-10-16 09:15:00');
        $lama = $this->izin('cuti', 'menunggu', '2026-10-18 09:15:00');
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 'magang');
        $lama->update(['pengguna_id' => $lain->id]);
        $seri = $this->izin('izin', 'menunggu', '2026-10-20 09:15:00');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/izin')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('jumlah', [
                'menunggu' => 3, 'disetujui' => 1, 'ditolak' => 1, 'semua' => 5,
            ])
            ->assertJsonPath('data.0', [
                'id' => $seri->id,
                'pengguna_id' => $this->magang->id,
                'nama' => 'Nurul Hidayah',
                'nip' => 'MGG001',
                'divisi' => 'Pendataan',
                'jenis' => 'izin',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'hari_kerja' => 2,
                'alasan' => 'Alasan uji',
                'status' => 'menunggu',
                'diajukan' => '2026-10-20T09:15:00+07:00',
                'catatan_admin' => null,
                'diputuskan' => null,
            ])
            ->assertJsonPath('data.2.nama', 'Magang Lain');

        $this->assertSame([$seri->id, $baru->id, $lama->id], array_column($res->json('data'), 'id'));
        $this->assertSame(['menunggu', 'menunggu', 'menunggu'], array_column($res->json('data'), 'status'));

        $this->magang->update([
            'nama' => 'Nurul Hidayah Baru',
            'nip' => 'MGG003',
            'divisi' => 'Perhitungan',
        ]);

        $this->getJson('/api/admin/izin?status=menunggu')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.nama', 'Nurul Hidayah Baru')
            ->assertJsonPath('data.0.nip', 'MGG003')
            ->assertJsonPath('data.0.divisi', 'Perhitungan');
    }

    public function test_status_semua_dan_status_tidak_sah(): void
    {
        $menunggu = $this->izin('cuti', 'menunggu', '2026-10-18 09:15:00');
        $disetujui = $this->izin('izin', 'disetujui', '2026-10-17 09:15:00');
        $ditolak = $this->izin('sakit', 'ditolak', '2026-10-18 09:15:00');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin());

        $res = $this->getJson('/api/admin/izin?status=semua')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('jumlah', [
                'menunggu' => 1, 'disetujui' => 1, 'ditolak' => 1, 'semua' => 3,
            ]);

        $this->assertSame([$ditolak->id, $menunggu->id, $disetujui->id], array_column($res->json('data'), 'id'));

        $this->getJson('/api/admin/izin?status=entah')
            ->assertStatus(422)
            ->assertExactJson([
                'kode' => 'status_tidak_valid',
                'message' => 'Status harus menunggu, disetujui, ditolak, atau semua.',
            ]);

        foreach (['disetujui' => $disetujui, 'ditolak' => $ditolak] as $status => $izin) {
            $this->getJson('/api/admin/izin?status='.$status)
                ->assertOk()
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.id', $izin->id)
                ->assertJsonPath('data.0.status', $status)
                ->assertJsonPath('jumlah', [
                    'menunggu' => 1, 'disetujui' => 1, 'ditolak' => 1, 'semua' => 3,
                ]);
        }
    }

    #[DataProvider('statusTidakValid')]
    public function test_status_array_dan_kosong_ditolak_dengan_galat_indonesia(string $query): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/izin?'.$query)
            ->assertStatus(422)
            ->assertExactJson([
                'kode' => 'status_tidak_valid',
                'message' => 'Status harus menunggu, disetujui, ditolak, atau semua.',
            ]);
    }

    public static function statusTidakValid(): array
    {
        return [
            'array' => ['status%5B%5D=menunggu'],
            'array bertingkat' => ['status%5Bpilihan%5D%5B%5D=semua'],
            'kosong' => ['status='],
            'tanpa nilai' => ['status'],
            'spasi' => ['status=%20%20'],
        ];
    }

    public function test_tanpa_pengajuan_mengembalikan_daftar_kosong_dan_jumlah_nol(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/izin')
            ->assertOk()
            ->assertExactJson([
                'data' => [],
                'jumlah' => [
                    'menunggu' => 0, 'disetujui' => 0, 'ditolak' => 0, 'semua' => 0,
                ],
            ]);

        $this->izin('izin', 'disetujui', '2026-10-17 09:15:00');

        $this->getJson('/api/admin/izin')
            ->assertOk()
            ->assertExactJson([
                'data' => [],
                'jumlah' => [
                    'menunggu' => 0, 'disetujui' => 1, 'ditolak' => 0, 'semua' => 1,
                ],
            ]);
    }

    public function test_daftar_izin_admin_wajib_token_valid(): void
    {
        $this->getJson('/api/admin/izin')
            ->assertUnauthorized()
            ->assertJsonPath('kode', 'sesi_habis');

        $this->withHeader('Authorization', 'Bearer token-tidak-valid')
            ->getJson('/api/admin/izin')
            ->assertUnauthorized()
            ->assertJsonPath('kode', 'sesi_habis');
    }

    public function test_magang_tidak_boleh_membuka_daftar_izin_admin(): void
    {
        $token = $this->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/izin')
            ->assertStatus(403)
            ->assertJsonPath('kode', 'tidak_berhak');
    }

    private function buatPengguna(string $nip, string $nama, string $peran): Pengguna
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
            'aktif' => true,
        ]);
    }

    private function izin(string $jenis, string $status, string $diajukan): Izin
    {
        return Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => $jenis,
            'mulai' => '2026-10-26',
            'selesai' => '2026-10-27',
            'alasan' => 'Alasan uji',
            'status' => $status,
            'catatan_admin' => $status === 'ditolak' ? 'Catatan uji' : null,
            'diajukan_at' => Carbon::parse($diajukan, 'Asia/Jakarta'),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
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
