<?php

namespace App\Http\Controllers;

use App\Models\Absen;
use App\Models\Audit;
use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminDataController extends Controller
{
    public function lokasi(): JsonResponse
    {
        $data = Lokasi::withCount(['magang as jumlah_magang'])
            ->orderBy('nama')
            ->get()
            ->map(fn (Lokasi $l) => $this->lokasiArray($l));

        return response()->json(['data' => $data]);
    }

    public function storeLokasi(Request $request): JsonResponse
    {
        $this->normalisasiLokasi($request);

        $data = $request->validate([
            'nama' => ['required', 'string', 'max:100'],
            'alamat' => ['nullable', 'string', 'max:255'],
            'lintang' => ['required', 'numeric', 'between:-90,90'],
            'bujur' => ['required', 'numeric', 'between:-180,180'],
            'radius_m' => ['nullable', 'integer', 'between:1,5000'],
            'aktif' => ['nullable', 'boolean'],
        ], $this->pesanLokasi());

        if ($this->namaLokasiDipakai($data['nama'])) {
            return $this->galat(
                "Lokasi \"{$data['nama']}\" sudah ada.",
                409,
                'nama_dipakai'
            );
        }

        $lokasi = Lokasi::create([
            'nama' => $data['nama'],
            'alamat' => $data['alamat'] ?? null,
            'lintang' => $data['lintang'],
            'bujur' => $data['bujur'],
            'radius_m' => $data['radius_m'] ?? config('absensi.seed.lokasi_radius_m', 250),
            'aktif' => $data['aktif'] ?? true,
        ]);

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'tambah_lokasi',
            ['lokasi_id' => $lokasi->id, 'nama' => $lokasi->nama],
            $request
        );

        return response()->json($this->lokasiArray($lokasi->loadCount(['magang as jumlah_magang'])), 201);
    }

    public function updateLokasi(Request $request, int $id): JsonResponse
    {
        $lokasi = Lokasi::find($id);

        if (! $lokasi) {
            return $this->galat('Lokasi tidak ditemukan.', 404, 'tidak_ditemukan');
        }

        $this->normalisasiLokasi($request);

        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:100'],
            'alamat' => ['sometimes', 'nullable', 'string', 'max:255'],
            'lintang' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'bujur' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'radius_m' => ['sometimes', 'integer', 'between:1,5000'],
            'aktif' => ['sometimes', 'boolean'],
        ], $this->pesanLokasi());

        if (array_key_exists('lintang', $data) xor array_key_exists('bujur', $data)) {
            throw ValidationException::withMessages([
                'lintang' => 'Lintang dan bujur harus dikirim berpasangan.',
            ]);
        }

        if (array_key_exists('nama', $data) && $this->namaLokasiDipakai($data['nama'], $lokasi->id)) {
            return $this->galat(
                "Lokasi \"{$data['nama']}\" sudah ada.",
                409,
                'nama_dipakai'
            );
        }

        $lokasi->fill($data)->save();

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'ubah_lokasi',
            ['lokasi_id' => $lokasi->id, 'nama' => $lokasi->nama],
            $request
        );

        return response()->json($this->lokasiArray($lokasi->fresh()->loadCount(['magang as jumlah_magang'])));
    }

    public function shift(): JsonResponse
    {
        $data = Shift::withCount(['magang as jumlah_magang'])
            ->orderBy('nama')
            ->get()
            ->map(fn (Shift $s) => $this->shiftArray($s));

        return response()->json(['data' => $data]);
    }

    public function storeShift(Request $request): JsonResponse
    {
        $this->normalisasiShift($request);

        $data = $request->validate([
            'nama' => ['required', 'string', 'max:80'],
            'masuk' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'pulang' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'toleransi_menit' => ['nullable', 'integer', 'between:0,120'],
            'aktif' => ['nullable', 'boolean'],
        ], $this->pesanShift());

        if ($this->namaShiftDipakai($data['nama'])) {
            return $this->galat(
                "Shift \"{$data['nama']}\" sudah ada.",
                409,
                'nama_dipakai'
            );
        }

        $shift = Shift::create([
            'nama' => $data['nama'],
            'masuk' => $data['masuk'],
            'pulang' => $data['pulang'],
            'toleransi_menit' => $data['toleransi_menit'] ?? 0,
            'aktif' => $data['aktif'] ?? true,
        ]);

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'tambah_shift',
            ['shift_id' => $shift->id, 'nama' => $shift->nama],
            $request
        );

        return response()->json(
            $this->shiftArray($shift->loadCount(['magang as jumlah_magang'])),
            201
        );
    }

    public function updateShift(Request $request, int $id): JsonResponse
    {
        $shift = Shift::find($id);

        if (! $shift) {
            return $this->galat('Shift tidak ditemukan.', 404, 'tidak_ditemukan');
        }

        $this->normalisasiShift($request);

        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:80'],
            'masuk' => ['sometimes', 'required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'pulang' => ['sometimes', 'required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'toleransi_menit' => ['sometimes', 'integer', 'between:0,120'],
            'aktif' => ['sometimes', 'boolean'],
        ], $this->pesanShift());

        if (array_key_exists('nama', $data) && $this->namaShiftDipakai($data['nama'], $shift->id)) {
            return $this->galat(
                "Shift \"{$data['nama']}\" sudah ada.",
                409,
                'nama_dipakai'
            );
        }

        $shift->fill($data)->save();

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'ubah_shift',
            ['shift_id' => $shift->id, 'nama' => $shift->nama],
            $request
        );

        return response()->json(
            $this->shiftArray($shift->fresh()->loadCount(['magang as jumlah_magang']))
        );
    }

    public function hapusShift(Request $request, int $id): JsonResponse
    {
        $shift = Shift::find($id);

        if (! $shift) {
            return $this->galat('Shift tidak ditemukan.', 404, 'tidak_ditemukan');
        }

        if (Shift::count() <= 1) {
            return $this->galat(
                'Ini satu-satunya shift. Tanpa shift, tidak ada yang bisa dipilih saat menambah anak magang.',
                409,
                'shift_terakhir'
            );
        }

        $jumlahPengguna = Pengguna::where('shift_id', $shift->id)->count();

        if ($jumlahPengguna > 0) {
            return $this->galat(
                "Shift ini masih dipakai {$jumlahPengguna} orang. Pindahkan mereka ke shift lain dulu, atau nonaktifkan shift ini.",
                409,
                'shift_dipakai_pengguna'
            );
        }

        $jumlahAbsen = Absen::where('shift_id', $shift->id)->count();

        if ($jumlahAbsen > 0) {
            return $this->galat(
                "Shift ini dipakai {$jumlahAbsen} catatan absen. Menghapusnya membuat riwayat itu kehilangan jam kerjanya — nonaktifkan saja.",
                409,
                'shift_dipakai_absen'
            );
        }

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'hapus_shift',
            ['shift_id' => $shift->id, 'nama' => $shift->nama],
            $request
        );

        $shift->delete();

        return response()->json(['ok' => true]);
    }

    public function hariLibur(): JsonResponse
    {
        $data = HariLibur::orderBy('tanggal')
            ->get()
            ->map(fn (HariLibur $h) => $this->hariLiburArray($h));

        return response()->json(['data' => $data]);
    }

    public function storeHariLibur(Request $request): JsonResponse
    {
        $this->normalisasiHariLibur($request);

        $data = $request->validate([
            'tanggal' => ['required', 'date_format:Y-m-d'],
            'keterangan' => ['required', 'string', 'max:120'],
        ], $this->pesanHariLibur());

        if (HariLibur::whereDate('tanggal', $data['tanggal'])->exists()) {
            return $this->galat(
                "Tanggal {$data['tanggal']} sudah terdaftar sebagai hari libur.",
                409,
                'tanggal_dipakai'
            );
        }

        $hariLibur = HariLibur::create([
            'tanggal' => $data['tanggal'],
            'keterangan' => $data['keterangan'],
        ]);

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'tambah_hari_libur',
            ['hari_libur_id' => $hariLibur->id, 'tanggal' => $data['tanggal']],
            $request
        );

        return response()->json($this->hariLiburArray($hariLibur), 201);
    }

    public function updateHariLibur(Request $request, int $id): JsonResponse
    {
        $hariLibur = HariLibur::find($id);

        if (! $hariLibur) {
            return $this->galat('Hari libur tidak ditemukan.', 404, 'tidak_ditemukan');
        }

        $this->normalisasiHariLibur($request);

        $data = $request->validate([
            'tanggal' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'keterangan' => ['sometimes', 'required', 'string', 'max:120'],
        ], $this->pesanHariLibur());

        if (array_key_exists('tanggal', $data)) {
            $dipakai = HariLibur::whereDate('tanggal', $data['tanggal'])
                ->where('id', '!=', $hariLibur->id)
                ->exists();

            if ($dipakai) {
                return $this->galat(
                    "Tanggal {$data['tanggal']} sudah terdaftar sebagai hari libur.",
                    409,
                    'tanggal_dipakai'
                );
            }
        }

        $hariLibur->fill($data)->save();

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'ubah_hari_libur',
            ['hari_libur_id' => $hariLibur->id, 'tanggal' => $hariLibur->tanggal->format('Y-m-d')],
            $request
        );

        return response()->json($this->hariLiburArray($hariLibur->fresh()));
    }

    public function hapusHariLibur(Request $request, int $id): JsonResponse
    {
        $hariLibur = HariLibur::find($id);

        if (! $hariLibur) {
            return $this->galat('Hari libur tidak ditemukan.', 404, 'tidak_ditemukan');
        }

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'hapus_hari_libur',
            ['hari_libur_id' => $hariLibur->id, 'tanggal' => $hariLibur->tanggal->format('Y-m-d')],
            $request
        );

        $hariLibur->delete();

        return response()->json(['ok' => true]);
    }

    private function shiftArray(Shift $shift): array
    {
        return [
            'id' => $shift->id,
            'nama' => $shift->nama,
            'masuk' => substr((string) $shift->masuk, 0, 5),
            'pulang' => substr((string) $shift->pulang, 0, 5),
            'toleransi_menit' => $shift->toleransi_menit,
            'aktif' => $shift->aktif,
            'jumlah_magang' => $shift->jumlah_magang ?? 0,
        ];
    }

    private function normalisasiShift(Request $request): void
    {
        if ($request->exists('nama')) {
            $request->merge(['nama' => trim((string) $request->input('nama'))]);
        }

        if ($request->exists('aktif')) {
            $nilai = filter_var($request->input('aktif'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            if ($nilai !== null) {
                $request->merge(['aktif' => $nilai]);
            }
        }
    }

    private function namaShiftDipakai(string $nama, ?int $kecuali = null): bool
    {
        $query = Shift::whereRaw('LOWER(nama) = ?', [mb_strtolower(trim($nama))]);

        if ($kecuali) {
            $query->where('id', '!=', $kecuali);
        }

        return $query->exists();
    }

    private function pesanShift(): array
    {
        return [
            'nama.required' => 'Nama shift wajib diisi.',
            'nama.max' => 'Nama shift maksimal 80 karakter.',
            'masuk.required' => 'Jam masuk wajib diisi.',
            'masuk.regex' => 'Jam masuk harus berbentuk HH:MM (24 jam).',
            'pulang.required' => 'Jam pulang wajib diisi.',
            'pulang.regex' => 'Jam pulang harus berbentuk HH:MM (24 jam).',
            'toleransi_menit.integer' => 'Toleransi harus berupa angka bulat.',
            'toleransi_menit.between' => 'Toleransi harus antara 0 dan 120 menit.',
            'aktif.boolean' => 'Status aktif tidak sah.',
        ];
    }

    private function hariLiburArray(HariLibur $hariLibur): array
    {
        return [
            'id' => $hariLibur->id,
            'tanggal' => $hariLibur->tanggal->format('Y-m-d'),
            'keterangan' => $hariLibur->keterangan,
        ];
    }

    private function normalisasiHariLibur(Request $request): void
    {
        if ($request->exists('keterangan')) {
            $request->merge(['keterangan' => trim((string) $request->input('keterangan'))]);
        }
    }

    private function pesanHariLibur(): array
    {
        return [
            'tanggal.required' => 'Tanggal wajib diisi.',
            'tanggal.date_format' => 'Tanggal harus berbentuk YYYY-MM-DD.',
            'keterangan.required' => 'Keterangan wajib diisi.',
            'keterangan.max' => 'Keterangan maksimal 120 karakter.',
        ];
    }

    private function lokasiArray(Lokasi $lokasi): array
    {
        return [
            'id' => $lokasi->id,
            'nama' => $lokasi->nama,
            'aktif' => $lokasi->aktif,
            'jumlah_magang' => $lokasi->jumlah_magang ?? 0,
            'alamat' => $lokasi->alamat,
            'lintang' => $lokasi->lintang,
            'bujur' => $lokasi->bujur,
            'radius_m' => $lokasi->radius_m,
        ];
    }

    private function normalisasiLokasi(Request $request): void
    {
        if ($request->exists('nama')) {
            $request->merge(['nama' => trim((string) $request->input('nama'))]);
        }

        if ($request->exists('alamat')) {
            $alamat = trim((string) $request->input('alamat'));
            $request->merge(['alamat' => $alamat === '' ? null : $alamat]);
        }

        if ($request->exists('aktif')) {
            $nilai = filter_var($request->input('aktif'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            if ($nilai !== null) {
                $request->merge(['aktif' => $nilai]);
            }
        }
    }

    private function namaLokasiDipakai(string $nama, ?int $kecuali = null): bool
    {
        $query = Lokasi::whereRaw('LOWER(nama) = ?', [mb_strtolower(trim($nama))]);

        if ($kecuali) {
            $query->where('id', '!=', $kecuali);
        }

        return $query->exists();
    }

    private function pesanLokasi(): array
    {
        return [
            'nama.required' => 'Nama lokasi wajib diisi.',
            'nama.max' => 'Nama lokasi maksimal 100 karakter.',
            'alamat.max' => 'Alamat maksimal 255 karakter.',
            'lintang.required' => 'Lintang wajib diisi.',
            'lintang.numeric' => 'Lintang harus berupa angka.',
            'lintang.between' => 'Lintang harus antara -90 dan 90.',
            'bujur.required' => 'Bujur wajib diisi.',
            'bujur.numeric' => 'Bujur harus berupa angka.',
            'bujur.between' => 'Bujur harus antara -180 dan 180.',
            'radius_m.integer' => 'Radius harus berupa angka bulat.',
            'radius_m.between' => 'Radius harus antara 1 dan 5000 meter.',
            'aktif.boolean' => 'Status aktif tidak sah.',
        ];
    }
}
