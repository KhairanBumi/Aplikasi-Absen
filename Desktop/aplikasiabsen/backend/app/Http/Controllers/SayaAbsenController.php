<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Pengguna;
use App\Support\Foto;
use App\Support\Geo;
use App\Support\Harian;
use App\Support\Nominatim;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SayaAbsenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bulan = $request->query->has('bulan')
            ? $request->query('bulan')
            : now()->format('Y-m');

        if (! is_string($bulan) || ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $bulan)) {
            return $this->galat('Bulan harus berbentuk YYYY-MM.', 422, 'bulan_tidak_valid');
        }

        $awal = Carbon::createFromFormat('!Y-m-d', $bulan.'-01')->startOfDay();

        return response()->json(
            Harian::susun($request->attributes->get('pengguna'), $awal)
        );
    }

    public function dinas(Request $request): JsonResponse
    {
        $pengguna = $this->magang($request);

        if ($pengguna instanceof JsonResponse) {
            return $pengguna;
        }

        $data = Absen::with(['pengguna', 'lokasi'])
            ->where('pengguna_id', $pengguna->id)
            ->whereNotNull('keterangan_dinas')
            ->orderByDesc('waktu')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Absen $absen) => $absen->apiArray())
            ->values();

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $pengguna = $this->magang($request);

        if ($pengguna instanceof JsonResponse) {
            return $pengguna;
        }

        $data = $request->validate([
            'foto' => ['required', 'string'],
            'lintang' => ['nullable', 'numeric', 'between:-90,90'],
            'bujur' => ['nullable', 'numeric', 'between:-180,180'],
            'akurasi' => ['nullable', 'numeric', 'min:0'],
            'keterangan_dinas' => ['required', 'string'],
            'kunci_idempoten' => ['nullable', 'string', 'min:8', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/'],
        ], [
            'foto.required' => 'Foto wajib diambil sebelum absen.',
            'lintang.numeric' => 'Lintang harus berupa angka.',
            'lintang.between' => 'Lintang harus antara -90 dan 90.',
            'bujur.numeric' => 'Bujur harus berupa angka.',
            'bujur.between' => 'Bujur harus antara -180 dan 180.',
            'akurasi.numeric' => 'Akurasi GPS harus berupa angka.',
            'akurasi.min' => 'Akurasi GPS tidak boleh negatif.',
            'keterangan_dinas.required' => 'Keterangan dinas wajib diisi.',
            'kunci_idempoten.min' => 'Kunci idempoten minimal 8 karakter.',
            'kunci_idempoten.max' => 'Kunci idempoten maksimal 80 karakter.',
            'kunci_idempoten.regex' => 'Kunci idempoten hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.',
        ]);

        $keterangan = trim($data['keterangan_dinas']);

        if (mb_strlen($keterangan) < 4 || mb_strlen($keterangan) > 500) {
            return $this->galat(
                'Keterangan dinas harus 4 sampai 500 karakter.',
                422,
                null,
                ['keterangan_dinas' => ['Keterangan dinas harus 4 sampai 500 karakter.']]
            );
        }

        $lat = isset($data['lintang']) ? (float) $data['lintang'] : null;
        $lon = isset($data['bujur']) ? (float) $data['bujur'] : null;
        $akurasi = isset($data['akurasi']) ? (float) $data['akurasi'] : null;

        if ($lat === null || $lon === null) {
            return $this->galat(
                'Lintang dan bujur wajib dikirim berpasangan.',
                422,
                'koordinat_tidak_lengkap'
            );
        }

        $kunci = $data['kunci_idempoten'] ?? null;

        if ($kunci !== null) {
            $lama = Absen::with(['pengguna', 'lokasi'])
                ->where('pengguna_id', $pengguna->id)
                ->where('kunci_idempoten', $kunci)
                ->first();

            if ($lama) {
                return $this->jawaban($lama, true);
            }

            if (Absen::where('kunci_idempoten', $kunci)->where('pengguna_id', '!=', $pengguna->id)->exists()) {
                return $this->galat(
                    'Kunci idempoten sudah dipakai untuk pengguna lain.',
                    409,
                    'kunci_bentrok'
                );
            }
        }

        $tanggal = now()->toDateString();

        $aktif = Absen::where('pengguna_id', $pengguna->id)
            ->whereDate('tanggal', $tanggal)
            ->whereIn('status_persetujuan', ['menunggu', 'disetujui'])
            ->get();

        $sudahMasuk = $aktif->contains('tipe', 'masuk');
        $sudahPulang = $aktif->contains('tipe', 'pulang');

        if ($sudahMasuk && $sudahPulang) {
            return $this->galat('Anda sudah absen masuk dan pulang hari ini.', 409, 'sudah_absen');
        }

        $tipe = $sudahMasuk ? 'pulang' : 'masuk';

        $ditolak = Absen::where('pengguna_id', $pengguna->id)
            ->whereDate('tanggal', $tanggal)
            ->where('tipe', $tipe)
            ->where('status_persetujuan', 'ditolak')
            ->first();

        $lokasi = $pengguna->lokasi;

        if (! $lokasi) {
            return $this->galat(
                'Lokasi kerja Anda belum diatur. Hubungi admin.',
                422,
                'lokasi_tidak_ada'
            );
        }

        $foto = Foto::baca($data['foto']);

        if (isset($foto['kode'])) {
            return $this->galat($foto['pesan'], $foto['status'], $foto['kode']);
        }

        $fotoPath = Foto::simpan($foto['biner'], $foto['ekstensi']);

        $jarak = null;

        if ($lokasi->lintang !== null && $lokasi->bujur !== null) {
            $jarak = (int) round(Geo::jarakMeter(
                $lat,
                $lon,
                (float) $lokasi->lintang,
                (float) $lokasi->bujur
            ));
        }

        $akurasiInt = $akurasi !== null ? (int) round($akurasi) : null;
        $lokasiTeks = Nominatim::alamat($lat, $lon);

        $nilai = [
            'tanggal' => $tanggal,
            'tipe' => $tipe,
            'waktu' => now(),
            'lokasi_id' => $lokasi->id,
            'mode' => 'luar',
            'lintang' => $lat,
            'bujur' => $lon,
            'akurasi' => $akurasiInt,
            'jarak_m' => $jarak,
            'lokasi_teks' => $lokasiTeks ? mb_substr($lokasiTeks, 0, 255) : null,
            'lokasi_meragukan' => $akurasi === null || $akurasi > 50,
            'shift_id' => $pengguna->shift_id,
            'telat_menit' => $tipe === 'masuk' ? ($pengguna->shift?->telatMenit(now()) ?? 0) : 0,
            'nama_salinan' => $pengguna->nama,
            'nip_salinan' => $pengguna->nip,
            'foto_path' => $fotoPath,
            'kiosk_id' => null,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent() ? mb_substr($request->userAgent(), 0, 255) : null,
            'kunci_idempoten' => $kunci,
            'status_persetujuan' => 'menunggu',
            'keterangan_dinas' => $keterangan,
            'catatan_admin' => null,
            'diputuskan_oleh' => null,
            'diputuskan_at' => null,
        ];

        if ($ditolak) {
            $fotoLama = $ditolak->foto_path;
            $ditolak->update($nilai);
            Foto::hapus($fotoLama);
            $absen = $ditolak;
            $status = 200;
        } else {
            try {
                $absen = Absen::create($nilai + ['pengguna_id' => $pengguna->id, 'created_at' => now()]);
            } catch (QueryException $e) {
                Foto::hapus($fotoPath);

                if ($kunci !== null
                    && ($lama = Absen::where('pengguna_id', $pengguna->id)->where('kunci_idempoten', $kunci)->first())) {
                    return $this->jawaban($lama->load(['pengguna', 'lokasi']), true);
                }

                if ($e->getCode() !== '23000') {
                    throw $e;
                }

                return $this->galat('Anda sudah absen untuk sesi ini hari ini.', 409, 'sudah_absen');
            }

            $status = 201;
        }

        Audit::catat($pengguna->id, 'absen_dinas_'.$tipe, [
            'absen_id' => $absen->id,
            'tipe' => $tipe,
            'tanggal' => $tanggal,
            'status_persetujuan' => 'menunggu',
            'jarak_m' => $jarak,
            'akurasi' => $akurasiInt,
            'lokasi_meragukan' => $nilai['lokasi_meragukan'],
        ], $request);

        return $this->jawaban($absen->fresh(['pengguna', 'lokasi']), false, $status);
    }

    private function magang(Request $request): Pengguna|JsonResponse
    {
        $pengguna = $request->attributes->get('pengguna');

        if (! $pengguna || $pengguna->peran !== 'magang') {
            return $this->galat('Anda tidak berhak membuka halaman ini.', 403, 'tidak_berhak');
        }

        return $pengguna;
    }

    private function jawaban(Absen $absen, bool $idempoten, int $status = 200): JsonResponse
    {
        return response()->json($absen->apiArray() + ['idempoten' => $idempoten], $status);
    }
}
