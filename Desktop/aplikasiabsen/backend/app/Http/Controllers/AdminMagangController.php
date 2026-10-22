<?php

namespace App\Http\Controllers;

use App\Models\Audit;
use App\Models\Pengguna;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminMagangController extends Controller
{
    public function index(): JsonResponse
    {
        $data = Pengguna::with(['shift', 'lokasi'])
            ->orderBy('nama')
            ->get()
            ->map(fn (Pengguna $p) => $p->adminArray())
            ->values();

        return response()->json([
            'data' => $data,
            'divisi' => config('absensi.divisi'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->normalisasi($request);

        $data = $request->validate([
            'nama' => ['required', 'string', 'max:120'],
            'nip' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email:rfc', 'max:160'],
            'nik' => ['nullable', 'regex:/^\d{16}$/'],
            'divisi' => ['required', Rule::in(config('absensi.divisi'))],
            'peran' => ['nullable', Rule::in(['admin', 'magang'])],
            'shift_id' => ['required', 'integer', 'exists:shift,id'],
            'lokasi_id' => ['required', 'integer', 'exists:lokasi,id'],
            'masuk_kerja' => ['required', 'date_format:Y-m-d'],
            'cuti_kuota' => ['nullable', 'integer', 'min:0', 'max:365'],
            'pin' => ['required', 'regex:/^\d{4,6}$/'],
            'aktif' => ['nullable', 'boolean'],
        ], $this->pesan());

        if ($bentrok = $this->bentrok($data['nip'], $data['email'] ?? null)) {
            return $bentrok;
        }

        if ($this->pinDipakai((string) $data['pin'])) {
            return $this->galat(
                'PIN sudah dipakai pengguna lain. Pilih PIN lain.',
                409,
                'pin_dipakai'
            );
        }

        $pengguna = Pengguna::create([
            'nama' => $data['nama'],
            'nip' => $data['nip'],
            'email' => $data['email'] ?? null,
            'nik' => $data['nik'] ?? null,
            'pin_hash' => Hash::make((string) $data['pin']),
            'peran' => $data['peran'] ?? 'magang',
            'divisi' => $data['divisi'],
            'shift_id' => $data['shift_id'],
            'lokasi_id' => $data['lokasi_id'],
            'masuk_kerja' => $data['masuk_kerja'],
            'cuti_kuota' => $data['cuti_kuota'] ?? 12,
            'aktif' => $data['aktif'] ?? true,
        ]);

        Audit::catat(
            $request->attributes->get('pengguna')->id,
            'tambah_magang',
            ['pengguna_id' => $pengguna->id, 'nip' => $pengguna->nip],
            $request
        );

        $pengguna->load(['shift', 'lokasi']);

        return response()->json($pengguna->adminArray(), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $pengguna = Pengguna::findOrFail($id);
        $this->normalisasi($request);

        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:120'],
            'nip' => ['sometimes', 'required', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:160'],
            'nik' => ['sometimes', 'nullable', 'regex:/^\d{16}$/'],
            'divisi' => ['sometimes', Rule::in(config('absensi.divisi'))],
            'peran' => ['sometimes', Rule::in(['admin', 'magang'])],
            'shift_id' => ['sometimes', 'integer', 'exists:shift,id'],
            'lokasi_id' => ['sometimes', 'integer', 'exists:lokasi,id'],
            'masuk_kerja' => ['sometimes', 'date_format:Y-m-d'],
            'cuti_kuota' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'pin' => ['sometimes', 'nullable', 'regex:/^\d{4,6}$/'],
            'aktif' => ['sometimes', 'boolean'],
        ], $this->pesan());

        if ($bentrok = $this->bentrok($data['nip'] ?? null, $data['email'] ?? null, $pengguna->id)) {
            return $bentrok;
        }

        $aktor = $request->attributes->get('pengguna');

        if ($pengguna->id === $aktor->id) {
            if (array_key_exists('peran', $data) && $data['peran'] !== 'admin') {
                return $this->galat('Anda tidak bisa menurunkan peran akun sendiri.', 422);
            }

            if (array_key_exists('aktif', $data) && ! $data['aktif']) {
                return $this->galat('Anda tidak bisa menonaktifkan akun sendiri.', 422);
            }
        }

        $pinBaru = $data['pin'] ?? null;
        unset($data['pin']);

        $pinDiubah = false;

        if ($pinBaru !== null && $pinBaru !== '') {
            if ($this->pinDipakai((string) $pinBaru, $pengguna->id)) {
                return $this->galat(
                    'PIN sudah dipakai pengguna lain. Pilih PIN lain.',
                    409,
                    'pin_dipakai'
                );
            }

            $data['pin_hash'] = Hash::make((string) $pinBaru);
            $pinDiubah = true;
        }

        if ($data) {
            $pengguna->update($data);
        }

        $pengguna->load(['shift', 'lokasi']);

        $rincian = [
            'pengguna_id' => $pengguna->id,
            'nip' => $pengguna->nip,
            'kolom' => array_values(array_diff(array_keys($data), ['pin_hash'])),
        ];

        if ($pinDiubah) {
            $rincian['pin_diubah'] = true;
        }

        Audit::catat(
            $aktor->id,
            $pinDiubah ? 'reset_pin' : 'ubah_magang',
            $rincian,
            $request
        );

        return response()->json($pengguna->adminArray());
    }

    private function normalisasi(Request $request): void
    {
        if ($request->exists('nama')) {
            $request->merge(['nama' => trim((string) $request->input('nama'))]);
        }

        if ($request->exists('nip')) {
            $request->merge(['nip' => strtoupper(trim((string) $request->input('nip')))]);
        }

        if ($request->exists('email')) {
            $email = trim((string) $request->input('email'));
            $request->merge(['email' => $email === '' ? null : strtolower($email)]);
        }

        if ($request->exists('nik')) {
            $nik = trim((string) $request->input('nik'));
            $request->merge(['nik' => $nik === '' ? null : $nik]);
        }

        if ($request->exists('pin')) {
            $pin = $request->input('pin');
            $request->merge(['pin' => ($pin === null || $pin === '') ? null : (string) $pin]);
        }

        if ($request->exists('divisi')) {
            $request->merge(['divisi' => trim((string) $request->input('divisi'))]);
        }

        if ($request->exists('peran')) {
            $request->merge(['peran' => strtolower(trim((string) $request->input('peran')))]);
        }

        if ($request->exists('aktif')) {
            $nilai = filter_var($request->input('aktif'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($nilai !== null) {
                $request->merge(['aktif' => $nilai]);
            }
        }
    }

    private function bentrok(?string $nip, ?string $email, ?int $kecuali = null): ?JsonResponse
    {
        if ($nip) {
            $query = Pengguna::where('nip', $nip);

            if ($kecuali) {
                $query->where('id', '!=', $kecuali);
            }

            if ($query->exists()) {
                return $this->galat(
                    "NIP {$nip} sudah dipakai magang lain.",
                    409,
                    'nip_dipakai'
                );
            }
        }

        if ($email) {
            $query = Pengguna::where('email', $email);

            if ($kecuali) {
                $query->where('id', '!=', $kecuali);
            }

            if ($query->exists()) {
                return $this->galat(
                    "Email {$email} sudah dipakai pengguna lain.",
                    409,
                    'email_dipakai'
                );
            }
        }

        return null;
    }

    private function pinDipakai(string $pin, ?int $kecuali = null): bool
    {
        $query = Pengguna::query()->select(['id', 'pin_hash']);

        if ($kecuali) {
            $query->where('id', '!=', $kecuali);
        }

        foreach ($query->cursor() as $lain) {
            if ($lain->pin_hash && Hash::check($pin, $lain->pin_hash)) {
                return true;
            }
        }

        return false;
    }

    private function pesan(): array
    {
        return [
            'nama.required' => 'Nama wajib diisi.',
            'nip.required' => 'NIP wajib diisi.',
            'email.email' => 'Format email tidak sah.',
            'nik.regex' => 'NIK harus 16 angka.',
            'divisi.required' => 'Divisi wajib dipilih.',
            'divisi.in' => 'Divisi harus salah satu dari: Pendataan, Perhitungan, Management Data.',
            'shift_id.exists' => 'Shift tidak ditemukan.',
            'lokasi_id.exists' => 'Lokasi tidak ditemukan.',
            'masuk_kerja.date_format' => 'Tanggal masuk kerja harus berbentuk YYYY-MM-DD.',
            'cuti_kuota.integer' => 'Jatah cuti harus berupa angka.',
            'cuti_kuota.min' => 'Jatah cuti tidak boleh negatif.',
            'pin.required' => 'PIN wajib diisi saat membuat akun.',
            'pin.regex' => 'PIN harus 4 sampai 6 angka.',
            'aktif.boolean' => 'Status aktif tidak sah.',
        ];
    }
}
