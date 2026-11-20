<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use App\Support\Geo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SayaAbsenDinasTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    private Pengguna $magang;

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

        Carbon::setTestNow(Carbon::parse('2026-10-21 08:43:00', 'Asia/Jakarta'));

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

    public function test_magang_bisa_absen_dinas_luar_dan_server_menentukan_isinya(): void
    {
        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload())
            ->assertCreated()
            ->assertJsonPath('idempoten', false)
            ->assertJsonPath('pengguna_id', $this->magang->id)
            ->assertJsonPath('nama', 'Magang Uji')
            ->assertJsonPath('nip', 'MGG001')
            ->assertJsonPath('divisi', 'Pendataan')
            ->assertJsonPath('tanggal', '2026-10-21')
            ->assertJsonPath('tipe', 'masuk')
            ->assertJsonPath('waktu', '2026-10-21T08:43:00+07:00')
            ->assertJsonPath('status_persetujuan', 'menunggu')
            ->assertJsonPath('keterangan_dinas', 'Kunjungan ke vendor di Cikarang.')
            ->assertJsonPath('catatan_admin', null)
            ->assertJsonPath('diputuskan_at', null)
            ->assertJsonPath('telat_menit', 28)
            ->assertJsonPath('mode', 'luar')
            ->assertJsonPath('lokasi', 'Dinas luar')
            ->assertJsonPath('lokasi_kantor', 'Kantor Pusat')
            ->assertJsonPath('lokasi_teks', 'Jl. Uji 1, Jakarta Pusat')
            ->assertJsonPath('lokasi_meragukan', false);

        $absen = Absen::findOrFail($res->json('id'));

        $this->assertSame('luar', $absen->mode);
        $this->assertSame('menunggu', $absen->status_persetujuan);
        $this->assertNull($absen->kiosk_id);
        $this->assertSame($this->lokasi->id, $absen->lokasi_id);
        $this->assertSame($this->shift->id, $absen->shift_id);
        $this->assertSame('Magang Uji', $absen->nama_salinan);
        $this->assertNotNull($absen->foto_path);
        Storage::disk('local')->assertExists($absen->foto_path);
        $this->assertSame(
            (int) round(Geo::jarakMeter(-6.284312, 107.166041, -6.2246, 106.8094)),
            $absen->jarak_m
        );

        $audit = Audit::where('aksi', 'absen_dinas_masuk')->firstOrFail();
        $this->assertSame($this->magang->id, $audit->pengguna_id);
        $this->assertSame($absen->id, $audit->rincian['absen_id']);
        $this->assertSame('menunggu', $audit->rincian['status_persetujuan']);
    }

    public function test_hanya_magang_yang_boleh_memakai_endpoint_dinas(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->postJson('/api/saya/absen', $this->payload())
            ->assertForbidden()
            ->assertJsonPath('kode', 'tidak_berhak');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->getJson('/api/saya/absen-dinas')
            ->assertForbidden()
            ->assertJsonPath('kode', 'tidak_berhak');

        $this->assertSame(0, Absen::count());
    }

    public function test_identitas_diambil_dari_token_bukan_body(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 'magang', '2026-10-15');

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload([
                'pengguna_id' => $lain->id,
                'nama_salinan' => 'Nama Palsu',
                'nip_salinan' => 'PALSU',
            ]))
            ->assertCreated()
            ->assertJsonPath('pengguna_id', $this->magang->id)
            ->assertJsonPath('nama', 'Magang Uji')
            ->assertJsonPath('nip', 'MGG001');

        $this->assertSame(0, Absen::where('pengguna_id', $lain->id)->count());
        $this->assertSame('Magang Uji', Absen::firstOrFail()->nama_salinan);
    }

    public function test_validasi_kolom_wajib_dan_koordinat_berpasangan(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang));

        $this->postJson('/api/saya/absen', $this->payload(['keterangan_dinas' => '   ']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('keterangan_dinas');

        $this->postJson('/api/saya/absen', $this->payload(['keterangan_dinas' => 'abc']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('keterangan_dinas');

        $this->postJson('/api/saya/absen', $this->payload(['foto' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('foto');

        $this->postJson('/api/saya/absen', $this->payload(['bujur' => null]))
            ->assertStatus(422)
            ->assertJsonPath('kode', 'koordinat_tidak_lengkap');

        $this->assertSame(0, Absen::count());
    }

    public function test_foto_tidak_valid_ditolak_tanpa_menyimpan_baris(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload(['foto' => 'bukan-data-uri']))
            ->assertStatus(422)
            ->assertJsonPath('kode', 'foto_tidak_valid');

        $this->assertSame(0, Absen::count());
        $this->assertCount(0, Storage::disk('local')->allFiles());
    }

    public function test_kunci_idempoten_mengembalikan_baris_yang_sama(): void
    {
        $pertama = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload())
            ->assertCreated()
            ->json();

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload())
            ->assertOk()
            ->assertJsonPath('idempoten', true)
            ->assertJsonPath('id', $pertama['id'])
            ->assertJsonPath('waktu', $pertama['waktu']);

        $this->assertSame(1, Absen::count());
        $this->assertSame(1, Audit::where('aksi', 'absen_dinas_masuk')->count());
        $this->assertCount(1, Storage::disk('local')->allFiles('absen'));
    }

    public function test_kunci_idempoten_milik_pengguna_lain_ditolak(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 'magang', '2026-10-15');

        $this->absen($lain, '2026-10-20', 'masuk', '2026-10-20 08:00:00', [
            'mode' => 'luar',
            'keterangan_dinas' => 'Dinas milik orang lain.',
            'kunci_idempoten' => 'kunci-uji-0001',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload())
            ->assertStatus(409)
            ->assertJsonPath('kode', 'kunci_bentrok');

        $this->assertSame(0, Absen::where('pengguna_id', $this->magang->id)->count());
        $this->assertSame(1, Absen::where('pengguna_id', $lain->id)->count());
    }

    public function test_mixed_day_masuk_kiosk_lalu_pulang_dinas_luar(): void
    {
        $this->absen($this->magang, '2026-10-21', 'masuk', '2026-10-21 07:55:00', [
            'status_persetujuan' => 'disetujui',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload(['kunci_idempoten' => 'kunci-pulang-0001']))
            ->assertCreated()
            ->assertJsonPath('tipe', 'pulang')
            ->assertJsonPath('telat_menit', 0)
            ->assertJsonPath('status_persetujuan', 'menunggu');

        $this->assertSame(2, Absen::whereDate('tanggal', '2026-10-21')->count());

        $res = $this->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk()
            ->assertJsonPath('ringkasan.hadir', 1)
            ->assertJsonPath('ringkasan.tepat', 1);

        $hari = collect($res->json('data'))->keyBy('tanggal');
        $this->assertSame('tepat', $hari['2026-10-21']['status']);
        $this->assertSame('disetujui', $hari['2026-10-21']['status_persetujuan']);
        $this->assertNotNull($hari['2026-10-21']['masuk']);
        $this->assertNotNull($hari['2026-10-21']['pulang']);

        $this->getJson('/api/saya/absen-dinas')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.tipe', 'pulang')
            ->assertJsonPath('data.0.status_persetujuan', 'menunggu');
    }

    public function test_kirim_ulang_setelah_ditolak_memperbarui_baris_yang_sama(): void
    {
        Storage::disk('local')->put('absen/lama.jpg', 'foto lama');

        $lama = $this->absen($this->magang, '2026-10-21', 'masuk', '2026-10-21 08:10:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'ditolak',
            'keterangan_dinas' => 'Keterangan lama.',
            'catatan_admin' => 'Foto tidak jelas.',
            'diputuskan_oleh' => $this->admin->id,
            'diputuskan_at' => Carbon::parse('2026-10-21 08:30:00', 'Asia/Jakarta'),
            'foto_path' => 'absen/lama.jpg',
            'kunci_idempoten' => 'kunci-lama-0001',
            'kiosk_id' => null,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload(['kunci_idempoten' => 'kunci-baru-0001']))
            ->assertOk()
            ->assertJsonPath('id', $lama->id)
            ->assertJsonPath('idempoten', false)
            ->assertJsonPath('status_persetujuan', 'menunggu')
            ->assertJsonPath('keterangan_dinas', 'Kunjungan ke vendor di Cikarang.')
            ->assertJsonPath('catatan_admin', null);

        $this->assertSame(1, Absen::count());
        $fresh = $lama->fresh();
        $this->assertSame('menunggu', $fresh->status_persetujuan);
        $this->assertNull($fresh->catatan_admin);
        $this->assertNull($fresh->diputuskan_at);
        $this->assertNull($fresh->diputuskan_oleh);
        $this->assertSame('2026-10-21 08:43:00', $fresh->waktu->format('Y-m-d H:i:s'));
        $this->assertNotSame('absen/lama.jpg', $fresh->foto_path);
        Storage::disk('local')->assertMissing('absen/lama.jpg');
        Storage::disk('local')->assertExists($fresh->foto_path);

        $this->assertSame($lama->id, $res->json('id'));
        $this->assertSame(1, Audit::where('aksi', 'absen_dinas_masuk')->count());
    }

    public function test_tipe_yang_sudah_lengkap_tidak_bisa_dikirim_ulang(): void
    {
        $this->absen($this->magang, '2026-10-21', 'masuk', '2026-10-21 08:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'menunggu',
            'keterangan_dinas' => 'Sudah menunggu.',
        ]);

        $this->absen($this->magang, '2026-10-21', 'pulang', '2026-10-21 17:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'disetujui',
            'keterangan_dinas' => 'Pulang disetujui.',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->postJson('/api/saya/absen', $this->payload(['kunci_idempoten' => 'kunci-lain-0001']))
            ->assertStatus(409)
            ->assertJsonPath('kode', 'sudah_absen');
    }

    public function test_daftar_absen_dinas_hanya_milik_token_dan_memuat_catatan_admin(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 'magang', '2026-10-15');

        $this->absen($this->magang, '2026-10-20', 'masuk', '2026-10-20 09:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'ditolak',
            'keterangan_dinas' => 'Dinas pagi.',
            'catatan_admin' => 'Bukti kurang jelas.',
            'foto_path' => null,
            'kiosk_id' => null,
        ]);

        $this->absen($this->magang, '2026-10-21', 'masuk', '2026-10-21 08:43:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'menunggu',
            'keterangan_dinas' => 'Dinas siang.',
            'kiosk_id' => null,
        ]);

        // Absen kiosk yang kebetulan mode luar bukan bagian daftar dinas mandiri.
        $this->absen($this->magang, '2026-10-19', 'masuk', '2026-10-19 08:00:00', [
            'mode' => 'luar',
        ]);

        $this->absen($lain, '2026-10-21', 'masuk', '2026-10-21 08:00:00', [
            'mode' => 'luar',
            'keterangan_dinas' => 'Punya orang lain.',
            'kiosk_id' => null,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen-dinas')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.keterangan_dinas', 'Dinas siang.')
            ->assertJsonPath('data.1.keterangan_dinas', 'Dinas pagi.')
            ->assertJsonPath('data.1.catatan_admin', 'Bukti kurang jelas.')
            ->assertJsonPath('data.1.status_persetujuan', 'ditolak')
            ->assertJsonStructure([
                'data' => [[
                    'id', 'pengguna_id', 'nama', 'nip', 'divisi', 'tanggal', 'tipe',
                    'waktu', 'status_persetujuan', 'keterangan_dinas', 'catatan_admin',
                    'diputuskan_at', 'telat_menit', 'lokasi_id', 'lokasi',
                    'lokasi_kantor', 'mode', 'lintang', 'bujur', 'akurasi', 'jarak_m',
                    'lokasi_teks', 'lokasi_meragukan', 'foto',
                ]],
            ]);

        $this->assertNull($res->json('data.1.foto'));

        $baru = $this->buatPengguna('MGG003', 'Belum Pernah Dinas', 'magang', '2026-10-15');
        $this->flushHeaders()
            ->withHeader('Authorization', 'Bearer '.$this->token($baru))
            ->getJson('/api/saya/absen-dinas')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_harian_menunggu_tidak_dihitung_hadir_maupun_alpha(): void
    {
        $this->absen($this->magang, '2026-10-20', 'masuk', '2026-10-20 08:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'menunggu',
            'keterangan_dinas' => 'Dinas menunggu.',
            'kiosk_id' => null,
        ]);

        $this->absen($this->magang, '2026-10-19', 'masuk', '2026-10-19 08:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'ditolak',
            'keterangan_dinas' => 'Dinas ditolak.',
            'catatan_admin' => 'Bukti kurang.',
            'kiosk_id' => null,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk()
            ->assertJsonPath('ringkasan.hadir', 0)
            ->assertJsonPath('ringkasan.tepat', 0)
            ->assertJsonPath('ringkasan.telat', 0)
            ->assertJsonPath('ringkasan.alpha', 3);

        $hari = collect($res->json('data'))->keyBy('tanggal');

        $this->assertSame('menunggu', $hari['2026-10-20']['status']);
        $this->assertSame('menunggu', $hari['2026-10-20']['status_persetujuan']);
        $this->assertSame('Dinas menunggu.', $hari['2026-10-20']['keterangan_dinas']);
        $this->assertNull($hari['2026-10-20']['catatan_admin']);

        $this->assertSame('alpha', $hari['2026-10-19']['status']);
        $this->assertSame('ditolak', $hari['2026-10-19']['status_persetujuan']);
        $this->assertSame('Bukti kurang.', $hari['2026-10-19']['catatan_admin']);

        $this->assertSame('disetujui', $hari['2026-10-21']['status_persetujuan']);
        $this->assertNull($hari['2026-10-21']['keterangan_dinas']);
    }

    public function test_harian_absen_dinas_disetujui_dihitung_hadir(): void
    {
        $this->absen($this->magang, '2026-10-20', 'pulang', '2026-10-20 17:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'disetujui',
            'keterangan_dinas' => 'Pulang dari dinas.',
            'kiosk_id' => null,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk()
            ->assertJsonPath('ringkasan.hadir', 1)
            ->assertJsonPath('ringkasan.tepat', 1)
            ->assertJsonPath('ringkasan.telat', 0);

        $hari = collect($res->json('data'))->keyBy('tanggal');
        $this->assertSame('tepat', $hari['2026-10-20']['status']);
        $this->assertSame('disetujui', $hari['2026-10-20']['status_persetujuan']);
    }

    public function test_dashboard_hanya_menghitung_absen_dinas_yang_disetujui(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 'magang', '2026-10-15');

        $disetujui = $this->absen($this->magang, '2026-10-21', 'masuk', '2026-10-21 07:50:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'disetujui',
            'keterangan_dinas' => 'Dinas disetujui.',
            'kiosk_id' => null,
        ]);

        $menunggu = $this->absen($lain, '2026-10-21', 'masuk', '2026-10-21 08:43:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'menunggu',
            'keterangan_dinas' => 'Dinas menunggu.',
            'telat_menit' => 28,
            'kiosk_id' => null,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('ringkasan.sudah_masuk', 1)
            ->assertJsonPath('ringkasan.telat', 0)
            ->assertJsonCount(2, 'aktivitas');

        $aktivitas = collect($res->json('aktivitas'))->keyBy('id');
        $this->assertSame('disetujui', $aktivitas[$disetujui->id]['status_persetujuan']);
        $this->assertSame('menunggu', $aktivitas[$menunggu->id]['status_persetujuan']);
    }

    public function test_laporan_hanya_menghitung_baris_dinas_yang_disetujui(): void
    {
        $this->absen($this->magang, '2026-10-15', 'masuk', '2026-10-15 08:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'menunggu',
            'keterangan_dinas' => 'Menunggu, tidak dihitung.',
            'akurasi' => null,
            'kiosk_id' => null,
        ]);

        $this->absen($this->magang, '2026-10-16', 'masuk', '2026-10-16 08:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'ditolak',
            'keterangan_dinas' => 'Ditolak, tidak dihitung.',
            'kiosk_id' => null,
        ]);

        $this->absen($this->magang, '2026-10-20', 'masuk', '2026-10-20 08:00:00', [
            'mode' => 'luar',
            'status_persetujuan' => 'disetujui',
            'keterangan_dinas' => 'Disetujui, dihitung.',
            'akurasi' => 12,
            'kiosk_id' => null,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->admin))
            ->getJson('/api/admin/laporan?bulan=2026-10')
            ->assertOk();

        $baris = collect($res->json('data'))->firstWhere('pengguna_id', $this->magang->id);

        $this->assertSame(1, $baris['hadir']);
        $this->assertSame(1, $baris['luar']);
        $this->assertSame(0, $baris['luar_kasar']);
        // 17-18 libur akhir pekan; 19 tidak ada absen; 21 belum lewat.
        $this->assertSame(2, $baris['alpha']);
    }

    public function test_kedua_endpoint_mewajibkan_token(): void
    {
        $this->postJson('/api/saya/absen', $this->payload())
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');

        $this->getJson('/api/saya/absen-dinas')
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');
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

    private function foto(): string
    {
        return 'data:image/jpeg;base64,'.base64_encode("\xFF\xD8\xFF\xE0foto-uji");
    }

    private function payload(array $ganti = []): array
    {
        return array_merge([
            'foto' => $this->foto(),
            'lintang' => -6.284312,
            'bujur' => 107.166041,
            'akurasi' => 12,
            'keterangan_dinas' => '  Kunjungan ke vendor di Cikarang.  ',
            'kunci_idempoten' => 'kunci-uji-0001',
        ], $ganti);
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
}
