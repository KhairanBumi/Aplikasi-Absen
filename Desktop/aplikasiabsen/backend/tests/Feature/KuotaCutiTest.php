<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use App\Support\Harian;
use App\Support\KuotaCuti;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class KuotaCutiTest extends TestCase
{
    use RefreshDatabase;

    private Pengguna $magang;

    private Lokasi $lokasi;

    private Shift $shift;

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

        $this->magang = $this->buatPengguna('MGG001', '2026-01-05', 12);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_kuota_hanya_memotong_cuti_disetujui_dan_menunggu(): void
    {
        $this->izin('cuti', '2026-10-26', '2026-10-27', 'disetujui');
        $this->izin('cuti', '2026-10-28', '2026-10-30', 'menunggu');
        $this->izin('cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->absen('2026-10-22');
        $this->izin('izin', '2026-10-19', '2026-10-20', 'disetujui');
        $this->izin('sakit', '2026-10-19', '2026-10-20', 'menunggu');
        $this->izin('sakit', '2026-10-21', '2026-10-21', 'disetujui');
        $this->izin('izin', '2026-10-21', '2026-10-21', 'menunggu');
        $this->izin('cuti', '2026-10-19', '2026-10-20', 'ditolak');
        $this->izin('cuti', '2027-01-04', '2027-01-05', 'disetujui');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 3, 'menunggu' => 3, 'sisa' => 6,
        ], KuotaCuti::rekap($this->magang));
    }

    public function test_kecuali_izin_id_mengeluarkan_hanya_pengajuan_tersebut(): void
    {
        $menunggu = $this->izin('cuti', '2026-10-26', '2026-10-27', 'menunggu');
        $this->izin('cuti', '2026-10-28', '2026-10-28', 'menunggu');
        $disetujui = $this->izin('cuti', '2027-01-04', '2027-01-05', 'disetujui');
        $this->izin('cuti', '2027-01-06', '2027-01-06', 'menunggu');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 0, 'menunggu' => 1, 'sisa' => 11,
        ], KuotaCuti::rekap($this->magang, $menunggu->id));
        $this->assertSame(3, KuotaCuti::rekap($this->magang)['menunggu']);
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 0, 'menunggu' => 1, 'sisa' => 11,
        ], KuotaCuti::rekap($this->magang, $disetujui->id, 2027));
        $this->assertSame(2, KuotaCuti::rekap($this->magang, null, 2027)['terpakai']);
    }

    public function test_daftar_hari_kerja_mengecualikan_akhir_pekan_dan_libur(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);
        $dari = Carbon::parse('2026-10-19', 'Asia/Jakarta');
        $sampai = Carbon::parse('2026-10-25', 'Asia/Jakarta');

        $this->assertSame([
            '2026-10-19', '2026-10-21', '2026-10-22', '2026-10-23',
        ], Harian::tanggalHariKerja($dari, $sampai));
        $this->assertSame(4, Harian::hitungHariKerja($dari, $sampai));
    }

    public function test_libur_di_kedua_batas_dan_rentang_sehari_tetap_dikecualikan(): void
    {
        HariLibur::create(['tanggal' => '2026-10-19', 'keterangan' => 'Libur Awal']);
        HariLibur::create(['tanggal' => '2026-10-23', 'keterangan' => 'Libur Akhir']);
        $dari = Carbon::parse('2026-10-19', 'Asia/Jakarta');
        $sampai = Carbon::parse('2026-10-23', 'Asia/Jakarta');

        $this->assertSame([
            '2026-10-20', '2026-10-21', '2026-10-22',
        ], Harian::tanggalHariKerja($dari, $sampai));
        $this->assertSame([], Harian::tanggalHariKerja($dari, $dari));
        $this->assertSame([], Harian::tanggalHariKerja($sampai, $sampai));
    }

    public function test_hitungan_hari_kerja_tidak_memasukkan_libur_pada_batas_akhir(): void
    {
        HariLibur::create(['tanggal' => '2026-10-23', 'keterangan' => 'Libur Akhir']);

        $this->assertSame(1, Harian::hitungHariKerja(
            Carbon::parse('2026-10-22', 'Asia/Jakarta'),
            Carbon::parse('2026-10-23', 'Asia/Jakarta')
        ));
    }

    public function test_rentang_terbalik_dan_akhir_pekan_tidak_memiliki_hari_kerja(): void
    {
        $sabtu = Carbon::parse('2026-10-24', 'Asia/Jakarta');
        $minggu = Carbon::parse('2026-10-25', 'Asia/Jakarta');

        $this->assertSame([], Harian::tanggalHariKerja($minggu, $sabtu));
        $this->assertSame([], Harian::tanggalHariKerja($sabtu, $minggu));
        $this->assertSame(0, Harian::hitungHariKerja($minggu, $sabtu));
        $this->assertSame(0, Harian::hitungHariKerja($sabtu, $minggu));
        $this->assertSame([], KuotaCuti::tanggalDalamKuota($this->magang, $minggu, $sabtu));
    }

    public function test_tanggal_inklusif_tanpa_memutasi_argumen_carbon(): void
    {
        $dari = Carbon::parse('2026-10-22 17:30:00', 'Asia/Jakarta');
        $sampai = Carbon::parse('2026-10-23 08:15:00', 'Asia/Jakarta');
        $sebelum = [$dari->copy(), $sampai->copy()];

        $this->assertSame(['2026-10-22', '2026-10-23'], Harian::tanggalHariKerja($dari, $sampai));
        $this->assertSame(2, Harian::hitungHariKerja($dari, $sampai));
        $this->assertSame(['2026-10-22', '2026-10-23'], KuotaCuti::tanggalDalamKuota($this->magang, $dari, $sampai));
        $this->assertEquals($sebelum, [$dari, $sampai]);
    }

    public function test_cuti_lintas_tahun_dibagi_ke_masing_masing_tahun(): void
    {
        $mulai = Carbon::parse('2026-12-30', 'Asia/Jakarta');
        $selesai = Carbon::parse('2027-01-05', 'Asia/Jakarta');
        $sebelum = [$mulai->copy(), $selesai->copy()];
        $this->izin('cuti', '2026-12-30', '2027-01-05', 'disetujui');
        $this->izin('cuti', '2026-12-31', '2027-01-04', 'menunggu');

        $this->assertSame(['2026-12-30', '2026-12-31'], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai));
        $this->assertSame(['2027-01-01', '2027-01-04', '2027-01-05'], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai, 2027));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 2, 'menunggu' => 1, 'sisa' => 9,
        ], KuotaCuti::rekap($this->magang, null, null));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 3, 'menunggu' => 2, 'sisa' => 7,
        ], KuotaCuti::rekap($this->magang, null, 2027));
        $this->assertEquals($sebelum, [$mulai, $selesai]);
    }

    public function test_cuti_seluruhnya_tahun_depan_tetap_memiliki_kuota_sendiri(): void
    {
        $this->izin('cuti', '2027-01-04', '2027-01-05', 'disetujui');
        $this->izin('cuti', '2027-01-06', '2027-01-08', 'menunggu');
        $this->izin('cuti', '2028-01-03', '2028-01-07', 'menunggu');
        $mulai = Carbon::parse('2027-01-04', 'Asia/Jakarta');
        $selesai = Carbon::parse('2027-01-05', 'Asia/Jakarta');

        $this->assertSame([], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai, null));
        $this->assertSame(['2027-01-04', '2027-01-05'], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai, 2027));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 0, 'menunggu' => 0, 'sisa' => 12,
        ], KuotaCuti::rekap($this->magang));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 2, 'menunggu' => 3, 'sisa' => 7,
        ], KuotaCuti::rekap($this->magang, null, 2027));
    }

    public function test_tahun_lampau_eksplisit_dan_default_mengikuti_tahun_sekarang(): void
    {
        $this->magang->update(['masuk_kerja' => '2025-01-01']);
        $this->izin('cuti', '2025-12-31', '2026-01-02', 'disetujui');

        $this->assertSame(['2025-12-31'], KuotaCuti::tanggalDalamKuota(
            $this->magang,
            Carbon::parse('2025-12-31', 'Asia/Jakarta'),
            Carbon::parse('2026-01-02', 'Asia/Jakarta'),
            2025
        ));
        $this->assertSame(1, KuotaCuti::rekap($this->magang, null, 2025)['terpakai']);
        $this->assertSame(2, KuotaCuti::rekap($this->magang)['terpakai']);

        Carbon::setTestNow(Carbon::parse('2025-12-15 12:00:00', 'Asia/Jakarta'));

        $this->assertSame(1, KuotaCuti::rekap($this->magang, null, null)['terpakai']);
    }

    public function test_batas_masuk_kerja_inklusif_berlaku_pada_cuti_dan_cadangan(): void
    {
        $this->magang->update(['masuk_kerja' => '2026-10-21']);
        $this->izin('cuti', '2026-10-19', '2026-10-23', 'disetujui');
        $this->izin('cuti', '2026-10-19', '2026-10-21', 'menunggu');
        $mulai = Carbon::parse('2026-10-19', 'Asia/Jakarta');
        $selesai = Carbon::parse('2026-10-23', 'Asia/Jakarta');
        $sebelum = [$mulai->copy(), $selesai->copy(), $this->magang->masuk_kerja->copy()];

        $this->assertSame(['2026-10-21', '2026-10-22', '2026-10-23'], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 3, 'menunggu' => 1, 'sisa' => 8,
        ], KuotaCuti::rekap($this->magang));
        $this->assertEquals($sebelum, [$mulai, $selesai, $this->magang->masuk_kerja]);
    }

    public function test_masuk_kerja_tahun_depan_tidak_bocor_ke_tahun_lain(): void
    {
        $this->magang->update(['masuk_kerja' => '2027-01-05']);
        $this->izin('cuti', '2026-12-31', '2027-01-06', 'disetujui');
        $this->izin('cuti', '2026-12-31', '2027-01-05', 'menunggu');
        $mulai = Carbon::parse('2026-12-31', 'Asia/Jakarta');
        $selesai = Carbon::parse('2027-01-06', 'Asia/Jakarta');

        $this->assertSame([], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai));
        $this->assertSame(['2027-01-05', '2027-01-06'], KuotaCuti::tanggalDalamKuota($this->magang, $mulai, $selesai, 2027));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 0, 'menunggu' => 0, 'sisa' => 12,
        ], KuotaCuti::rekap($this->magang));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 2, 'menunggu' => 1, 'sisa' => 9,
        ], KuotaCuti::rekap($this->magang, null, 2027));
        $this->assertSame(['2028-01-03'], KuotaCuti::tanggalDalamKuota(
            $this->magang,
            Carbon::parse('2028-01-03', 'Asia/Jakarta'),
            Carbon::parse('2028-01-03', 'Asia/Jakarta'),
            2028
        ));
    }

    public function test_masuk_kerja_tahun_lalu_memakai_awal_tahun_dan_batas_izin_inklusif(): void
    {
        $this->magang->update(['masuk_kerja' => '2025-01-01']);
        $this->izin('cuti', '2025-12-31', '2026-01-01', 'disetujui');
        $this->izin('cuti', '2026-01-01', '2026-01-01', 'menunggu');

        $this->assertSame(['2026-01-01'], KuotaCuti::tanggalDalamKuota(
            $this->magang,
            Carbon::parse('2025-12-31', 'Asia/Jakarta'),
            Carbon::parse('2026-01-01', 'Asia/Jakarta')
        ));
        $this->assertSame([
            'jatah' => 12, 'terpakai' => 1, 'menunggu' => 1, 'sisa' => 10,
        ], KuotaCuti::rekap($this->magang));

        $this->absen('2026-01-01');

        $this->assertSame(0, KuotaCuti::rekap($this->magang)['terpakai']);
    }

    public function test_izin_dan_absen_pada_31_desember_tetap_terbaca(): void
    {
        $this->izin('cuti', '2026-12-31', '2026-12-31', 'disetujui');
        $this->izin('cuti', '2026-12-31', '2026-12-31', 'menunggu');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 1, 'menunggu' => 1, 'sisa' => 10,
        ], KuotaCuti::rekap($this->magang));

        $this->absen('2026-12-31');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 0, 'menunggu' => 1, 'sisa' => 11,
        ], KuotaCuti::rekap($this->magang));
    }

    public function test_hanya_absen_masuk_menghapus_terpakai_bukan_cadangan(): void
    {
        $this->izin('cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->izin('cuti', '2026-10-22', '2026-10-23', 'menunggu');
        $this->absen('2026-10-22');
        $this->absen('2026-10-22', 'pulang');
        $this->absen('2026-10-23', 'pulang');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 1, 'menunggu' => 2, 'sisa' => 9,
        ], KuotaCuti::rekap($this->magang));
    }

    public function test_pengajuan_dan_absen_pengguna_lain_tidak_bocor(): void
    {
        $lain = $this->buatPengguna('MGG002', '2026-01-01', 5);
        $this->izin('cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->izin('cuti', '2026-10-26', '2026-10-27', 'menunggu');
        $this->izin('cuti', '2026-10-19', '2026-10-21', 'disetujui', $lain);
        $this->izin('cuti', '2026-10-28', '2026-10-30', 'menunggu', $lain);
        $this->absen('2026-10-22', 'masuk', $lain);

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 2, 'menunggu' => 2, 'sisa' => 8,
        ], KuotaCuti::rekap($this->magang));
        $this->assertSame([
            'jatah' => 5, 'terpakai' => 3, 'menunggu' => 3, 'sisa' => -1,
        ], KuotaCuti::rekap($lain));
    }

    public function test_tanggal_tumpang_tindih_dihitung_unik_per_status(): void
    {
        $this->izin('cuti', '2026-10-19', '2026-10-21', 'disetujui');
        $this->izin('cuti', '2026-10-20', '2026-10-22', 'disetujui');
        $this->izin('cuti', '2026-10-22', '2026-10-23', 'menunggu');
        $this->izin('cuti', '2026-10-23', '2026-10-26', 'menunggu');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 4, 'menunggu' => 3, 'sisa' => 5,
        ], KuotaCuti::rekap($this->magang));
    }

    public function test_libur_dan_akhir_pekan_tidak_memotong_atau_mencadangkan_kuota(): void
    {
        HariLibur::create(['tanggal' => '2026-10-19', 'keterangan' => 'Libur Awal']);
        HariLibur::create(['tanggal' => '2026-10-23', 'keterangan' => 'Libur Akhir']);
        $this->izin('cuti', '2026-10-19', '2026-10-23', 'disetujui');
        $this->izin('cuti', '2026-10-19', '2026-10-25', 'menunggu');

        $this->assertSame([
            'jatah' => 12, 'terpakai' => 3, 'menunggu' => 3, 'sisa' => 6,
        ], KuotaCuti::rekap($this->magang));
    }

    public function test_jatah_nol_tetap_nol_dan_sisa_tidak_dibatasi(): void
    {
        $this->magang->update(['cuti_kuota' => 0]);

        $this->assertSame([
            'jatah' => 0, 'terpakai' => 0, 'menunggu' => 0, 'sisa' => 0,
        ], KuotaCuti::rekap($this->magang));

        $this->izin('cuti', '2026-10-22', '2026-10-22', 'disetujui');
        $this->izin('cuti', '2026-10-23', '2026-10-23', 'menunggu');

        $this->assertSame([
            'jatah' => 0, 'terpakai' => 1, 'menunggu' => 1, 'sisa' => -2,
        ], KuotaCuti::rekap($this->magang));
    }

    private function buatPengguna(string $nip, string $masukKerja, int $jatah): Pengguna
    {
        return Pengguna::create([
            'nama' => 'Magang '.$nip,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => $masukKerja,
            'cuti_kuota' => $jatah,
            'aktif' => true,
        ]);
    }

    private function izin(string $jenis, string $mulai, string $selesai, string $status, ?Pengguna $pengguna = null): Izin
    {
        return Izin::create([
            'pengguna_id' => ($pengguna ?? $this->magang)->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function absen(string $tanggal, string $tipe = 'masuk', ?Pengguna $pengguna = null): Absen
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
}
