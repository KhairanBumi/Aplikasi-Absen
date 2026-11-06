<?php

namespace Tests\Feature;

use App\Models\Audit;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminIzinKeputusanTest extends TestCase
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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin', 12);
        $this->magang = $this->buatPengguna('MGG001', 'Nurul Hidayah', 'magang', 12);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_menyetujui_dan_audit_tercatat(): void
    {
        $izin = $this->izin('cuti', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertOk()
            ->assertJsonPath('status', 'disetujui')
            ->assertJsonPath('catatan_admin', null)
            ->assertJsonPath('pengguna_id', $this->magang->id);

        $this->assertDatabaseHas('izin', [
            'id' => $izin->id,
            'status' => 'disetujui',
            'diputuskan_oleh' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('audit', [
            'pengguna_id' => $this->admin->id,
            'aksi' => 'setujui_izin',
        ]);
    }

    public function test_keputusan_kedua_dan_id_tidak_ada_ditolak(): void
    {
        $izin = $this->izin('cuti', '2026-10-26', '2026-10-27');
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", ['catatan' => 'Sudah telanjur'])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'sudah_diputuskan');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/izin/999999/setujui', [])
            ->assertStatus(404);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/izin/abc/setujui', [])
            ->assertStatus(404);

        $this->assertSame(1, Audit::where('aksi', 'setujui_izin')->count());
    }

    public function test_tolak_wajib_catatan_dan_menyimpannya(): void
    {
        $izin = $this->izin('izin', '2026-10-26', '2026-10-26');
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", ['catatan' => 'abc'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", ['catatan' => ['bukan teks']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", [
                'catatan' => 'Beban kerja sedang tinggi.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'ditolak')
            ->assertJsonPath('catatan_admin', 'Beban kerja sedang tinggi.');

        $this->assertDatabaseHas('audit', ['aksi' => 'tolak_izin']);
    }

    public function test_menyetujui_rentang_lewat_atau_tanpa_hari_kerja_ditolak(): void
    {
        $lewat = $this->izin('sakit', '2026-10-19', '2026-10-20');
        $weekend = $this->izin('izin', '2026-10-24', '2026-10-25');
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$lewat->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_tidak_sah');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$weekend->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_tidak_sah');
    }

    public function test_menyetujui_cuti_melebihi_jatah_ditolak(): void
    {
        $this->magang->update(['cuti_kuota' => 1]);
        $izin = $this->izin('cuti', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Nurul Hidayah 1 hari, sedangkan yang diajukan 2 hari.');
    }

    public function test_menyetujui_cuti_lintas_tahun_memeriksa_jatah_tahun_berikutnya(): void
    {
        $this->magang->update(['cuti_kuota' => 12]);

        $this->izin('cuti', '2027-02-01', '2027-02-12', 'disetujui');
        $izin = $this->izin('cuti', '2026-12-31', '2027-01-05');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath(
                'message',
                'Sisa cuti Nurul Hidayah 2 hari, sedangkan yang diajukan 3 hari. Kekurangan ada pada tahun 2027.'
            );
    }

    public function test_menyetujui_pengajuan_yang_tumpang_tindih_dengan_yang_disetujui_ditolak(): void
    {
        $this->izin('cuti', '2026-10-26', '2026-10-26', 'disetujui');
        $izin = $this->izin('izin', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'bentrok_izin');
    }

    public function test_menyetujui_sakit_tidak_memeriksa_kuota(): void
    {
        $this->magang->update(['cuti_kuota' => 0]);
        $izin = $this->izin('sakit', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertOk()
            ->assertJsonPath('status', 'disetujui');
    }

    public function test_keputusan_dan_audit_dibatalkan_bersama_saat_audit_gagal(): void
    {
        $izin = $this->izin('izin', '2026-10-26', '2026-10-26');

        DB::statement("CREATE TRIGGER uji_gagal_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'audit gagal'); END");

        try {
            $this->withoutExceptionHandling()
                ->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
                ->postJson("/api/admin/izin/{$izin->id}/setujui", []);

            $this->fail('Audit yang gagal seharusnya membatalkan seluruh keputusan.');
        } catch (QueryException) {
            // Transaction must roll back both decision and audit.
        } finally {
            DB::statement('DROP TRIGGER IF EXISTS uji_gagal_audit');
        }

        $this->assertDatabaseHas('izin', ['id' => $izin->id, 'status' => 'menunggu']);
        $this->assertSame(0, Audit::where('aksi', 'setujui_izin')->count());
    }

    private function buatPengguna(string $nip, string $nama, string $peran, int $jatah): Pengguna
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
            'cuti_kuota' => $jatah,
            'aktif' => true,
        ]);
    }

    private function izin(
        string $jenis,
        string $mulai,
        string $selesai,
        string $status = 'menunggu'
    ): Izin {
        return Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
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
