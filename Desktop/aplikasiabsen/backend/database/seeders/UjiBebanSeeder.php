<?php

namespace Database\Seeders;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class UjiBebanSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'staging'])) {
            throw new RuntimeException('Seeder uji beban hanya untuk local/staging.');
        }

        $pin = (string) config('absensi.uji_beban_pin');

        if (strlen($pin) < 4 || strlen($pin) > 6 || ! ctype_digit($pin)) {
            throw new RuntimeException('Isi ABSEN_UJI_BEBAN_PIN dengan 4–6 angka di .env staging.');
        }

        $lokasi = Lokasi::firstOrCreate(
            ['nama' => 'Kantor Uji Beban'],
            [
                'alamat' => 'Jl. Uji Beban No. 1',
                'lintang' => -6.2246,
                'bujur' => 106.8094,
                'radius_m' => config('absensi.seed.lokasi_radius_m', 250),
                'aktif' => true,
            ]
        );

        $shift = Shift::firstOrCreate(
            ['nama' => 'Reguler Uji Beban'],
            ['masuk' => '08:00', 'pulang' => '17:00', 'toleransi_menit' => 15, 'aktif' => true]
        );

        $awal = now()->startOfMonth();
        $akhir = now();

        for ($i = 1; $i <= 50; $i++) {
            $nip = sprintf('UJI%03d', $i);

            $pengguna = Pengguna::updateOrCreate(
                ['nip' => $nip],
                [
                    'nama' => 'Magang Uji '.$i,
                    'pin_hash' => Hash::make($pin),
                    'peran' => 'magang',
                    'divisi' => 'Pendataan',
                    'shift_id' => $shift->id,
                    'lokasi_id' => $lokasi->id,
                    'masuk_kerja' => $awal->toDateString(),
                    'cuti_kuota' => 12,
                    'aktif' => true,
                ]
            );

            for ($hari = $awal->copy(); $hari->lessThanOrEqualTo($akhir); $hari->addDay()) {
                if ($hari->isWeekend()) {
                    continue;
                }

                $tanggal = $hari->toDateString();

                foreach (['masuk', 'pulang'] as $tipe) {
                    $waktu = $hari->copy()->setTime(
                        $tipe === 'masuk' ? 7 : 17,
                        $tipe === 'masuk' ? 45 + ($i % 20) : 5 + ($i % 20),
                        0
                    );

                    Absen::firstOrCreate(
                        [
                            'pengguna_id' => $pengguna->id,
                            'tanggal' => $tanggal,
                            'tipe' => $tipe,
                        ],
                        [
                            'waktu' => $waktu,
                            'lokasi_id' => $lokasi->id,
                            'mode' => 'kantor',
                            'shift_id' => $shift->id,
                            'telat_menit' => $tipe === 'masuk' ? max(0, ($i % 20) - 15) : 0,
                            'nama_salinan' => $pengguna->nama,
                            'nip_salinan' => $pengguna->nip,
                            'foto_path' => null,
                            'kiosk_id' => 'kiosk-uji-beban',
                            'ip' => '10.10.0.1',
                            'created_at' => $waktu,
                        ]
                    );
                }
            }
        }

        $this->command?->info('50 magang uji beban siap. PIN tidak ditampilkan.');
    }
}
