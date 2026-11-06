<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\Izin;
use App\Models\Pengguna;
use App\Support\Harian;
use App\Support\KuotaCuti;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SayaIzinController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $pengguna = $request->attributes->get('pengguna');

        $data = Izin::with('pengguna')
            ->where('pengguna_id', $pengguna->id)
            ->orderByDesc('diajukan_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Izin $izin) => $izin->apiArray())
            ->values();

        return response()->json([
            'data' => $data,
            'kuota' => KuotaCuti::rekap($pengguna),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (is_string($request->input('alasan'))) {
            $request->merge(['alasan' => trim($request->input('alasan'))]);
        }

        $validator = Validator::make($request->all(), [
            'jenis' => ['bail', 'required', 'string', Rule::in(Izin::JENIS)],
            'mulai' => ['bail', 'required', 'string', 'date_format:Y-m-d'],
            'selesai' => ['bail', 'required', 'string', 'date_format:Y-m-d'],
            'alasan' => ['bail', 'required', 'string', 'min:4', 'max:500'],
        ], [
            'jenis.required' => 'Jenis pengajuan wajib dipilih.',
            'jenis.string' => 'Jenis pengajuan harus berupa teks.',
            'jenis.in' => 'Jenis pengajuan harus cuti, izin, atau sakit.',
            'mulai.required' => 'Tanggal mulai wajib diisi.',
            'mulai.string' => 'Tanggal mulai harus berupa teks.',
            'mulai.date_format' => 'Tanggal mulai harus berbentuk YYYY-MM-DD.',
            'selesai.required' => 'Tanggal selesai wajib diisi.',
            'selesai.string' => 'Tanggal selesai harus berupa teks.',
            'selesai.date_format' => 'Tanggal selesai harus berbentuk YYYY-MM-DD.',
            'alasan.required' => 'Alasan wajib diisi.',
            'alasan.string' => 'Alasan harus berupa teks.',
            'alasan.min' => 'Alasan minimal 4 karakter.',
            'alasan.max' => 'Alasan maksimal 500 karakter.',
        ]);

        if ($validator->fails()) {
            return $this->galat('Data pengajuan tidak valid.', 422, null, $validator->errors()->toArray());
        }

        $data = $validator->validated();
        $pengguna = $request->attributes->get('pengguna');
        $mulai = Carbon::createFromFormat('!Y-m-d', $data['mulai']);
        $selesai = Carbon::createFromFormat('!Y-m-d', $data['selesai']);

        if ($selesai->lt($mulai)) {
            return $this->galat('Data pengajuan tidak valid.', 422, null, [
                'selesai' => ['Tanggal selesai tidak boleh sebelum tanggal mulai.'],
            ]);
        }

        if ($selesai->lt(now()->startOfDay())) {
            return $this->galat(
                'Pengajuan yang seluruh tanggalnya sudah lewat tidak bisa dikirim.',
                422,
                'tanggal_lewat'
            );
        }

        $hariKerja = array_fill_keys(Harian::tanggalHariKerja($mulai, $selesai), true);

        if ($hariKerja === []) {
            return $this->galat(
                'Rentang itu tidak memuat hari kerja. Sabtu, Minggu, dan hari libur tidak perlu diajukan.',
                422,
                'tanpa_hari_kerja'
            );
        }

        $hasil = DB::transaction(function () use ($pengguna, $data, $mulai, $selesai, $hariKerja) {
            // Pakai profil terbaru setelah menunggu kunci, bukan salinan dari autentikasi.
            $pengguna = Pengguna::whereKey($pengguna->id)->lockForUpdate()->firstOrFail();

            $sudahAbsen = Absen::where('pengguna_id', $pengguna->id)
                ->whereDate('tanggal', '>=', $mulai->toDateString())
                ->whereDate('tanggal', '<=', $selesai->toDateString())
                ->get(['tanggal'])
                ->contains(fn (Absen $absen) => isset($hariKerja[$absen->tanggal->format('Y-m-d')]));

            if ($sudahAbsen) {
                return ['galat' => [
                    'Anda sudah punya catatan absen pada hari kerja dalam rentang itu. Hari tersebut tidak bisa diajukan sebagai izin, sakit, atau cuti.',
                    409,
                    'bentrok_absen',
                ]];
            }

            $bentrok = Izin::where('pengguna_id', $pengguna->id)
                ->whereIn('status', ['menunggu', 'disetujui'])
                ->whereDate('mulai', '<=', $selesai->toDateString())
                ->whereDate('selesai', '>=', $mulai->toDateString())
                ->exists();

            if ($bentrok) {
                return ['galat' => [
                    'Anda masih punya pengajuan lain pada tanggal yang sama.',
                    409,
                    'bentrok_izin',
                ]];
            }

            if ($data['jenis'] === 'cuti') {
                for ($tahun = $mulai->year; $tahun <= $selesai->year; $tahun++) {
                    $jumlah = count(KuotaCuti::tanggalDalamKuota($pengguna, $mulai, $selesai, $tahun));
                    $kuota = KuotaCuti::rekap($pengguna, null, $tahun);

                    if ($jumlah > $kuota['sisa']) {
                        return ['galat' => [
                            "Sisa cuti Anda {$kuota['sisa']} hari, sedangkan yang diajukan {$jumlah} hari.",
                            422,
                            'kuota_tidak_cukup',
                        ]];
                    }
                }
            }

            return ['izin' => Izin::create([
                'pengguna_id' => $pengguna->id,
                'jenis' => $data['jenis'],
                'mulai' => $mulai->toDateString(),
                'selesai' => $selesai->toDateString(),
                'alasan' => $data['alasan'],
                'status' => 'menunggu',
                'diajukan_at' => now(),
            ])];
        });

        if (isset($hasil['galat'])) {
            return $this->galat($hasil['galat'][0], $hasil['galat'][1], $hasil['galat'][2]);
        }

        return response()->json($hasil['izin']->load('pengguna')->apiArray(), 201);
    }
}
