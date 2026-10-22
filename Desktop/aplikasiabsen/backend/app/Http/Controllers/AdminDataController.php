<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use App\Models\Lokasi;
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
            'radius_m' => $data['radius_m'] ?? 50,
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
            ->map(fn (Shift $s) => [
                'id' => $s->id,
                'nama' => $s->nama,
                'masuk' => substr((string) $s->masuk, 0, 5),
                'pulang' => substr((string) $s->pulang, 0, 5),
                'toleransi_menit' => $s->toleransi_menit,
                'aktif' => $s->aktif,
                'jumlah_magang' => $s->jumlah_magang,
            ]);

        return response()->json(['data' => $data]);
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
