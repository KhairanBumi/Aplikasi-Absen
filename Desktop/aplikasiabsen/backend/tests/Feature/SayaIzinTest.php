<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Sesi;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SayaIzinTest extends TestCase
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

        $this->magang = $this->buatPengguna('MGG001', 'Magang Uji', 12);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_magang_melihat_pengajuannya_sendiri_dan_kuota(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 12);

        $cuti = Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-26',
            'selesai' => '2026-10-27',
            'alasan' => 'Keperluan keluarga',
            'status' => 'disetujui',
            'diajukan_at' => Carbon::parse('2026-10-18 09:15:00', 'Asia/Jakarta'),
            'diputuskan_at' => Carbon::parse('2026-10-19 10:00:00', 'Asia/Jakarta'),
        ]);

        $izin = Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'izin',
            'mulai' => '2026-10-28',
            'selesai' => '2026-10-28',
            'alasan' => 'Urusan bank',
            'status' => 'menunggu',
            'diajukan_at' => Carbon::parse('2026-10-20 11:00:00', 'Asia/Jakarta'),
        ]);

        $sakit = Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'sakit',
            'mulai' => '2026-10-20',
            'selesai' => '2026-10-20',
            'alasan' => 'Demam',
            'status' => 'ditolak',
            'catatan_admin' => 'Surat dokter tidak ada.',
            'diajukan_at' => Carbon::parse('2026-10-19 08:00:00', 'Asia/Jakarta'),
            'diputuskan_at' => Carbon::parse('2026-10-19 09:00:00', 'Asia/Jakarta'),
        ]);

        Izin::create([
            'pengguna_id' => $lain->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-26',
            'selesai' => '2026-10-26',
            'alasan' => 'Milik orang lain',
            'status' => 'menunggu',
            'diajukan_at' => now(),
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson('/api/saya/izin?pengguna_id='.$lain->id)
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('kuota.jatah', 12)
            ->assertJsonPath('kuota.terpakai', 2)
            ->assertJsonPath('kuota.menunggu', 0)
            ->assertJsonPath('kuota.sisa', 10)
            ->assertJsonStructure([
                'data' => [[
                    'id', 'pengguna_id', 'nama', 'nip', 'divisi', 'jenis', 'mulai',
                    'selesai', 'hari_kerja', 'alasan', 'status', 'diajukan',
                    'catatan_admin', 'diputuskan',
                ]],
            ]);

        $this->assertSame([$izin->id, $sakit->id, $cuti->id], array_column($res->json('data'), 'id'));
        $this->assertSame(['izin', 'sakit', 'cuti'], array_column($res->json('data'), 'jenis'));
        $this->assertSame([$this->magang->id], array_values(array_unique(array_column($res->json('data'), 'pengguna_id'))));
        $this->assertSame('Magang Uji', $res->json('data.0.nama'));
        $this->assertSame('MGG001', $res->json('data.0.nip'));
        $this->assertSame('Pendataan', $res->json('data.0.divisi'));
        $this->assertSame('2026-10-20T11:00:00+07:00', $res->json('data.0.diajukan'));
        $this->assertNull($res->json('data.0.diputuskan'));
        $this->assertSame('Surat dokter tidak ada.', $res->json('data.1.catatan_admin'));
        $this->assertSame(2, $res->json('data.2.hari_kerja'));
    }

    public function test_waktu_pengajuan_sama_diurutkan_dengan_id_menurun(): void
    {
        $atribut = [
            'pengguna_id' => $this->magang->id,
            'jenis' => 'izin',
            'mulai' => '2026-10-28',
            'selesai' => '2026-10-28',
            'alasan' => 'Urusan keluarga',
            'status' => 'menunggu',
            'diajukan_at' => now(),
        ];

        $pertama = Izin::create($atribut);
        $kedua = Izin::create($atribut);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson('/api/saya/izin')
            ->assertOk();

        $this->assertSame([$kedua->id, $pertama->id], array_column($res->json('data'), 'id'));
    }

    public function test_kuota_memakai_tahun_berjalan_tanpa_membatasi_riwayat(): void
    {
        $this->magang->update(['masuk_kerja' => '2025-01-06']);

        foreach (['2025-10-28', '2026-10-28', '2027-10-28'] as $tanggal) {
            Izin::create([
                'pengguna_id' => $this->magang->id,
                'jenis' => 'cuti',
                'mulai' => $tanggal,
                'selesai' => $tanggal,
                'alasan' => 'Cuti tahunan',
                'status' => 'menunggu',
                'diajukan_at' => Carbon::parse($tanggal.' 09:00:00', 'Asia/Jakarta'),
            ]);
        }

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson('/api/saya/izin')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('kuota', [
                'jatah' => 12,
                'terpakai' => 0,
                'menunggu' => 1,
                'sisa' => 11,
            ]);
    }

    public function test_tanpa_pengajuan_mendapat_daftar_kosong_dan_kuota_utuh(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson('/api/saya/izin')
            ->assertOk()
            ->assertExactJson([
                'data' => [],
                'kuota' => [
                    'jatah' => 12,
                    'terpakai' => 0,
                    'menunggu' => 0,
                    'sisa' => 12,
                ],
            ]);
    }

    public function test_daftar_izin_wajib_login(): void
    {
        $this->flushHeaders()
            ->getJson('/api/saya/izin')
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');
    }

    public function test_magang_mengajukan_cuti_tanpa_memercayai_pemilik_dan_keputusan_kiriman(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 0);
        $this->buatIzin('2026-10-26', '2026-10-27', 'menunggu', $lain);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin?pengguna_id='.$lain->id, $this->pengajuan([
                'pengguna_id' => $lain->id,
                'alasan' => '  Keperluan keluarga  ',
                'status' => 'disetujui',
                'hari_kerja' => 99,
                'diajukan_at' => '2000-01-01 00:00:00',
                'catatan_admin' => 'Disetujui sendiri',
                'diputuskan_at' => '2000-01-01 00:00:00',
                'diputuskan_oleh' => $lain->id,
            ]))
            ->assertCreated()
            ->assertJsonPath('pengguna_id', $this->magang->id)
            ->assertJsonPath('nama', 'Magang Uji')
            ->assertJsonPath('nip', 'MGG001')
            ->assertJsonPath('divisi', 'Pendataan')
            ->assertJsonPath('status', 'menunggu')
            ->assertJsonPath('jenis', 'cuti')
            ->assertJsonPath('mulai', '2026-10-26')
            ->assertJsonPath('selesai', '2026-10-27')
            ->assertJsonPath('alasan', 'Keperluan keluarga')
            ->assertJsonPath('hari_kerja', 2)
            ->assertJsonPath('diajukan', '2026-10-21T12:00:00+07:00')
            ->assertJsonPath('catatan_admin', null)
            ->assertJsonPath('diputuskan', null);

        $this->assertDatabaseHas('izin', [
            'id' => $res->json('id'),
            'pengguna_id' => $this->magang->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-26 00:00:00',
            'selesai' => '2026-10-27 00:00:00',
            'alasan' => 'Keperluan keluarga',
            'status' => 'menunggu',
            'diajukan_at' => '2026-10-21 12:00:00',
            'catatan_admin' => null,
            'diputuskan_at' => null,
            'diputuskan_oleh' => null,
        ]);
        $this->assertDatabaseCount('izin', 2);
    }

    #[DataProvider('jenisTanpaKuota')]
    public function test_izin_dan_sakit_tetap_diterima_dengan_kuota_nol(string $jenis): void
    {
        $this->magang->update(['cuti_kuota' => 0]);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['jenis' => $jenis]))
            ->assertCreated()
            ->assertJsonPath('jenis', $jenis)
            ->assertJsonPath('hari_kerja', 2)
            ->assertJsonPath('status', 'menunggu');

        $this->getJson('/api/saya/izin')->assertOk()->assertJsonPath('kuota', [
            'jatah' => 0, 'terpakai' => 0, 'menunggu' => 0, 'sisa' => 0,
        ]);
    }

    public static function jenisTanpaKuota(): array
    {
        return [['izin'], ['sakit']];
    }

    public function test_pengajuan_wajib_login(): void
    {
        $this->postJson('/api/saya/izin', $this->pengajuan())
            ->assertUnauthorized()
            ->assertJsonPath('kode', 'sesi_habis');

        $this->assertDatabaseCount('izin', 0);
    }

    #[DataProvider('isianTidakValid')]
    public function test_isian_tidak_valid_menghasilkan_422_bahasa_indonesia(array $isian, string $kolom, string $pesan): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan($isian))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($kolom)
            ->assertJsonPath('errors.'.$kolom.'.0', $pesan)
            ->assertJsonPath('message', 'Data pengajuan tidak valid.');

        $this->assertDatabaseCount('izin', 0);
    }

    public static function isianTidakValid(): array
    {
        return [
            'jenis asing' => [['jenis' => 'libur'], 'jenis', 'Jenis pengajuan harus cuti, izin, atau sakit.'],
            'jenis array' => [['jenis' => ['cuti']], 'jenis', 'Jenis pengajuan harus berupa teks.'],
            'mulai array' => [['mulai' => ['2026-10-26']], 'mulai', 'Tanggal mulai harus berupa teks.'],
            'selesai array' => [['selesai' => ['2026-10-27']], 'selesai', 'Tanggal selesai harus berupa teks.'],
            'alasan array' => [['alasan' => ['Urusan keluarga']], 'alasan', 'Alasan harus berupa teks.'],
            'alasan array kosong' => [['alasan' => []], 'alasan', 'Alasan wajib diisi.'],
            'jenis kosong' => [['jenis' => '  '], 'jenis', 'Jenis pengajuan wajib dipilih.'],
            'mulai kosong' => [['mulai' => '  '], 'mulai', 'Tanggal mulai wajib diisi.'],
            'selesai kosong' => [['selesai' => '  '], 'selesai', 'Tanggal selesai wajib diisi.'],
            'alasan kosong' => [['alasan' => " \t\n "], 'alasan', 'Alasan wajib diisi.'],
            'alasan null' => [['alasan' => null], 'alasan', 'Alasan wajib diisi.'],
            'alasan angka' => [['alasan' => 12345], 'alasan', 'Alasan harus berupa teks.'],
            'jenis boolean' => [['jenis' => true], 'jenis', 'Jenis pengajuan harus berupa teks.'],
            'mulai angka' => [['mulai' => 20261026], 'mulai', 'Tanggal mulai harus berupa teks.'],
            'selesai boolean' => [['selesai' => true], 'selesai', 'Tanggal selesai harus berupa teks.'],
            'format mulai' => [['mulai' => '26-10-2026'], 'mulai', 'Tanggal mulai harus berbentuk YYYY-MM-DD.'],
            'tanggal mustahil' => [['mulai' => '2026-02-30'], 'mulai', 'Tanggal mulai harus berbentuk YYYY-MM-DD.'],
            'bukan tahun kabisat' => [['selesai' => '2027-02-29'], 'selesai', 'Tanggal selesai harus berbentuk YYYY-MM-DD.'],
            'bulan tidak sah' => [['selesai' => '2026-13-01'], 'selesai', 'Tanggal selesai harus berbentuk YYYY-MM-DD.'],
            'waktu ikut terkirim' => [['selesai' => '2026-10-27T00:00:00'], 'selesai', 'Tanggal selesai harus berbentuk YYYY-MM-DD.'],
            'rentang terbalik' => [['selesai' => '2026-10-25'], 'selesai', 'Tanggal selesai tidak boleh sebelum tanggal mulai.'],
            'alasan pendek setelah trim' => [['alasan' => '  abc  '], 'alasan', 'Alasan minimal 4 karakter.'],
            'alasan terlalu panjang' => [['alasan' => str_repeat('a', 501)], 'alasan', 'Alasan maksimal 500 karakter.'],
        ];
    }

    public function test_kolom_wajib_dan_ringkasan_banyak_galat_tetap_bahasa_indonesia(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', [])
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'Data pengajuan tidak valid.',
                'errors' => [
                    'jenis' => ['Jenis pengajuan wajib dipilih.'],
                    'mulai' => ['Tanggal mulai wajib diisi.'],
                    'selesai' => ['Tanggal selesai wajib diisi.'],
                    'alasan' => ['Alasan wajib diisi.'],
                ],
            ]);

        $this->assertDatabaseCount('izin', 0);
    }

    public function test_pengajuan_yang_seluruhnya_lewat_ditolak(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2026-10-19', 'selesai' => '2026-10-20']))
            ->assertUnprocessable()
            ->assertJsonPath('kode', 'tanggal_lewat');

        $this->assertDatabaseCount('izin', 0);
    }

    public function test_sakit_mulai_kemarin_sampai_hari_ini_diterima(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan([
                'jenis' => 'sakit', 'mulai' => '2026-10-20', 'selesai' => '2026-10-21',
            ]))
            ->assertCreated()
            ->assertJsonPath('hari_kerja', 2);
    }

    public function test_akhir_pekan_dan_libur_saja_ditolak_tanpa_hari_kerja(): void
    {
        HariLibur::create(['tanggal' => '2026-10-26', 'keterangan' => 'Libur Uji']);
        $this->withHeader('Authorization', 'Bearer '.$this->token());

        foreach ([['2026-10-24', '2026-10-25'], ['2026-10-26', '2026-10-26']] as [$mulai, $selesai]) {
            $this->postJson('/api/saya/izin', $this->pengajuan(['mulai' => $mulai, 'selesai' => $selesai]))
                ->assertUnprocessable()
                ->assertJsonPath('kode', 'tanpa_hari_kerja');
        }

        $this->assertDatabaseCount('izin', 0);
    }

    #[DataProvider('batasAbsen')]
    public function test_absen_masuk_atau_pulang_di_batas_hari_kerja_menghalangi(string $mulai, string $selesai, string $tanggal, string $tipe): void
    {
        $this->buatAbsen($tanggal, $tipe);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => $mulai, 'selesai' => $selesai]))
            ->assertConflict()
            ->assertJsonPath('kode', 'bentrok_absen');

        $this->assertDatabaseCount('izin', 0);
    }

    public static function batasAbsen(): array
    {
        return [
            'sehari masuk' => ['2026-10-26', '2026-10-26', '2026-10-26', 'masuk'],
            'sehari pulang' => ['2026-10-26', '2026-10-26', '2026-10-26', 'pulang'],
            'awal masuk' => ['2026-10-26', '2026-10-27', '2026-10-26', 'masuk'],
            'akhir masuk' => ['2026-10-26', '2026-10-27', '2026-10-27', 'masuk'],
            'akhir pulang' => ['2026-10-26', '2026-10-27', '2026-10-27', 'pulang'],
        ];
    }

    public function test_absen_libur_akhir_pekan_di_luar_rentang_dan_milik_orang_lain_tidak_menghalangi(): void
    {
        $lain = $this->buatPengguna('MGG002', 'Magang Lain', 12);
        HariLibur::create(['tanggal' => '2026-10-26', 'keterangan' => 'Libur Uji']);
        $this->buatAbsen('2026-10-23');
        $this->buatAbsen('2026-10-24');
        $this->buatAbsen('2026-10-26');
        $this->buatAbsen('2026-10-27', 'masuk', $lain);
        $this->buatAbsen('2026-10-28');

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2026-10-24']))
            ->assertCreated()
            ->assertJsonPath('hari_kerja', 1);
    }

    #[DataProvider('batasIzin')]
    public function test_pengajuan_aktif_yang_bersinggungan_inklusif_menghalangi(string $mulai, string $selesai, string $status): void
    {
        $this->buatIzin('2026-10-26', '2026-10-27', $status);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['jenis' => 'izin', 'mulai' => $mulai, 'selesai' => $selesai]))
            ->assertConflict()
            ->assertJsonPath('kode', 'bentrok_izin');

        $this->assertDatabaseCount('izin', 1);
    }

    public static function batasIzin(): array
    {
        return [
            'mulai menunggu' => ['2026-10-23', '2026-10-26', 'menunggu'],
            'selesai menunggu' => ['2026-10-27', '2026-10-28', 'menunggu'],
            'sehari menunggu' => ['2026-10-26', '2026-10-26', 'menunggu'],
            'mulai disetujui' => ['2026-10-23', '2026-10-26', 'disetujui'],
            'selesai disetujui' => ['2026-10-27', '2026-10-28', 'disetujui'],
            'sehari disetujui' => ['2026-10-26', '2026-10-26', 'disetujui'],
        ];
    }

    public function test_pengajuan_ditolak_dan_tanggal_bersebelahan_tidak_menghalangi(): void
    {
        $this->buatIzin('2026-10-26', '2026-10-27', 'ditolak');
        $this->buatIzin('2026-10-23', '2026-10-25');
        $this->buatIzin('2026-10-28', '2026-10-29', 'disetujui');

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan())
            ->assertCreated();
    }

    public function test_cuti_melebihi_sisa_ditolak(): void
    {
        $this->magang->update(['cuti_kuota' => 1]);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan())
            ->assertUnprocessable()
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Anda 1 hari, sedangkan yang diajukan 2 hari.');

        $this->assertDatabaseCount('izin', 0);
    }

    public function test_pengajuan_menunggu_mencadangkan_kuota_untuk_pengajuan_berikutnya(): void
    {
        $this->magang->update(['cuti_kuota' => 2]);
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan())
            ->assertCreated();

        $this->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2026-10-28', 'selesai' => '2026-10-28']))
            ->assertUnprocessable()
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Anda 0 hari, sedangkan yang diajukan 1 hari.');

        $this->assertDatabaseCount('izin', 1);
    }

    public function test_cuti_lintas_tahun_dibagi_bukan_dijumlah_ke_satu_jatah(): void
    {
        $this->magang->update(['cuti_kuota' => 2]);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2026-12-31', 'selesai' => '2027-01-04']))
            ->assertCreated()
            ->assertJsonPath('hari_kerja', 3);

        $this->getJson('/api/saya/izin')->assertOk()->assertJsonPath('kuota', [
            'jatah' => 2, 'terpakai' => 0, 'menunggu' => 1, 'sisa' => 1,
        ]);
    }

    #[DataProvider('tahunKuotaHabis')]
    public function test_cuti_lintas_tahun_ditolak_jika_salah_satu_tahun_kehabisan_kuota(string $mulai, string $selesai, int $jumlah): void
    {
        $this->magang->update(['cuti_kuota' => 2]);
        $this->buatIzin($mulai, $selesai);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2026-12-31', 'selesai' => '2027-01-04']))
            ->assertUnprocessable()
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', "Sisa cuti Anda 0 hari, sedangkan yang diajukan {$jumlah} hari.");

        $this->assertDatabaseCount('izin', 1);
    }

    public static function tahunKuotaHabis(): array
    {
        return [
            'tahun awal' => ['2026-11-02', '2026-11-03', 1],
            'tahun akhir' => ['2027-01-06', '2027-01-07', 2],
        ];
    }

    public function test_cuti_seluruhnya_tahun_depan_tidak_boleh_melebihi_sisa_tahun_itu(): void
    {
        $this->magang->update(['cuti_kuota' => 2]);
        $this->buatIzin('2027-01-06', '2027-01-06');

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2027-01-04', 'selesai' => '2027-01-05']))
            ->assertUnprocessable()
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Anda 1 hari, sedangkan yang diajukan 2 hari.');

        $this->assertDatabaseCount('izin', 1);
    }

    public function test_cuti_tahun_depan_tetap_bisa_diajukan_meski_kuota_tahun_ini_habis(): void
    {
        $this->magang->update(['cuti_kuota' => 1]);
        $this->buatIzin('2026-10-26', '2026-10-26');

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', $this->pengajuan(['mulai' => '2027-01-04', 'selesai' => '2027-01-04']))
            ->assertCreated()
            ->assertJsonPath('hari_kerja', 1);
    }

    #[DataProvider('perubahanProfil')]
    public function test_kuota_memakai_pengguna_terbaru_setelah_autentikasi(array $awal, array $terbaru): void
    {
        $this->magang->update($awal);
        $token = $this->token();
        $penggunaId = $this->magang->id;

        // TokenAuth sudah memuat pengguna sebelum menyimpan last_used_at sesi.
        // Simulasikan perubahan admin di sela autentikasi dan pembacaan terkunci.
        Event::listen('eloquent.saving: '.Sesi::class, function (Sesi $sesi) use ($penggunaId, $terbaru): void {
            if ($sesi->pengguna_id === $penggunaId) {
                Pengguna::whereKey($penggunaId)->update($terbaru);
            }
        });

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', $this->pengajuan())
            ->assertUnprocessable()
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Anda 1 hari, sedangkan yang diajukan 2 hari.');

        $this->assertDatabaseCount('izin', 0);
    }

    public static function perubahanProfil(): array
    {
        return [
            'jatah berubah' => [['cuti_kuota' => 12], ['cuti_kuota' => 1]],
            'masuk kerja berubah' => [
                ['cuti_kuota' => 1, 'masuk_kerja' => '2026-10-27'],
                ['masuk_kerja' => '2026-10-26'],
            ],
        ];
    }

    private function pengajuan(array $atribut = []): array
    {
        return array_replace([
            'jenis' => 'cuti',
            'mulai' => '2026-10-26',
            'selesai' => '2026-10-27',
            'alasan' => 'Keperluan keluarga',
        ], $atribut);
    }

    private function buatIzin(string $mulai, string $selesai, string $status = 'menunggu', ?Pengguna $pengguna = null): Izin
    {
        return Izin::create([
            'pengguna_id' => ($pengguna ?? $this->magang)->id,
            'jenis' => 'cuti',
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Pengajuan sebelumnya',
            'status' => $status,
            'diajukan_at' => now(),
        ]);
    }

    private function buatAbsen(string $tanggal, string $tipe = 'masuk', ?Pengguna $pengguna = null): Absen
    {
        $pengguna ??= $this->magang;

        return Absen::create([
            'pengguna_id' => $pengguna->id,
            'tanggal' => $tanggal,
            'tipe' => $tipe,
            'waktu' => Carbon::parse($tanggal.($tipe === 'masuk' ? ' 08:00:00' : ' 17:00:00'), 'Asia/Jakarta'),
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

    private function buatPengguna(string $nip, string $nama, int $jatah): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => $jatah,
            'aktif' => true,
        ]);
    }

    private function token(): string
    {
        return $this->flushHeaders()->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
