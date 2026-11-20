<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAbsenDinasTest extends TestCase
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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin', '2026-01-05');
        $this->magang = $this->buatPengguna('MGG001', 'Magang Uji', 'magang', '2026-10-15');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_magang_tidak_boleh_mengakses_persetujuan_dinas(): void
    {
        $dinas = $this->dinas($this->magang, '2026-10-20', 'masuk');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/admin/absen-dinas')
            ->assertForbidden()
            ->assertJsonPath('kode', 'tidak_berhak');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/admin/absen-dinas/'.$dinas->id.'/setujui')
            ->assertForbidden()
            ->assertJsonPath('kode', 'tidak_berhak');
    }

    public function test_index_default_menunggu_dan_counter_menghitung_semua_dinas(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 'magang', '2026-10-15');
        $ketiga = $this->buatPengguna('MGG003', 'Magang Ketiga', 'magang', '2026-10-15');

        $this->dinas($this->magang, '2026-10-20', 'masuk', ['status_persetujuan' => 'menunggu']);
        $this->dinas($lain, '2026-10-20', 'masuk', ['status_persetujuan' => 'menunggu']);
        $this->dinas($ketiga, '2026-10-20', 'masuk', ['status_persetujuan' => 'disetujui']);
        $this->dinas($this->magang, '2026-10-19', 'masuk', ['status_persetujuan' => 'ditolak']);

        // Absen kiosk tidak boleh ikut dihitung, walau kolomnya sama.
        $this->absenKiosk($this->magang, '2026-10-18', 'masuk');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->getJson('/api/admin/absen-dinas')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('jumlah', [
                'menunggu' => 2,
                'disetujui' => 1,
                'ditolak' => 1,
                'semua' => 4,
            ]);

        $this->getJson('/api/admin/absen-dinas?status=semua')
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('jumlah.menunggu', 2)
            ->assertJsonPath('jumlah.disetujui', 1)
            ->assertJsonPath('jumlah.ditolak', 1)
            ->assertJsonPath('jumlah.semua', 4);
    }

    public function test_index_menyaring_status_dan_urut_terbaru(): void
    {
        $this->dinas($this->magang, '2026-10-20', 'masuk', [
            'status_persetujuan' => 'menunggu',
            'waktu' => Carbon::parse('2026-10-20 08:10:00', 'Asia/Jakarta'),
        ]);
        $this->dinas($this->magang, '2026-10-20', 'pulang', [
            'status_persetujuan' => 'disetujui',
            'waktu' => Carbon::parse('2026-10-20 17:05:00', 'Asia/Jakarta'),
        ]);
        $this->dinas($this->magang, '2026-10-19', 'masuk', [
            'status_persetujuan' => 'ditolak',
            'waktu' => Carbon::parse('2026-10-19 08:05:00', 'Asia/Jakarta'),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin));

        foreach (['menunggu', 'disetujui', 'ditolak'] as $status) {
            $this->getJson('/api/admin/absen-dinas?status='.$status)
                ->assertOk()
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.status_persetujuan', $status);
        }

        $semua = $this->getJson('/api/admin/absen-dinas?status=semua')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->assertSame(
            ['disetujui', 'menunggu', 'ditolak'],
            array_column($semua->json('data'), 'status_persetujuan')
        );
    }

    public function test_index_menolak_status_tidak_valid(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin));

        foreach (['', 'lain', 'MENUNGGU'] as $status) {
            $this->getJson('/api/admin/absen-dinas?status='.$status)
                ->assertStatus(422)
                ->assertExactJson([
                    'message' => 'Status harus menunggu, disetujui, ditolak, atau semua.',
                    'kode' => 'status_tidak_valid',
                ]);
        }

        $this->getJson('/api/admin/absen-dinas?status[]=menunggu')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'status_tidak_valid');
    }

    public function test_admin_menyetujui_absen_dinas_dan_mencatat_audit(): void
    {
        $dinas = $this->dinas($this->magang, '2026-10-20', 'masuk');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->postJson('/api/admin/absen-dinas/'.$dinas->id.'/setujui')
            ->assertOk()
            ->assertJsonPath('id', $dinas->id)
            ->assertJsonPath('status_persetujuan', 'disetujui')
            ->assertJsonPath('catatan_admin', null)
            ->assertJsonPath('nama', 'Magang Uji')
            ->assertJsonPath('diputuskan_at', '2026-10-21T12:00:00+07:00');

        $this->assertNotEmpty($res->json('diputuskan_at'));

        $fresh = $dinas->fresh();
        $this->assertSame('disetujui', $fresh->status_persetujuan);
        $this->assertNull($fresh->catatan_admin);
        $this->assertSame($this->admin->id, $fresh->diputuskan_oleh);
        $this->assertNotNull($fresh->diputuskan_at);

        $audit = Audit::where('aksi', 'setujui_absen_dinas')->firstOrFail();
        $this->assertSame($this->admin->id, $audit->pengguna_id);
        $this->assertSame($dinas->id, $audit->rincian['absen_id']);
        $this->assertSame($this->magang->id, $audit->rincian['pengguna_id']);
    }

    public function test_keputusan_hanya_boleh_sekali(): void
    {
        $dinas = $this->dinas($this->magang, '2026-10-20', 'masuk');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->postJson('/api/admin/absen-dinas/'.$dinas->id.'/setujui')
            ->assertOk();

        $this->postJson('/api/admin/absen-dinas/'.$dinas->id.'/setujui')
            ->assertStatus(409)
            ->assertJsonPath('kode', 'sudah_diputuskan');

        $this->postJson('/api/admin/absen-dinas/'.$dinas->id.'/tolak', [
            'catatan' => 'Mencoba mengubah keputusan.',
        ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'sudah_diputuskan');

        $this->assertSame(1, Audit::whereIn('aksi', ['setujui_absen_dinas', 'tolak_absen_dinas'])->count());
        $this->assertSame('disetujui', $dinas->fresh()->status_persetujuan);
    }

    public function test_tolak_mewajibkan_catatan_yang_sah(): void
    {
        $dinas = $this->dinas($this->magang, '2026-10-20', 'masuk');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin));

        $this->postJson('/api/admin/absen-dinas/'.$dinas->id.'/tolak')
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->postJson('/api/admin/absen-dinas/'.$dinas->id.'/tolak', ['catatan' => '   '])
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->postJson('/api/admin/absen-dinas/'.$dinas->id.'/tolak', ['catatan' => '  abc  '])
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->postJson('/api/admin/absen-dinas/'.$dinas->id.'/tolak', [
            'catatan' => str_repeat('a', 501),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->assertSame('menunggu', $dinas->fresh()->status_persetujuan);
        $this->assertNull($dinas->fresh()->catatan_admin);
        $this->assertSame(0, Audit::count());
    }

    public function test_admin_menolak_absen_dinas_dengan_catatan_tertrim(): void
    {
        $dinas = $this->dinas($this->magang, '2026-10-20', 'masuk');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->postJson('/api/admin/absen-dinas/'.$dinas->id.'/tolak', [
                'catatan' => '  Foto tidak menunjukkan lokasi dinas.  ',
            ])
            ->assertOk()
            ->assertJsonPath('id', $dinas->id)
            ->assertJsonPath('status_persetujuan', 'ditolak')
            ->assertJsonPath('catatan_admin', 'Foto tidak menunjukkan lokasi dinas.')
            ->assertJsonPath('diputuskan_at', '2026-10-21T12:00:00+07:00');

        $fresh = $dinas->fresh();
        $this->assertSame('ditolak', $fresh->status_persetujuan);
        $this->assertSame('Foto tidak menunjukkan lokasi dinas.', $fresh->catatan_admin);
        $this->assertSame($this->admin->id, $fresh->diputuskan_oleh);

        $audit = Audit::where('aksi', 'tolak_absen_dinas')->firstOrFail();
        $this->assertSame($dinas->id, $audit->rincian['absen_id']);
        $this->assertSame($this->admin->id, $audit->pengguna_id);
    }

    public function test_keputusan_untuk_id_tidak_ada_atau_bukan_dinas_dibalas_404(): void
    {
        $kiosk = $this->absenKiosk($this->magang, '2026-10-20', 'masuk');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin));

        foreach ([999999, $kiosk->id] as $id) {
            $this->postJson('/api/admin/absen-dinas/'.$id.'/setujui')
                ->assertNotFound()
                ->assertJsonPath('kode', 'tidak_ditemukan');
        }

        $this->postJson('/api/admin/absen-dinas/bukan-angka/setujui')
            ->assertNotFound();

        $this->assertSame(0, Audit::count());
    }

    private function buatPengguna(string $nip, string $nama, string $peran, string $masukKerja): Pengguna
    {
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
            'aktif' => true,
        ]);
    }

    private function token(Pengguna $pengguna): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $pengguna->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }

    private function dinas(Pengguna $pengguna, string $tanggal, string $tipe, array $atribut = []): Absen
    {
        return $this->absen($pengguna, $tanggal, $tipe, array_merge([
            'mode' => 'luar',
            'keterangan_dinas' => 'Kunjungan dinas luar.',
            'kiosk_id' => null,
            'status_persetujuan' => 'menunggu',
        ], $atribut));
    }

    private function absenKiosk(Pengguna $pengguna, string $tanggal, string $tipe): Absen
    {
        return $this->absen($pengguna, $tanggal, $tipe, [
            'kiosk_id' => 'kiosk-uji',
            'mode' => 'kantor',
            'status_persetujuan' => 'disetujui',
        ]);
    }

    private function absen(Pengguna $pengguna, string $tanggal, string $tipe, array $atribut = []): Absen
    {
        return Absen::create(array_merge([
            'pengguna_id' => $pengguna->id,
            'tanggal' => $tanggal,
            'tipe' => $tipe,
            'waktu' => Carbon::parse($tanggal.' 08:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $pengguna->nama,
            'nip_salinan' => $pengguna->nip,
            'created_at' => now(),
        ], $atribut));
    }
}
