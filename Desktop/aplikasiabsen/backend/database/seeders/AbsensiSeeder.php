<?php

namespace Database\Seeders;

use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PerangkatKiosk;
use App\Models\Shift;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class AbsensiSeeder extends Seeder
{
    public function run(): void
    {
        $seed = config('absensi.seed');
        $adminNip = $seed['admin_nip'];
        $adminPin = $seed['admin_pin'];

        if (! $adminNip || ! $adminPin) {
            throw new RuntimeException(
                'Isi ADMIN_NIP dan ADMIN_PIN di .env sebelum menjalankan seeder.'
            );
        }

        $lokasi = Lokasi::updateOrCreate(
            ['nama' => $seed['lokasi_nama']],
            [
                'alamat' => $seed['lokasi_alamat'],
                'lintang' => $seed['lokasi_lintang'],
                'bujur' => $seed['lokasi_bujur'],
                'radius_m' => $seed['lokasi_radius_m'],
                'aktif' => true,
            ]
        );

        $shift = Shift::updateOrCreate(
            ['nama' => $seed['shift_nama']],
            [
                'masuk' => $seed['shift_masuk'],
                'pulang' => $seed['shift_pulang'],
                'toleransi_menit' => $seed['shift_toleransi'],
                'aktif' => true,
            ]
        );

        $divisi = in_array($seed['admin_divisi'], config('absensi.divisi'), true)
            ? $seed['admin_divisi']
            : 'Management Data';

        Pengguna::updateOrCreate(
            ['nip' => strtoupper(trim($adminNip))],
            [
                'nama' => $seed['admin_nama'],
                'email' => $seed['admin_email'] ?: null,
                'nik' => null,
                'pin_hash' => Hash::make((string) $adminPin),
                'peran' => 'admin',
                'divisi' => $divisi,
                'shift_id' => $shift->id,
                'lokasi_id' => $lokasi->id,
                'masuk_kerja' => now()->toDateString(),
                'cuti_kuota' => 12,
                'aktif' => true,
            ]
        );

        PerangkatKiosk::updateOrCreate(
            ['id' => $seed['kiosk_id']],
            [
                'nama' => $seed['kiosk_nama'],
                'lokasi_id' => $lokasi->id,
                'aktif' => true,
            ]
        );

        $tahun = now()->year;

        $hariLibur = [
            "{$tahun}-01-01" => 'Tahun Baru Masehi',
            "{$tahun}-05-01" => 'Hari Buruh Internasional',
            "{$tahun}-06-01" => 'Hari Lahir Pancasila',
            "{$tahun}-08-17" => 'Hari Kemerdekaan Republik Indonesia',
            "{$tahun}-12-25" => 'Hari Raya Natal',
        ];

        foreach ($hariLibur as $tanggal => $keterangan) {
            HariLibur::updateOrCreate(['tanggal' => $tanggal], ['keterangan' => $keterangan]);
        }
    }
}
