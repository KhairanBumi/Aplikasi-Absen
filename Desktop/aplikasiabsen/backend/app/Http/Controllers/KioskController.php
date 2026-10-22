<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\PerangkatKiosk;
use App\Models\Shift;
use App\Support\Foto;
use App\Support\Geo;
use App\Support\Nominatim;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class KioskController extends Controller
{
    public function lokasi(Request $request): JsonResponse
    {
        $perangkatId = trim((string) $request->query('perangkat', ''));

        if ($perangkatId !== '') {
            $perangkat = PerangkatKiosk::with('lokasi')->find($perangkatId);

            if (! $perangkat || ! $perangkat->aktif) {
                return $this->galat(
                    'Perangkat kiosk tidak dikenal atau tidak aktif.',
                    403,
                    'tidak_berhak'
                );
            }

            $lokasi = $perangkat->lokasi;

            if (! $lokasi || ! $lokasi->aktif) {
                return $this->galat(
                    'Lokasi perangkat kiosk ini sudah nonaktif.',
                    403,
                    'tidak_berhak'
                );
            }

            $perangkat->terakhir_dilihat_at = now();
            $perangkat->save();
        } else {
            $lokasi = null;
            $lokasiId = $request->query('lokasi');

            if (is_string($lokasiId) && ctype_digit($lokasiId)) {
                $lokasi = Lokasi::where('aktif', true)->find((int) $lokasiId);
            }

            $lokasi ??= Lokasi::where('aktif', true)->orderBy('id')->first();

            if (! $lokasi) {
                return $this->galat('Belum ada lokasi aktif.', 404, 'tidak_ditemukan');
            }
        }

        return response()->json([
            'id' => $lokasi->id,
            'nama' => $lokasi->nama,
            'kiosk_id' => $perangkatId !== '' ? $perangkatId : null,
        ]);
    }

    public function absen(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nip' => ['required', 'string', 'max:30'],
            'pin' => ['required', 'regex:/^\d{4,6}$/'],
            'kiosk_id' => ['required', 'string', 'max:64'],
            'lokasi_id' => ['nullable', 'integer'],
            'mode' => ['nullable', 'string', 'max:20'],
            'lintang' => ['nullable', 'numeric', 'between:-90,90'],
            'bujur' => ['nullable', 'numeric', 'between:-180,180'],
            'akurasi' => ['nullable', 'numeric', 'min:0'],
            'foto' => ['required', 'string'],
        ], [
            'nip.required' => 'NIP wajib diisi.',
            'pin.required' => 'PIN wajib diisi.',
            'pin.regex' => 'PIN harus 4 sampai 6 angka.',
            'kiosk_id.required' => 'Identitas perangkat kiosk wajib dikirim.',
            'foto.required' => 'Foto wajib diambil sebelum absen.',
            'lintang.numeric' => 'Lintang harus berupa angka.',
            'lintang.between' => 'Lintang harus antara -90 dan 90.',
            'bujur.numeric' => 'Bujur harus berupa angka.',
            'bujur.between' => 'Bujur harus antara -180 dan 180.',
            'akurasi.numeric' => 'Akurasi GPS harus berupa angka.',
            'akurasi.min' => 'Akurasi GPS tidak boleh negatif.',
        ]);

        $nip = strtoupper(trim($data['nip']));
        $pin = (string) $data['pin'];
        $kioskId = trim($data['kiosk_id']);
        $ip = $request->ip() ?? 'tidak-diketahui';

        $kunci = ["absen:{$nip}:{$ip}", "absen-kiosk:{$kioskId}"];

        foreach ($kunci as $k) {
            if (RateLimiter::tooManyAttempts($k, 5)) {
                return $this->terlaluBanyak();
            }
        }

        $pengguna = Pengguna::with('shift')->where('nip', $nip)->first();

        if (! $pengguna || ! Hash::check($pin, $pengguna->pin_hash)) {
            foreach ($kunci as $k) {
                RateLimiter::hit($k, 60);
            }

            if (max(array_map(fn (string $k) => RateLimiter::attempts($k), $kunci)) >= 5) {
                return $this->terlaluBanyak();
            }

            return $this->galat('NIP atau PIN salah.', 401, 'kredensial_salah');
        }

        RateLimiter::clear($kunci[0]);

        if (! $pengguna->aktif) {
            return $this->galat(
                'Akun Anda sudah dinonaktifkan. Hubungi admin.',
                403,
                'akun_nonaktif'
            );
        }

        $perangkat = PerangkatKiosk::with('lokasi')->find($kioskId);

        if (! $perangkat || ! $perangkat->aktif) {
            return $this->galat(
                'Perangkat kiosk tidak dikenal atau tidak aktif.',
                403,
                'tidak_berhak'
            );
        }

        $lokasi = $perangkat->lokasi;

        if (! $lokasi || ! $lokasi->aktif) {
            return $this->galat(
                'Lokasi perangkat kiosk ini sudah nonaktif.',
                403,
                'tidak_berhak'
            );
        }

        if (array_key_exists('lokasi_id', $data)
            && $data['lokasi_id'] !== null
            && (int) $data['lokasi_id'] !== (int) $lokasi->id) {
            return $this->galat(
                'Perangkat kiosk ini terdaftar di lokasi lain.',
                403,
                'tidak_berhak'
            );
        }

        $mode = in_array($data['mode'] ?? 'kantor', ['kantor', 'luar'], true)
            ? ($data['mode'] ?? 'kantor')
            : 'kantor';

        $lat = isset($data['lintang']) ? (float) $data['lintang'] : null;
        $lon = isset($data['bujur']) ? (float) $data['bujur'] : null;
        $akurasi = isset($data['akurasi']) ? (float) $data['akurasi'] : null;

        if (($lat === null) xor ($lon === null)) {
            return $this->galat(
                'Lintang dan bujur harus dikirim berpasangan.',
                422,
                'koordinat_tidak_lengkap'
            );
        }

        if ($mode === 'luar') {
            if ($lat === null || $lon === null || $akurasi === null) {
                return $this->galat(
                    'Mode luar wajib mengirim lintang, bujur, dan akurasi GPS.',
                    422,
                    'koordinat_tidak_lengkap'
                );
            }

            $akurasiMaks = (float) config('absensi.akurasi_max_m', 150);

            if ($akurasi > $akurasiMaks) {
                return $this->galat(
                    'Akurasi GPS terlalu kasar ('.round($akurasi).' m). Jarak dari kantor tidak memengaruhi pemeriksaan ini. Maksimal '.round($akurasiMaks).' m; nyalakan GPS presisi, tunggu sampai akurasinya membaik, lalu coba lagi.',
                    422,
                    'akurasi_terlalu_kasar'
                );
            }
        }

        $foto = $this->bacaFoto($data['foto']);

        if ($foto instanceof JsonResponse) {
            return $foto;
        }

        [$biner, $ekstensi] = $foto;
        $fotoPath = Foto::simpan($biner, $ekstensi);

        $tanggal = now()->toDateString();

        $sudahMasuk = Absen::where('pengguna_id', $pengguna->id)
            ->whereDate('tanggal', $tanggal)
            ->where('tipe', 'masuk')
            ->exists();

        $sudahPulang = Absen::where('pengguna_id', $pengguna->id)
            ->whereDate('tanggal', $tanggal)
            ->where('tipe', 'pulang')
            ->exists();

        if ($sudahMasuk && $sudahPulang) {
            Foto::hapus($fotoPath);

            return $this->galat(
                $pengguna->nama.' sudah absen pulang hari ini.',
                409,
                'sudah_absen'
            );
        }

        $tipe = $sudahMasuk ? 'pulang' : 'masuk';

        $jarak = null;

        if ($lat !== null && $lon !== null) {
            if ($lokasi->lintang === null || $lokasi->bujur === null) {
                Foto::hapus($fotoPath);

                return $this->galat(
                    'Lokasi kantor belum memiliki titik koordinat. Minta admin mengisinya.',
                    422,
                    'lokasi_tanpa_titik'
                );
            }

            $jarak = (int) round(Geo::jarakMeter(
                $lat,
                $lon,
                (float) $lokasi->lintang,
                (float) $lokasi->bujur
            ));
        }

        $akurasiInt = $akurasi !== null ? (int) round($akurasi) : null;
        $meragukan = $akurasi !== null && $akurasi > 50;
        $lokasiTeks = ($lat !== null && $lon !== null)
            ? Nominatim::alamat($lat, $lon)
            : null;

        $telat = $tipe === 'masuk'
            ? $this->hitungTelat($pengguna->shift, now())
            : 0;

        try {
            $absen = Absen::create([
                'pengguna_id' => $pengguna->id,
                'tanggal' => $tanggal,
                'tipe' => $tipe,
                'waktu' => now(),
                'lokasi_id' => $lokasi->id,
                'mode' => $mode,
                'lintang' => $lat,
                'bujur' => $lon,
                'akurasi' => $akurasiInt,
                'jarak_m' => $jarak,
                'lokasi_teks' => $lokasiTeks ? mb_substr($lokasiTeks, 0, 255) : null,
                'lokasi_meragukan' => $meragukan,
                'shift_id' => $pengguna->shift_id,
                'telat_menit' => $telat,
                'nama_salinan' => $pengguna->nama,
                'nip_salinan' => $pengguna->nip,
                'foto_path' => $fotoPath,
                'kiosk_id' => $kioskId,
                'ip' => $ip,
                'user_agent' => $request->userAgent()
                    ? mb_substr($request->userAgent(), 0, 255)
                    : null,
                'created_at' => now(),
            ]);
        } catch (QueryException $e) {
            Foto::hapus($fotoPath);

            if ($this->duplikat($e)) {
                return $this->galat(
                    $pengguna->nama.' sudah absen pulang hari ini.',
                    409,
                    'sudah_absen'
                );
            }

            throw $e;
        }

        $perangkat->terakhir_dilihat_at = now();
        $perangkat->save();

        Audit::catat($pengguna->id, 'absen_'.$tipe, [
            'absen_id' => $absen->id,
            'tipe' => $tipe,
            'mode' => $mode,
            'jarak_m' => $jarak,
            'akurasi' => $akurasiInt,
            'kiosk_id' => $kioskId,
            'lokasi_meragukan' => $meragukan,
        ], $request);

        return response()->json([
            'tipe' => $tipe,
            'nama' => $pengguna->nama,
            'nip' => $pengguna->nip,
            'waktu' => $absen->waktu->toIso8601String(),
            'lokasi_id' => $lokasi->id,
            'mode' => $mode,
            'jarak_m' => $jarak,
            'akurasi' => $akurasiInt,
            'lokasi_teks' => $lokasiTeks,
            'lokasi_meragukan' => $meragukan,
        ]);
    }

    /** @return array{0: string, 1: string}|JsonResponse */
    private function bacaFoto(string $foto): array|JsonResponse
    {
        if (strlen($foto) > 400_000) {
            return $this->galat(
                'Foto terlalu besar. Maksimal 200 KB.',
                413,
                'foto_terlalu_besar'
            );
        }

        if (! preg_match('#^data:image/(jpeg|png);base64,#', $foto, $cocok)) {
            return $this->galat(
                'Foto harus berupa gambar JPEG atau PNG.',
                422,
                'foto_tidak_valid'
            );
        }

        $biner = base64_decode(substr($foto, strlen($cocok[0])), true);

        if ($biner === false || $biner === '') {
            return $this->galat('Foto kosong atau rusak.', 422, 'foto_tidak_valid');
        }

        if (strlen($biner) > (int) config('absensi.foto_max_bytes', 204800)) {
            return $this->galat(
                'Foto terlalu besar. Maksimal 200 KB.',
                413,
                'foto_terlalu_besar'
            );
        }

        $jpeg = substr($biner, 0, 3) === "\xFF\xD8\xFF";
        $png = substr($biner, 0, 4) === "\x89PNG";

        if (($cocok[1] === 'jpeg' && ! $jpeg) || ($cocok[1] === 'png' && ! $png)) {
            return $this->galat(
                'Isi foto tidak cocok dengan format gambar yang dikirim.',
                422,
                'foto_tidak_valid'
            );
        }

        return [$biner, $cocok[1] === 'png' ? 'png' : 'jpg'];
    }

    private function hitungTelat(?Shift $shift, Carbon $waktu): int
    {
        if (! $shift) {
            return 0;
        }

        $masuk = $waktu->copy()->startOfDay()->setTimeFromTimeString($shift->masuk);

        if (strcmp((string) $shift->pulang, (string) $shift->masuk) < 0
            && $waktu->format('H:i:s') < (string) $shift->pulang) {
            $masuk->subDay();
        }

        $batas = $masuk->copy()->addMinutes((int) $shift->toleransi_menit);

        return max(0, intdiv($waktu->getTimestamp() - $batas->getTimestamp(), 60));
    }

    private function duplikat(QueryException $e): bool
    {
        return $e->getCode() === '23000'
            || str_contains(strtolower($e->getMessage()), 'unique');
    }
}
