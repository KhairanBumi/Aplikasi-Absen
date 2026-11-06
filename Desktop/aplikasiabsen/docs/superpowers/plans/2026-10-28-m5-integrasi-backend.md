# Integrasi Backend (M5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup seluruh endpoint backend yang masih dipakai frontend — riwayat absen magang, izin/cuti, shift, dan hari libur — sehingga semua layar berjalan dengan `VITE_USE_MOCK=false` sesuai `KONTRAK-API.md`.

**Architecture:** Tambah tiga controller baru (`SayaAbsenController`, `SayaIzinController`, `AdminIzinController`), satu tabel/model `izin`, satu support class `KuotaCuti`, lalu sambungkan izin yang disetujui ke `App\Support\Harian`, laporan, dan dashboard. CRUD shift dan hari libur ditambahkan ke `AdminDataController` yang sudah ada. Frontend tidak diubah pada milestone ini; frontend hanya dipakai sebagai pembanding di uji staging.

**Tech Stack:** Laravel 13 / PHP 8.3+, PHPUnit 12.5, SQLite in-memory untuk tes, MariaDB 10.11 produksi, Carbon, Eloquent, Vite 8, vanilla JS frontend.

**Spec:** `KONTRAK-API.md` (kontrak menang atas dokumen lain), `docs/milestones/M5-integrasi-backend.md`.

## Global Constraints

- Repo root: `D:\Work\Aplikasi-Absen`. Aplikasi ada di `Desktop\aplikasiabsen`.
- Semua perintah backend dijalankan dari `Desktop/aplikasiabsen/backend`.
- Semua perintah frontend dijalankan dari `Desktop/aplikasiabsen`.
- Kontrak response ada di `KONTRAK-API.md`. Jangan menambah field, endpoint, atau kode error baru tanpa memperbarui kontrak lebih dulu.
- Jangan pernah mengembalikan atau menulis PIN/token mentah ke response, audit, log, atau dokumentasi.
- Zona waktu server `Asia/Jakarta`; jam absen selalu jam server.
- Tes memakai `RefreshDatabase`, `Carbon::setTestNow()`, dan SQLite in-memory dari `phpunit.xml`.
- Error API memakai `$this->galat($message, $status, $kode)` dari `Controller`; jangan mengembalikan HTML.
- `PUT` bersifat parsial: hanya kolom yang dikirim yang diubah.
- Pesan error dalam Bahasa Indonesia yang bisa dibaca langsung pengguna.
- Satu task = satu siklus tes → implementasi → tes lulus → commit. Jangan menggabungkan dua task dalam satu commit.
- Jangan menjalankan `migrate:fresh` pada database pengembangan yang berisi data. Tes memakai database in-memory; staging memakai file SQLite terpisah.
- Jangan mengubah `src/views/*` atau `src/api.js` pada milestone ini. Kalau staging menemukan ketidakcocokan, perbaiki sisi yang sesuai kontrak dan catat di milestone.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `backend/database/migrations/2026_10_28_000001_create_izin_table.php` | Tabel pengajuan izin/cuti/sakit. |
| `backend/app/Models/Izin.php` | Model, konstanta jenis/status, serializer `apiArray()`. |
| `backend/app/Support/KuotaCuti.php` | Satu definisi kuota cuti: jatah, terpakai, menunggu, sisa. |
| `backend/app/Support/Harian.php` | Daftar tanggal hari kerja + baris harian yang sudah mengenal izin disetujui. |
| `backend/app/Http/Controllers/SayaAbsenController.php` | `GET /saya/absen`. |
| `backend/app/Http/Controllers/SayaIzinController.php` | `GET/POST /saya/izin`. |
| `backend/app/Http/Controllers/AdminIzinController.php` | Daftar, setujui, tolak pengajuan. |
| `backend/app/Http/Controllers/AdminLaporanController.php` | Pilih pengguna yang punya izin disetujui di bulan laporan. |
| `backend/app/Http/Controllers/DashboardController.php` | Hitung izin hari ini dan keluarkan dari `belum_masuk`. |
| `backend/app/Http/Controllers/AdminDataController.php` | CRUD shift dan hari libur. |
| `backend/routes/api.php` | Daftar rute baru. |
| `backend/tests/Feature/SayaAbsenTest.php` | Riwayat magang + integrasi izin. |
| `backend/tests/Feature/IzinModelTest.php` | Bentuk serializer izin. |
| `backend/tests/Feature/KuotaCutiTest.php` | Aturan kuota cuti. |
| `backend/tests/Feature/SayaIzinTest.php` | Daftar dan pengajuan izin magang. |
| `backend/tests/Feature/AdminIzinListTest.php` | Daftar izin admin + jumlah tab. |
| `backend/tests/Feature/AdminIzinKeputusanTest.php` | Setujui/tolak + audit. |
| `backend/tests/Feature/HarianIzinTest.php` | Prioritas libur/absen/izin di baris harian + laporan. |
| `backend/tests/Feature/DashboardIzinTest.php` | Izin di dashboard. |
| `backend/tests/Feature/AdminShiftTest.php` | CRUD shift + tiga penolakan hapus. |
| `backend/tests/Feature/AdminHariLiburTest.php` | CRUD hari libur + efek dashboard. |
| `backend/README.md` | Tabel endpoint dan status backend. |
| `docs/milestones/M5-integrasi-backend.md`, `docs/README.md` | Status milestone. |

---

### Task 1: `GET /saya/absen`

**Files:**
- Create: `backend/app/Http/Controllers/SayaAbsenController.php`
- Create: `backend/tests/Feature/SayaAbsenTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: `App\Support\Harian::susun(Pengguna $pengguna, Carbon $awal): array` (sudah ada).
- Produces: `GET /api/saya/absen?bulan=YYYY-MM` → body persis `Harian::susun()`: `{bulan, hari_kerja, ringkasan, data}`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/SayaAbsenTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SayaAbsenTest extends TestCase
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
            'alamat' => 'Jl. Uji No. 1',
            'lintang' => -6.2246,
            'bujur' => 106.8094,
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

        $this->magang = $this->buatPengguna('MGG001', 'Magang Uji', '2026-10-15');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_riwayat_memuat_seluruh_hari_dan_hari_kerja_sejak_masuk(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $this->absen($this->magang, '2026-10-15', 'masuk', '2026-10-15 08:20:00', ['telat_menit' => 5]);
        $this->absen($this->magang, '2026-10-15', 'pulang', '2026-10-15 17:02:00');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->token($this->magang))
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk()
            ->assertJsonPath('bulan', '2026-10')
            ->assertJsonPath('hari_kerja', 4)
            ->assertJsonCount(31, 'data')
            ->assertJsonStructure([
                'bulan',
                'hari_kerja',
                'ringkasan' => ['hadir', 'tepat', 'telat', 'telat_menit', 'izin', 'alpha'],
                'data' => [[
                    'tanggal', 'keterangan_libur', 'masuk', 'pulang', 'telat_menit',
                    'status', 'keterangan_izin', 'alasan_izin', 'lokasi', 'lokasi_kantor',
                    'foto', 'mode', 'lintang', 'bujur', 'akurasi', 'jarak_m',
                    'lokasi_meragukan', 'lokasi_teks',
                ]],
            ]);

        $tanggal = array_column($res->json('data'), 'tanggal');
        $urut = $tanggal;
        sort($urut);
        $this->assertSame($urut, $tanggal);

        $hari = collect($res->json('data'))->keyBy('tanggal');

        $this->assertSame('libur', $hari['2026-10-01']['status']);
        $this->assertSame('Belum masuk kerja', $hari['2026-10-01']['keterangan_libur']);
        $this->assertSame('Hari Minggu', $hari['2026-10-04']['keterangan_libur']);
        $this->assertSame('Libur Uji', $hari['2026-10-20']['keterangan_libur']);
        $this->assertSame('telat', $hari['2026-10-15']['status']);
        $this->assertSame(5, $hari['2026-10-15']['telat_menit']);
        $this->assertSame('belum', $hari['2026-10-21']['status']);
        $this->assertSame('kantor', $hari['2026-10-21']['mode']);
        $this->assertNull($hari['2026-10-21']['masuk']);
    }

    public function test_bulan_tidak_sah_dan_token_wajib(): void
    {
        $token = $this->token($this->magang);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/saya/absen?bulan=2026-13')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'bulan_tidak_valid');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/saya/absen?bulan=2026-1')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'bulan_tidak_valid');

        $this->getJson('/api/saya/absen?bulan=2026-10')
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');
    }

    private function buatPengguna(string $nip, string $nama, string $masukKerja): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'nik' => null,
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => $masukKerja,
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    private function absen(Pengguna $pengguna, string $tanggal, string $tipe, string $waktu, array $atribut = []): Absen
    {
        return Absen::create(array_merge([
            'pengguna_id' => $pengguna->id,
            'tanggal' => $tanggal,
            'tipe' => $tipe,
            'waktu' => Carbon::parse($waktu, 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $pengguna->nama,
            'nip_salinan' => $pengguna->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ], $atribut));
    }

    private function token(Pengguna $pengguna): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $pengguna->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=SayaAbsenTest
```
Expected: FAIL — route `/api/saya/absen` belum ada (404), bukan error sintaks.

- [ ] **Step 3: Implementasi controller**

Buat `backend/app/Http/Controllers/SayaAbsenController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Support\Harian;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SayaAbsenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bulan = (string) $request->query('bulan', now()->format('Y-m'));

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $bulan)) {
            return $this->galat('Bulan harus berbentuk YYYY-MM.', 422, 'bulan_tidak_valid');
        }

        $awal = Carbon::createFromFormat('!Y-m-d', $bulan.'-01')->startOfDay();

        return response()->json(
            Harian::susun($request->attributes->get('pengguna'), $awal)
        );
    }
}
```

- [ ] **Step 4: Daftarkan rute**

Di `backend/routes/api.php`, tambahkan import:

```php
use App\Http\Controllers\SayaAbsenController;
```

Lalu di dalam grup `Route::middleware('auth.token')->group(...)` tambahkan:

```php
Route::get('/saya/absen', [SayaAbsenController::class, 'index']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=SayaAbsenTest
```
Expected: PASS (2 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/SayaAbsenController.php backend/tests/Feature/SayaAbsenTest.php backend/routes/api.php
git commit -m "feat: tambah riwayat absen magang"
```

---

### Task 2: Tabel dan model `izin`

**Files:**
- Create: `backend/database/migrations/2026_10_28_000001_create_izin_table.php`
- Create: `backend/app/Models/Izin.php`
- Create: `backend/tests/Feature/IzinModelTest.php`

**Interfaces:**
- Produces:
  - `Izin::JENIS = ['cuti', 'izin', 'sakit']`
  - `Izin::STATUS = ['menunggu', 'disetujui', 'ditolak']`
  - `Izin::pengguna(): BelongsTo`
  - `Izin::pemutus(): BelongsTo`
  - `Izin::apiArray(): array` dengan bentuk kontrak `GET /saya/izin`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/IzinModelTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class IzinModelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-21 12:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_serializer_izin_memakai_bentuk_kontrak(): void
    {
        $lokasi = Lokasi::create([
            'nama' => 'Kantor Pusat',
            'lintang' => -6.2,
            'bujur' => 106.8,
            'radius_m' => 50,
            'aktif' => true,
        ]);

        $shift = Shift::create([
            'nama' => 'Reguler',
            'masuk' => '08:00',
            'pulang' => '17:00',
            'toleransi_menit' => 15,
            'aktif' => true,
        ]);

        $pengguna = Pengguna::create([
            'nama' => 'Nurul Hidayah',
            'email' => 'mgg009@kantor.id',
            'nip' => 'MGG009',
            'pin_hash' => Hash::make('1357'),
            'peran' => 'magang',
            'divisi' => 'Perhitungan',
            'shift_id' => $shift->id,
            'lokasi_id' => $lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);

        $izin = Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-23',
            'selesai' => '2026-10-26',
            'alasan' => 'Keperluan keluarga',
            'status' => 'menunggu',
            'diajukan_at' => now(),
        ])->load('pengguna');

        $hasil = $izin->apiArray();

        $this->assertSame([
            'id', 'pengguna_id', 'nama', 'nip', 'divisi', 'jenis', 'mulai', 'selesai',
            'hari_kerja', 'alasan', 'status', 'diajukan', 'catatan_admin', 'diputuskan',
        ], array_keys($hasil));

        $this->assertSame('Nurul Hidayah', $hasil['nama']);
        $this->assertSame('MGG009', $hasil['nip']);
        $this->assertSame('Perhitungan', $hasil['divisi']);
        $this->assertSame('2026-10-23', $hasil['mulai']);
        $this->assertSame('2026-10-26', $hasil['selesai']);
        $this->assertSame(2, $hasil['hari_kerja']);
        $this->assertSame('menunggu', $hasil['status']);
        $this->assertNull($hasil['catatan_admin']);
        $this->assertNull($hasil['diputuskan']);
    }

    public function test_rentang_jumat_sampai_senin_dihitung_dua_hari_kerja(): void
    {
        $this->assertSame(2, \App\Support\Harian::hitungHariKerja(
            Carbon::parse('2026-10-23', 'Asia/Jakarta'),
            Carbon::parse('2026-10-26', 'Asia/Jakarta')
        ));
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=IzinModelTest
```
Expected: FAIL — tabel `izin` dan class `App\Models\Izin` belum ada.

- [ ] **Step 3: Buat migration**

Buat `backend/database/migrations/2026_10_28_000001_create_izin_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('izin', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengguna_id')->constrained('pengguna')->restrictOnDelete();
            $table->string('jenis', 10);
            $table->date('mulai');
            $table->date('selesai');
            $table->string('alasan', 500);
            $table->string('status', 20)->default('menunggu');
            $table->string('catatan_admin', 500)->nullable();
            $table->timestamp('diajukan_at');
            $table->timestamp('diputuskan_at')->nullable();
            $table->foreignId('diputuskan_oleh')->nullable()->constrained('pengguna')->nullOnDelete();
            $table->timestamps();

            $table->index(['pengguna_id', 'status']);
            $table->index(['mulai', 'selesai']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('izin');
    }
};
```

- [ ] **Step 4: Buat model**

Buat `backend/app/Models/Izin.php`:

```php
<?php

namespace App\Models;

use App\Support\Harian;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Izin extends Model
{
    public const JENIS = ['cuti', 'izin', 'sakit'];

    public const STATUS = ['menunggu', 'disetujui', 'ditolak'];

    protected $table = 'izin';

    protected $guarded = [];

    protected $casts = [
        'mulai' => 'date',
        'selesai' => 'date',
        'diajukan_at' => 'datetime',
        'diputuskan_at' => 'datetime',
    ];

    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'pengguna_id');
    }

    public function pemutus(): BelongsTo
    {
        return $this->belongsTo(Pengguna::class, 'diputuskan_oleh');
    }

    public function apiArray(): array
    {
        return [
            'id' => $this->id,
            'pengguna_id' => $this->pengguna_id,
            'nama' => $this->pengguna?->nama,
            'nip' => $this->pengguna?->nip,
            'divisi' => $this->pengguna?->divisi,
            'jenis' => $this->jenis,
            'mulai' => $this->mulai->format('Y-m-d'),
            'selesai' => $this->selesai->format('Y-m-d'),
            'hari_kerja' => Harian::hitungHariKerja($this->mulai, $this->selesai),
            'alasan' => $this->alasan,
            'status' => $this->status,
            'diajukan' => $this->diajukan_at?->toIso8601String(),
            'catatan_admin' => $this->catatan_admin,
            'diputuskan' => $this->diputuskan_at?->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=IzinModelTest
```
Expected: PASS (2 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/2026_10_28_000001_create_izin_table.php backend/app/Models/Izin.php backend/tests/Feature/IzinModelTest.php
git commit -m "feat: tambah tabel dan model izin"
```

---

### Task 3: `Harian::tanggalHariKerja()` dan `KuotaCuti`

**Files:**
- Modify: `backend/app/Support/Harian.php`
- Create: `backend/app/Support/KuotaCuti.php`
- Create: `backend/tests/Feature/KuotaCutiTest.php`
- Modify: `KONTRAK-API.md` (klarifikasi tahun kuota)

**Interfaces:**
- Consumes: `Izin`, `Absen`, `Harian::tanggalHariKerja()`.
- Produces:
  - `Harian::tanggalHariKerja(Carbon $dari, Carbon $sampai): array<int, string>`
  - `Harian::hitungHariKerja(Carbon $dari, Carbon $sampai): int` (tetap, kini memakai daftar tanggal)
  - `KuotaCuti::rekap(Pengguna $pengguna, ?int $kecualiIzinId = null): array{jatah:int, terpakai:int, menunggu:int, sisa:int}`
  - `KuotaCuti::tanggalDalamKuota(Pengguna $pengguna, Carbon $mulai, Carbon $selesai): array<int, string>`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/KuotaCutiTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
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

    public function test_kuota_hanya_memotong_cuti_dan_menghitung_hari_kerja(): void
    {
        // Disetujui, Senin–Selasa: 2 hari.
        $this->izin('cuti', '2026-10-26', '2026-10-27', 'disetujui');

        // Menunggu, Rabu–Jumat: 3 hari.
        $this->izin('cuti', '2026-10-28', '2026-10-30', 'menunggu');

        // Disetujui Kamis–Jumat, tetapi Kamis sudah ada absen: hanya Jumat yang dihitung.
        $this->izin('cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->absen('2026-10-22');

        // Izin dan sakit tidak memotong jatah.
        $this->izin('izin', '2026-10-26', '2026-10-27', 'disetujui');
        $this->izin('sakit', '2026-10-28', '2026-10-29', 'disetujui');

        // Cuti tahun depan belum masuk tahun berjalan.
        $this->izin('cuti', '2027-01-04', '2027-01-05', 'disetujui');

        $this->assertSame([
            'jatah' => 12,
            'terpakai' => 3,
            'menunggu' => 3,
            'sisa' => 6,
        ], KuotaCuti::rekap($this->magang));
    }

    public function test_kecuali_izin_id_mengeluarkan_satu_pengajuan_dari_hitungan(): void
    {
        $cuti = $this->izin('cuti', '2026-10-26', '2026-10-27', 'menunggu');

        $this->assertSame(0, KuotaCuti::rekap($this->magang, $cuti->id)['menunggu']);
        $this->assertSame(2, KuotaCuti::rekap($this->magang)['menunggu']);
    }

    public function test_daftar_hari_kerja_keluar_sabtu_minggu_dan_libur(): void
    {
        \App\Models\HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $this->assertSame([
            '2026-10-19',
            '2026-10-21',
            '2026-10-22',
            '2026-10-23',
        ], Harian::tanggalHariKerja(
            Carbon::parse('2026-10-19', 'Asia/Jakarta'),
            Carbon::parse('2026-10-25', 'Asia/Jakarta')
        ));
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

    private function izin(string $jenis, string $mulai, string $selesai, string $status): Izin
    {
        return Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function absen(string $tanggal): Absen
    {
        return Absen::create([
            'pengguna_id' => $this->magang->id,
            'tanggal' => $tanggal,
            'tipe' => 'masuk',
            'waktu' => Carbon::parse($tanggal.' 08:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=KuotaCutiTest
```
Expected: FAIL — `Harian::tanggalHariKerja()` dan `App\Support\KuotaCuti` belum ada.

- [ ] **Step 3: Tambah `tanggalHariKerja()` ke `Harian`**

Di `backend/app/Support/Harian.php`, ganti isi `hitungHariKerja()` menjadi:

```php
    /** Jumlah hari kerja antara dua tanggal, tanpa Sabtu, Minggu, dan hari libur. */
    public static function hitungHariKerja(Carbon $dari, Carbon $sampai): int
    {
        return count(self::tanggalHariKerja($dari, $sampai));
    }

    /**
     * Daftar tanggal kerja (YYYY-MM-DD), inklusif.
     *
     * Satu definisi dipakai laporan, kuota cuti, dan validasi pengajuan izin.
     *
     * @return array<int, string>
     */
    public static function tanggalHariKerja(Carbon $dari, Carbon $sampai): array
    {
        if ($sampai->lt($dari)) {
            return [];
        }

        $libur = HariLibur::whereBetween('tanggal', [$dari->toDateString(), $sampai->toDateString()])
            ->pluck('tanggal')
            ->map(fn ($tanggal) => Carbon::parse($tanggal)->format('Y-m-d'))
            ->flip();

        $hasil = [];

        for ($hari = $dari->copy(); $hari->lte($sampai); $hari->addDay()) {
            $kunci = $hari->format('Y-m-d');

            if (! $hari->isWeekend() && ! $libur->has($kunci)) {
                $hasil[] = $kunci;
            }
        }

        return $hasil;
    }
```

- [ ] **Step 4: Buat `KuotaCuti`**

Buat `backend/app/Support/KuotaCuti.php`:

```php
<?php

namespace App\Support;

use App\Models\Absen;
use App\Models\Izin;
use App\Models\Pengguna;
use Illuminate\Support\Carbon;

class KuotaCuti
{
    /**
     * Kuota cuti tahun kalender berjalan.
     *
     * Hanya `cuti` yang memotong jatah. Hari yang sudah ada absennya tidak
     * dihitung sebagai cuti terpakai karena laporan memenangkan absen.
     *
     * @return array{jatah: int, terpakai: int, menunggu: int, sisa: int}
     */
    public static function rekap(Pengguna $pengguna, ?int $kecualiIzinId = null): array
    {
        [$awal, $akhir] = self::rentangTahun($pengguna);

        $izin = Izin::where('pengguna_id', $pengguna->id)
            ->where('jenis', 'cuti')
            ->whereIn('status', ['disetujui', 'menunggu'])
            ->where('mulai', '<=', $akhir->toDateString())
            ->where('selesai', '>=', $awal->toDateString())
            ->when($kecualiIzinId, fn ($q) => $q->where('id', '!=', $kecualiIzinId))
            ->get();

        $absen = Absen::where('pengguna_id', $pengguna->id)
            ->whereBetween('tanggal', [$awal->toDateString(), $akhir->toDateString()])
            ->get(['tanggal'])
            ->map(fn (Absen $a) => $a->tanggal->format('Y-m-d'))
            ->flip();

        $terpakai = [];
        $menunggu = [];

        foreach ($izin as $z) {
            foreach (self::tanggalDalamKuota($pengguna, $z->mulai, $z->selesai) as $tanggal) {
                if ($z->status === 'menunggu') {
                    $menunggu[$tanggal] = true;
                } elseif (! $absen->has($tanggal)) {
                    $terpakai[$tanggal] = true;
                }
            }
        }

        $jatah = (int) $pengguna->cuti_kuota;
        $jumlahTerpakai = count($terpakai);
        $jumlahMenunggu = count($menunggu);

        return [
            'jatah' => $jatah,
            'terpakai' => $jumlahTerpakai,
            'menunggu' => $jumlahMenunggu,
            'sisa' => $jatah - $jumlahTerpakai - $jumlahMenunggu,
        ];
    }

    /**
     * Tanggal kerja dalam rentang yang masih masuk tahun kuota berjalan.
     *
     * @return array<int, string>
     */
    public static function tanggalDalamKuota(Pengguna $pengguna, Carbon $mulai, Carbon $selesai): array
    {
        [$awal, $akhir] = self::rentangTahun($pengguna);

        $dari = $mulai->greaterThan($awal) ? $mulai : $awal;
        $sampai = $selesai->lessThan($akhir) ? $selesai : $akhir;

        if ($sampai->lt($dari)) {
            return [];
        }

        return Harian::tanggalHariKerja($dari, $sampai);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private static function rentangTahun(Pengguna $pengguna): array
    {
        $awal = now()->copy()->startOfYear()->startOfDay();
        $akhir = now()->copy()->endOfYear()->startOfDay();

        if ($pengguna->masuk_kerja && $pengguna->masuk_kerja->greaterThan($awal)) {
            $awal = $pengguna->masuk_kerja->copy()->startOfDay();
        }

        return [$awal, $akhir];
    }
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=KuotaCutiTest
```
Expected: PASS (3 tes).

- [ ] **Step 6: Catat aturan tahun di kontrak**

Di `KONTRAK-API.md`, bagian **Izin & cuti**, setelah paragraf bentuk kuota, tambahkan:

```markdown
Kuota dihitung untuk **tahun kalender berjalan** dan dimulai dari `masuk_kerja`
orang itu. Cuti yang rentangnya melewati pergantian tahun dihitung pada tahun
masing-masing; `GET /saya/izin` hanya menampilkan kuota tahun berjalan. Hari
yang sudah punya absen tidak dihitung sebagai cuti terpakai, karena absen
memenangkan hari itu di laporan.
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/Support/Harian.php backend/app/Support/KuotaCuti.php backend/tests/Feature/KuotaCutiTest.php KONTRAK-API.md
git commit -m "feat: tambah perhitungan kuota cuti"
```

---

### Task 4: `GET /saya/izin`

**Files:**
- Create: `backend/app/Http/Controllers/SayaIzinController.php`
- Create: `backend/tests/Feature/SayaIzinTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: `Izin::apiArray()`, `KuotaCuti::rekap(Pengguna)`.
- Produces: `GET /api/saya/izin` → `{data: Izin[], kuota: {jatah, terpakai, menunggu, sisa}}`, urut `diajukan` menurun.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/SayaIzinTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
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

        Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-26',
            'selesai' => '2026-10-27',
            'alasan' => 'Keperluan keluarga',
            'status' => 'disetujui',
            'diajukan_at' => Carbon::parse('2026-10-18 09:15:00', 'Asia/Jakarta'),
            'diputuskan_at' => Carbon::parse('2026-10-19 10:00:00', 'Asia/Jakarta'),
        ]);

        Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'izin',
            'mulai' => '2026-10-28',
            'selesai' => '2026-10-28',
            'alasan' => 'Urusan bank',
            'status' => 'menunggu',
            'diajukan_at' => Carbon::parse('2026-10-20 11:00:00', 'Asia/Jakarta'),
        ]);

        Izin::create([
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
            ->getJson('/api/saya/izin')
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

        $this->assertSame('izin', $res->json('data.0.jenis'));
        $this->assertSame('cuti', $res->json('data.1.jenis'));
        $this->assertSame('sakit', $res->json('data.2.jenis'));
        $this->assertSame('Surat dokter tidak ada.', $res->json('data.2.catatan_admin'));
    }

    public function test_daftar_izin_wajib_login(): void
    {
        $this->getJson('/api/saya/izin')
            ->assertStatus(401)
            ->assertJsonPath('kode', 'sesi_habis');
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
        return $this->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=SayaIzinTest
```
Expected: FAIL — route `/api/saya/izin` belum ada.

- [ ] **Step 3: Buat controller dengan method `index`**

Buat `backend/app/Http/Controllers/SayaIzinController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Izin;
use App\Support\KuotaCuti;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
```

- [ ] **Step 4: Daftarkan rute**

Di `backend/routes/api.php`, tambahkan import:

```php
use App\Http\Controllers\SayaIzinController;
```

Lalu di dalam grup `auth.token`:

```php
Route::get('/saya/izin', [SayaIzinController::class, 'index']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=SayaIzinTest
```
Expected: PASS (2 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/SayaIzinController.php backend/tests/Feature/SayaIzinTest.php backend/routes/api.php
git commit -m "feat: tambah daftar izin magang"
```

---

### Task 5: `POST /saya/izin`

**Files:**
- Modify: `backend/app/Http/Controllers/SayaIzinController.php`
- Modify: `backend/tests/Feature/SayaIzinTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: `Harian::tanggalHariKerja()`, `KuotaCuti::rekap()`, `KuotaCuti::tanggalDalamKuota()`.
- Produces: `POST /api/saya/izin` → `201` dengan `Izin::apiArray()`; `422` untuk validasi/kuota/tanpa hari kerja/tanggal lewat; `409` untuk bentrok absen/pengajuan.

- [ ] **Step 1: Tambahkan tes yang gagal**

Tambahkan method berikut ke `backend/tests/Feature/SayaIzinTest.php`, sebelum `buatPengguna()`:

```php
    public function test_magang_mengajukan_cuti(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'alasan' => '  Keperluan keluarga  ',
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'menunggu')
            ->assertJsonPath('jenis', 'cuti')
            ->assertJsonPath('alasan', 'Keperluan keluarga')
            ->assertJsonPath('hari_kerja', 2)
            ->assertJsonPath('catatan_admin', null);

        $this->assertDatabaseHas('izin', [
            'pengguna_id' => $this->magang->id,
            'jenis' => 'cuti',
            'mulai' => '2026-10-26 00:00:00',
            'selesai' => '2026-10-27 00:00:00',
            'status' => 'menunggu',
        ]);
    }

    public function test_izin_dan_sakit_tidak_memotong_kuota(): void
    {
        $this->magang->update(['cuti_kuota' => 0]);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', [
                'jenis' => 'sakit',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'alasan' => 'Demam tinggi',
            ])
            ->assertCreated()
            ->assertJsonPath('jenis', 'sakit')
            ->assertJsonPath('hari_kerja', 2);
    }

    public function test_pengajuan_ditolak_sesuai_aturan(): void
    {
        $token = $this->token();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'libur',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'alasan' => 'Alasan uji',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('jenis');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-27',
                'selesai' => '2026-10-26',
                'alasan' => 'Alasan uji',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('selesai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-19',
                'selesai' => '2026-10-20',
                'alasan' => 'Alasan uji',
            ])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'tanggal_lewat');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-24',
                'selesai' => '2026-10-25',
                'alasan' => 'Alasan uji',
            ])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'tanpa_hari_kerja');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'alasan' => 'abc',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('alasan');
    }

    public function test_absen_dan_pengajuan_lain_menghalangi(): void
    {
        $token = $this->token();

        \App\Models\Absen::create([
            'pengguna_id' => $this->magang->id,
            'tanggal' => '2026-10-26',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-26 08:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'izin',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'alasan' => 'Urusan keluarga',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'bentrok_absen');

        Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => 'izin',
            'mulai' => '2026-10-27',
            'selesai' => '2026-10-28',
            'alasan' => 'Pengajuan lama',
            'status' => 'menunggu',
            'diajukan_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-28',
                'selesai' => '2026-10-29',
                'alasan' => 'Keperluan keluarga',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'bentrok_izin');
    }

    public function test_cuti_melebihi_sisa_ditolak(): void
    {
        $this->magang->update(['cuti_kuota' => 1]);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/saya/izin', [
                'jenis' => 'cuti',
                'mulai' => '2026-10-26',
                'selesai' => '2026-10-27',
                'alasan' => 'Keperluan keluarga',
            ])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Anda 1 hari, sedangkan yang diajukan 2 hari.');
    }
```

Tambahkan juga import `App\Models\Izin` bila belum ada (sudah ada di Task 4) dan `App\Models\Absen` bila memakai nama pendek; tes di atas memakai FQCN sehingga tidak wajib.

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=SayaIzinTest
```
Expected: FAIL — `POST /api/saya/izin` masih 405/404.

- [ ] **Step 3: Tambahkan method `store`**

Tambahkan import di `SayaIzinController.php`:

```php
use App\Models\Absen;
use App\Models\Pengguna;
use App\Support\Harian;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
```

Lalu tambahkan method berikut setelah `index()`:

```php
    public function store(Request $request): JsonResponse
    {
        if ($request->exists('alasan')) {
            $request->merge(['alasan' => trim((string) $request->input('alasan'))]);
        }

        $data = $request->validate([
            'jenis' => ['required', Rule::in(Izin::JENIS)],
            'mulai' => ['required', 'date_format:Y-m-d'],
            'selesai' => ['required', 'date_format:Y-m-d', 'after_or_equal:mulai'],
            'alasan' => ['required', 'string', 'min:4', 'max:500'],
        ], [
            'jenis.required' => 'Jenis pengajuan wajib dipilih.',
            'jenis.in' => 'Jenis pengajuan harus cuti, izin, atau sakit.',
            'mulai.required' => 'Tanggal mulai wajib diisi.',
            'mulai.date_format' => 'Tanggal mulai harus berbentuk YYYY-MM-DD.',
            'selesai.required' => 'Tanggal selesai wajib diisi.',
            'selesai.date_format' => 'Tanggal selesai harus berbentuk YYYY-MM-DD.',
            'selesai.after_or_equal' => 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
            'alasan.required' => 'Alasan wajib diisi.',
            'alasan.min' => 'Alasan minimal 4 karakter.',
            'alasan.max' => 'Alasan maksimal 500 karakter.',
        ]);

        $pengguna = $request->attributes->get('pengguna');
        $mulai = Carbon::createFromFormat('!Y-m-d', $data['mulai'])->startOfDay();
        $selesai = Carbon::createFromFormat('!Y-m-d', $data['selesai'])->startOfDay();

        if ($selesai->lt(now()->startOfDay())) {
            return $this->galat(
                'Pengajuan yang seluruh tanggalnya sudah lewat tidak bisa dikirim.',
                422,
                'tanggal_lewat'
            );
        }

        $hariKerja = Harian::tanggalHariKerja($mulai, $selesai);

        if (count($hariKerja) === 0) {
            return $this->galat(
                'Rentang itu tidak memuat hari kerja. Sabtu, Minggu, dan hari libur tidak perlu diajukan.',
                422,
                'tanpa_hari_kerja'
            );
        }

        $hasil = DB::transaction(function () use ($pengguna, $data, $mulai, $selesai, $hariKerja) {
            Pengguna::whereKey($pengguna->id)->lockForUpdate()->first();

            $sudahAbsen = Absen::where('pengguna_id', $pengguna->id)
                ->whereIn('tanggal', $hariKerja)
                ->exists();

            if ($sudahAbsen) {
                return ['galat' => [
                    'Anda sudah punya catatan absen pada rentang itu. Hari yang sudah Anda masuki tidak bisa diajukan sebagai izin atau cuti.',
                    409,
                    'bentrok_absen',
                ]];
            }

            $bentrok = Izin::where('pengguna_id', $pengguna->id)
                ->whereIn('status', ['menunggu', 'disetujui'])
                ->where('mulai', '<=', $selesai->toDateString())
                ->where('selesai', '>=', $mulai->toDateString())
                ->exists();

            if ($bentrok) {
                return ['galat' => [
                    'Anda masih punya pengajuan lain pada tanggal yang sama.',
                    409,
                    'bentrok_izin',
                ]];
            }

            if ($data['jenis'] === 'cuti') {
                $jumlah = count(KuotaCuti::tanggalDalamKuota($pengguna, $mulai, $selesai));
                $kuota = KuotaCuti::rekap($pengguna);

                if ($jumlah > $kuota['sisa']) {
                    return ['galat' => [
                        "Sisa cuti Anda {$kuota['sisa']} hari, sedangkan yang diajukan {$jumlah} hari.",
                        422,
                        'kuota_tidak_cukup',
                    ]];
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
```

- [ ] **Step 4: Daftarkan rute**

Di dalam grup `auth.token`, setelah `GET /saya/izin`:

```php
Route::post('/saya/izin', [SayaIzinController::class, 'store']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=SayaIzinTest
```
Expected: PASS (7 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/SayaIzinController.php backend/tests/Feature/SayaIzinTest.php backend/routes/api.php
git commit -m "feat: tambah pengajuan izin magang"
```

---

### Task 6: `GET /admin/izin`

**Files:**
- Create: `backend/app/Http/Controllers/AdminIzinController.php`
- Create: `backend/tests/Feature/AdminIzinListTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: `Izin::apiArray()`.
- Produces: `GET /api/admin/izin?status=menunggu|disetujui|ditolak|semua` → `{data, jumlah: {menunggu, disetujui, ditolak, semua}}`; default `menunggu`; urut `diajukan` menurun.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/AdminIzinListTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminIzinListTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin');
        $this->magang = $this->buatPengguna('MGG001', 'Nurul Hidayah', 'magang');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_daftar_default_menunggu_dan_jumlah_semua_status(): void
    {
        $this->izin('cuti', 'menunggu', '2026-10-18 09:15:00');
        $this->izin('izin', 'disetujui', '2026-10-17 09:15:00');
        $this->izin('sakit', 'ditolak', '2026-10-16 09:15:00');
        $this->izin('cuti', 'menunggu', '2026-10-20 09:15:00');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/izin')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('jumlah.menunggu', 2)
            ->assertJsonPath('jumlah.disetujui', 1)
            ->assertJsonPath('jumlah.ditolak', 1)
            ->assertJsonPath('jumlah.semua', 4)
            ->assertJsonPath('data.0.status', 'menunggu')
            ->assertJsonPath('data.1.status', 'menunggu');

        $this->assertSame('Nurul Hidayah', $res->json('data.0.nama'));
        $this->assertSame('MGG001', $res->json('data.0.nip'));
        $this->assertSame('Pendataan', $res->json('data.0.divisi'));
    }

    public function test_status_semua_dan_status_tidak_sah(): void
    {
        $this->izin('cuti', 'menunggu', '2026-10-18 09:15:00');
        $this->izin('izin', 'disetujui', '2026-10-17 09:15:00');

        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/izin?status=semua')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/izin?status=entah')
            ->assertStatus(422)
            ->assertJsonPath('kode', 'status_tidak_valid');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/izin?status=disetujui')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'disetujui');
    }

    public function test_magang_tidak_boleh_membuka_daftar_izin_admin(): void
    {
        $token = $this->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/izin')
            ->assertStatus(403)
            ->assertJsonPath('kode', 'tidak_berhak');
    }

    private function buatPengguna(string $nip, string $nama, string $peran): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    private function izin(string $jenis, string $status, string $diajukan): Izin
    {
        return Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => $jenis,
            'mulai' => '2026-10-26',
            'selesai' => '2026-10-27',
            'alasan' => 'Alasan uji',
            'status' => $status,
            'catatan_admin' => $status === 'ditolak' ? 'Catatan uji' : null,
            'diajukan_at' => Carbon::parse($diajukan, 'Asia/Jakarta'),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=AdminIzinListTest
```
Expected: FAIL — route belum ada.

- [ ] **Step 3: Buat controller dengan method `index`**

Buat `backend/app/Http/Controllers/AdminIzinController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Izin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminIzinController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = (string) $request->query('status', 'menunggu');

        if (! in_array($status, ['menunggu', 'disetujui', 'ditolak', 'semua'], true)) {
            return $this->galat(
                'Status harus menunggu, disetujui, ditolak, atau semua.',
                422,
                'status_tidak_valid'
            );
        }

        $query = Izin::with('pengguna')
            ->orderByDesc('diajukan_at')
            ->orderByDesc('id');

        if ($status !== 'semua') {
            $query->where('status', $status);
        }

        $data = $query->get()
            ->map(fn (Izin $izin) => $izin->apiArray())
            ->values();

        $jumlah = Izin::selectRaw('status, COUNT(*) as jumlah')
            ->groupBy('status')
            ->pluck('jumlah', 'status');

        return response()->json([
            'data' => $data,
            'jumlah' => [
                'menunggu' => (int) ($jumlah['menunggu'] ?? 0),
                'disetujui' => (int) ($jumlah['disetujui'] ?? 0),
                'ditolak' => (int) ($jumlah['ditolak'] ?? 0),
                'semua' => (int) $jumlah->sum(),
            ],
        ]);
    }
}
```

- [ ] **Step 4: Daftarkan rute**

Di `backend/routes/api.php`, tambahkan import:

```php
use App\Http\Controllers\AdminIzinController;
```

Di dalam grup `admin`:

```php
Route::get('/izin', [AdminIzinController::class, 'index']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=AdminIzinListTest
```
Expected: PASS (3 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/AdminIzinController.php backend/tests/Feature/AdminIzinListTest.php backend/routes/api.php
git commit -m "feat: tambah daftar izin admin"
```

---

### Task 7: Setujui dan tolak izin

**Files:**
- Modify: `backend/app/Http/Controllers/AdminIzinController.php`
- Create: `backend/tests/Feature/AdminIzinKeputusanTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: `KuotaCuti::rekap(Pengguna, ?int)`, `KuotaCuti::tanggalDalamKuota()`, `Harian::tanggalHariKerja()`, `Audit::catat()`.
- Produces:
  - `POST /api/admin/izin/{id}/setujui` → `200 Izin::apiArray()`
  - `POST /api/admin/izin/{id}/tolak` body `{catatan}` → `200 Izin::apiArray()`
  - `404` tidak ditemukan; `409 sudah_diputuskan`; `422` catatan/rentang/kuota; `409 bentrok_izin`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/AdminIzinKeputusanTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminIzinKeputusanTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin', 12);
        $this->magang = $this->buatPengguna('MGG001', 'Nurul Hidayah', 'magang', 12);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_menyetujui_dan_audit_tercatat(): void
    {
        $izin = $this->izin('cuti', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertOk()
            ->assertJsonPath('status', 'disetujui')
            ->assertJsonPath('catatan_admin', null)
            ->assertJsonPath('pengguna_id', $this->magang->id);

        $this->assertDatabaseHas('izin', [
            'id' => $izin->id,
            'status' => 'disetujui',
            'diputuskan_oleh' => $this->admin->id,
        ]);

        $this->assertDatabaseHas('audit', [
            'pengguna_id' => $this->admin->id,
            'aksi' => 'setujui_izin',
        ]);
    }

    public function test_keputusan_kedua_dan_id_tidak_ada_ditolak(): void
    {
        $izin = $this->izin('cuti', '2026-10-26', '2026-10-27');
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", ['catatan' => 'Sudah telanjur'])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'sudah_diputuskan');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/izin/999999/setujui', [])
            ->assertStatus(404);
    }

    public function test_tolak_wajib_catatan_dan_menyimpannya(): void
    {
        $izin = $this->izin('izin', '2026-10-26', '2026-10-26');
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", ['catatan' => 'abc'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('catatan');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$izin->id}/tolak", [
                'catatan' => 'Beban kerja sedang tinggi.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'ditolak')
            ->assertJsonPath('catatan_admin', 'Beban kerja sedang tinggi.');

        $this->assertDatabaseHas('audit', ['aksi' => 'tolak_izin']);
    }

    public function test_menyetujui_rentang_lewat_atau_tanpa_hari_kerja_ditolak(): void
    {
        $lewat = $this->izin('sakit', '2026-10-19', '2026-10-20');
        $weekend = $this->izin('izin', '2026-10-24', '2026-10-25');
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$lewat->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_tidak_sah');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson("/api/admin/izin/{$weekend->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'rentang_tidak_sah');
    }

    public function test_menyetujui_cuti_melebihi_jatah_ditolak(): void
    {
        $this->magang->update(['cuti_kuota' => 1]);
        $izin = $this->izin('cuti', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertStatus(422)
            ->assertJsonPath('kode', 'kuota_tidak_cukup')
            ->assertJsonPath('message', 'Sisa cuti Nurul Hidayah 1 hari, sedangkan yang diajukan 2 hari.');
    }

    public function test_menyetujui_pengajuan_yang_tumpang_tindih_dengan_yang_disetujui_ditolak(): void
    {
        $this->izin('cuti', '2026-10-26', '2026-10-26', 'disetujui');
        $izin = $this->izin('izin', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'bentrok_izin');
    }

    public function test_menyetujui_sakit_tidak_memeriksa_kuota(): void
    {
        $this->magang->update(['cuti_kuota' => 0]);
        $izin = $this->izin('sakit', '2026-10-26', '2026-10-27');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson("/api/admin/izin/{$izin->id}/setujui", [])
            ->assertOk()
            ->assertJsonPath('status', 'disetujui');
    }

    private function buatPengguna(string $nip, string $nama, string $peran, int $jatah): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => $jatah,
            'aktif' => true,
        ]);
    }

    private function izin(
        string $jenis,
        string $mulai,
        string $selesai,
        string $status = 'menunggu'
    ): Izin {
        return Izin::create([
            'pengguna_id' => $this->magang->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=AdminIzinKeputusanTest
```
Expected: FAIL — method `setujui`/`tolak` belum ada.

- [ ] **Step 3: Implementasikan keputusan**

Tambahkan import di `AdminIzinController.php`:

```php
use App\Models\Audit;
use App\Support\Harian;
use App\Support\KuotaCuti;
use Illuminate\Support\Facades\DB;
```

Tambahkan method berikut setelah `index()`:

```php
    public function setujui(Request $request, int $id): JsonResponse
    {
        return $this->putuskan($request, $id, 'disetujui');
    }

    public function tolak(Request $request, int $id): JsonResponse
    {
        return $this->putuskan($request, $id, 'ditolak');
    }

    private function putuskan(Request $request, int $id, string $keputusan): JsonResponse
    {
        if ($keputusan === 'ditolak') {
            $request->validate([
                'catatan' => ['required', 'string', 'min:4', 'max:500'],
            ], [
                'catatan.required' => 'Catatan wajib diisi saat menolak pengajuan.',
                'catatan.min' => 'Catatan minimal 4 karakter.',
                'catatan.max' => 'Catatan maksimal 500 karakter.',
            ]);
        }

        $aktor = $request->attributes->get('pengguna');

        $hasil = DB::transaction(function () use ($id, $keputusan, $request, $aktor) {
            $izin = Izin::with('pengguna')->lockForUpdate()->find($id);

            if (! $izin) {
                return ['galat' => ['Pengajuan izin tidak ditemukan.', 404, 'tidak_ditemukan']];
            }

            if ($izin->status !== 'menunggu') {
                return ['galat' => ['Pengajuan ini sudah diputuskan.', 409, 'sudah_diputuskan']];
            }

            if ($keputusan === 'disetujui') {
                $hariKerja = Harian::tanggalHariKerja($izin->mulai, $izin->selesai);

                if (count($hariKerja) === 0 || $izin->selesai->lt(now()->startOfDay())) {
                    return ['galat' => [
                        'Rentang pengajuan ini sudah lewat atau tidak memuat hari kerja.',
                        422,
                        'rentang_tidak_sah',
                    ]];
                }

                $bentrok = Izin::where('pengguna_id', $izin->pengguna_id)
                    ->where('status', 'disetujui')
                    ->where('id', '!=', $izin->id)
                    ->where('mulai', '<=', $izin->selesai->toDateString())
                    ->where('selesai', '>=', $izin->mulai->toDateString())
                    ->exists();

                if ($bentrok) {
                    return ['galat' => [
                        'Sudah ada pengajuan lain yang disetujui pada tanggal itu.',
                        409,
                        'bentrok_izin',
                    ]];
                }

                if ($izin->jenis === 'cuti') {
                    $jumlah = count(KuotaCuti::tanggalDalamKuota($izin->pengguna, $izin->mulai, $izin->selesai));
                    $kuota = KuotaCuti::rekap($izin->pengguna, $izin->id);

                    if ($jumlah > $kuota['sisa']) {
                        return ['galat' => [
                            "Sisa cuti {$izin->pengguna->nama} {$kuota['sisa']} hari, sedangkan yang diajukan {$jumlah} hari.",
                            422,
                            'kuota_tidak_cukup',
                        ]];
                    }
                }
            }

            $izin->update([
                'status' => $keputusan,
                'catatan_admin' => $keputusan === 'ditolak'
                    ? trim((string) $request->input('catatan'))
                    : null,
                'diputuskan_at' => now(),
                'diputuskan_oleh' => $aktor->id,
            ]);

            return ['izin' => $izin];
        });

        if (isset($hasil['galat'])) {
            return $this->galat($hasil['galat'][0], $hasil['galat'][1], $hasil['galat'][2]);
        }

        $izin = $hasil['izin'];

        Audit::catat(
            $aktor->id,
            $keputusan === 'disetujui' ? 'setujui_izin' : 'tolak_izin',
            [
                'izin_id' => $izin->id,
                'pengguna_id' => $izin->pengguna_id,
                'jenis' => $izin->jenis,
                'mulai' => $izin->mulai->format('Y-m-d'),
                'selesai' => $izin->selesai->format('Y-m-d'),
            ],
            $request
        );

        return response()->json($izin->fresh(['pengguna'])->apiArray());
    }
```

- [ ] **Step 4: Daftarkan rute**

Di dalam grup `admin`, setelah `GET /izin`:

```php
Route::post('/izin/{id}/setujui', [AdminIzinController::class, 'setujui']);
Route::post('/izin/{id}/tolak', [AdminIzinController::class, 'tolak']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=AdminIzinKeputusanTest
```
Expected: PASS (7 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/AdminIzinController.php backend/tests/Feature/AdminIzinKeputusanTest.php backend/routes/api.php
git commit -m "feat: tambah keputusan izin admin"
```

---

### Task 8: Integrasi izin ke `Harian` dan laporan

**Files:**
- Modify: `backend/app/Support/Harian.php`
- Modify: `backend/app/Http/Controllers/AdminLaporanController.php`
- Create: `backend/tests/Feature/HarianIzinTest.php`

**Interfaces:**
- Consumes: `Izin` model.
- Produces: baris harian dengan `status` ∈ `izin|cuti|sakit`, `keterangan_izin`, `alasan_izin`; laporan memilih pengguna yang punya izin disetujui di bulan itu.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/HarianIzinTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class HarianIzinTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin', true);
        $this->magang = $this->buatPengguna('MGG001', 'Magang Uji', 'magang', true);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_prioritas_libur_absen_lalu_izin(): void
    {
        HariLibur::create(['tanggal' => '2026-10-20', 'keterangan' => 'Libur Uji']);

        $this->izin('cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->izin('sakit', '2026-10-20', '2026-10-20', 'disetujui');
        $this->izin('izin', '2026-10-26', '2026-10-26', 'menunggu');

        $this->absen('2026-10-22');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenMagang())
            ->getJson('/api/saya/absen?bulan=2026-10')
            ->assertOk();

        $hari = collect($res->json('data'))->keyBy('tanggal');

        $this->assertSame('libur', $hari['2026-10-20']['status']);
        $this->assertSame('Libur Uji', $hari['2026-10-20']['keterangan_libur']);

        // Absen menang atas izin pada hari yang sama.
        $this->assertSame('tepat', $hari['2026-10-22']['status']);
        $this->assertNull($hari['2026-10-22']['keterangan_izin']);

        $this->assertSame('cuti', $hari['2026-10-23']['status']);
        $this->assertSame('cuti', $hari['2026-10-23']['keterangan_izin']);
        $this->assertSame('Alasan uji', $hari['2026-10-23']['alasan_izin']);
        $this->assertNull($hari['2026-10-23']['masuk']);

        // Pengajuan menunggu belum menjadi status.
        $this->assertSame('belum', $hari['2026-10-26']['status']);
        $this->assertNull($hari['2026-10-26']['keterangan_izin']);

        $this->assertSame(3, $res->json('ringkasan.izin'));
    }

    public function test_laporan_memuat_nonaktif_yang_hanya_punya_izin_disetujui(): void
    {
        $nonaktif = $this->buatPengguna('MGG002', 'Magang Nonaktif', 'magang', false);
        $this->izinUntuk($nonaktif, 'cuti', '2026-10-22', '2026-10-23', 'disetujui');
        $this->izinUntuk($this->magang, 'sakit', '2026-10-27', '2026-10-27', 'disetujui');
        $this->izinUntuk($this->magang, 'izin', '2026-10-28', '2026-10-28', 'menunggu');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/laporan?bulan=2026-10')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $baris = collect($res->json('data'))->keyBy('nip');

        $this->assertFalse($baris['MGG002']['aktif']);
        $this->assertSame(2, $baris['MGG002']['cuti']);
        $this->assertSame(0, $baris['MGG002']['hadir']);
        $this->assertSame(1, $baris['MGG001']['sakit']);
        $this->assertSame(0, $baris['MGG001']['izin']);
        $this->assertSame(3, $res->json('ringkasan.izin'));
    }

    private function buatPengguna(string $nip, string $nama, string $peran, bool $aktif): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => $aktif,
        ]);
    }

    private function izin(string $jenis, string $mulai, string $selesai, string $status): Izin
    {
        return $this->izinUntuk($this->magang, $jenis, $mulai, $selesai, $status);
    }

    private function izinUntuk(
        Pengguna $pengguna,
        string $jenis,
        string $mulai,
        string $selesai,
        string $status
    ): Izin {
        return Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function absen(string $tanggal): Absen
    {
        return Absen::create([
            'pengguna_id' => $this->magang->id,
            'tanggal' => $tanggal,
            'tipe' => 'masuk',
            'waktu' => Carbon::parse($tanggal.' 08:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->shift->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->magang->nama,
            'nip_salinan' => $this->magang->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);
    }

    private function tokenMagang(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->magang->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=HarianIzinTest
```
Expected: FAIL — status cuti/sakit belum terbentuk, dan laporan belum memilih pengguna yang hanya punya izin.

- [ ] **Step 3: Sambungkan izin ke `Harian::susun()`**

Di `backend/app/Support/Harian.php`, tambahkan import:

```php
use App\Models\Izin;
```

Setelah blok `$libur = HariLibur::...;`, tambahkan:

```php
        $izinHari = [];

        Izin::where('pengguna_id', $pengguna->id)
            ->where('status', 'disetujui')
            ->whereIn('jenis', ['cuti', 'izin', 'sakit'])
            ->where('mulai', '<=', $akhir->toDateString())
            ->where('selesai', '>=', $awal->toDateString())
            ->get()
            ->each(function (Izin $izin) use (&$izinHari) {
                for ($tanggal = $izin->mulai->copy(); $tanggal->lte($izin->selesai); $tanggal->addDay()) {
                    $izinHari[$tanggal->format('Y-m-d')] = $izin;
                }
            });
```

Ganti blok penentuan status (dari komentar `// shortcut: tabel izin belum ada` sampai `else { ... }`) dengan:

```php
            $izin = $izinHari[$kunci] ?? null;
            $keteranganIzin = null;
            $alasanIzin = null;

            if ($hariLibur || $hari->isWeekend()) {
                $status = 'libur';
                $keteranganLibur = $hariLibur?->keterangan
                    ?? ($hari->isSaturday() ? 'Hari Sabtu' : 'Hari Minggu');
            } elseif ($masuk) {
                $status = (int) $masuk->telat_menit > 0 ? 'telat' : 'tepat';
                $keteranganLibur = null;
            } elseif ($hari->lt($mulai)) {
                $status = 'libur';
                $keteranganLibur = 'Belum masuk kerja';
            } elseif ($izin) {
                $status = $izin->jenis;
                $keteranganLibur = null;
                $keteranganIzin = $izin->jenis;
                $alasanIzin = $izin->alasan;
            } elseif ($hari->lt($hariIni)) {
                $status = 'alpha';
                $keteranganLibur = null;
            } else {
                $status = 'belum';
                $keteranganLibur = null;
            }
```

Di array baris harian, ganti:

```php
                'keterangan_izin' => null,
                'alasan_izin' => null,
```

menjadi:

```php
                'keterangan_izin' => $keteranganIzin,
                'alasan_izin' => $alasanIzin,
```

- [ ] **Step 4: Pilih pengguna bercatatan izin di laporan**

Di `backend/app/Http/Controllers/AdminLaporanController.php`, di dalam query `Pengguna::with('shift')`, tambahkan `orWhereExists` setelah blok `absen`:

```php
                })->orWhereExists(function ($q) use ($rentang) {
                    $q->selectRaw('1')
                        ->from('izin')
                        ->whereColumn('izin.pengguna_id', 'pengguna.id')
                        ->where('izin.status', 'disetujui')
                        ->where('izin.mulai', '<=', $rentang[1])
                        ->where('izin.selesai', '>=', $rentang[0]);
```

Hasil akhir closure harus tetap seimbang: `where(...)->orWhereExists(...)->orWhereExists(...)`.

- [ ] **Step 5: Jalankan tes baru dan tes laporan lama**

Run:
```bash
php artisan test --filter=HarianIzinTest
php artisan test --filter=AdminLaporanTest
```
Expected: PASS untuk keduanya. Tes lama tidak boleh berubah angkanya karena tidak ada data izin.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Support/Harian.php backend/app/Http/Controllers/AdminLaporanController.php backend/tests/Feature/HarianIzinTest.php
git commit -m "feat: sambungkan izin ke riwayat dan laporan"
```

---

### Task 9: Integrasi izin ke dashboard

**Files:**
- Modify: `backend/app/Http/Controllers/DashboardController.php`
- Create: `backend/tests/Feature/DashboardIzinTest.php`

**Interfaces:**
- Consumes: `Izin` model.
- Produces: `ringkasan.izin` dan array `izin` yang nyata; `total = sudah_masuk + belum_masuk + izin`; orang dengan absen tidak dihitung sebagai izin; hari libur tidak menampilkan izin.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/DashboardIzinTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\HariLibur;
use App\Models\Izin;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DashboardIzinTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-21 09:00:00', 'Asia/Jakarta'));

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

        $this->admin = $this->buatPengguna('ADM001', 'Administrator', 'admin', true);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_izin_mengurangi_belum_masuk_dan_total_tetap_pas(): void
    {
        $cuti = $this->buatPengguna('MGG001', 'Dewi Lestari', 'magang', true);
        $belum = $this->buatPengguna('MGG002', 'Rizal Fadillah', 'magang', true);
        $hadir = $this->buatPengguna('MGG003', 'Lukman Hakim', 'magang', true);
        $adminIzin = $this->buatPengguna('ADM002', 'Admin Izin', 'admin', true);
        $this->buatPengguna('ADM003', 'Admin Tanpa Catatan', 'admin', true);

        $this->izin($cuti, 'cuti', '2026-10-21', '2026-10-21', 'disetujui');
        $this->izin($adminIzin, 'izin', '2026-10-21', '2026-10-21', 'disetujui');
        $this->izin($belum, 'sakit', '2026-10-22', '2026-10-22', 'disetujui');

        // Absen menang atas izin: orang ini tetap dihitung hadir, bukan izin.
        $this->izin($hadir, 'izin', '2026-10-21', '2026-10-21', 'disetujui');
        $this->absen($hadir);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('ringkasan.total', 4)
            ->assertJsonPath('ringkasan.sudah_masuk', 1)
            ->assertJsonPath('ringkasan.belum_masuk', 1)
            ->assertJsonPath('ringkasan.izin', 2)
            ->assertJsonCount(1, 'belum_masuk')
            ->assertJsonPath('belum_masuk.0.nama', 'Rizal Fadillah')
            ->assertJsonCount(2, 'izin');

        $namaIzin = array_column($res->json('izin'), 'nama');
        sort($namaIzin);
        $this->assertSame(['Admin Izin', 'Dewi Lestari'], $namaIzin);

        $baris = collect($res->json('izin'))->keyBy('nama');
        $this->assertSame('cuti', $baris['Dewi Lestari']['jenis']);
        $this->assertSame('2026-10-21', $baris['Dewi Lestari']['mulai']);
        $this->assertSame('2026-10-21', $baris['Dewi Lestari']['selesai']);
        $this->assertSame('Alasan uji', $baris['Dewi Lestari']['alasan']);
    }

    public function test_hari_libur_tidak_menampilkan_izin(): void
    {
        $cuti = $this->buatPengguna('MGG010', 'Magang Libur', 'magang', true);
        $this->izin($cuti, 'cuti', '2026-10-24', '2026-10-24', 'disetujui');

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/dashboard?tanggal=2026-10-24')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('ringkasan.total', 0)
            ->assertJsonPath('ringkasan.izin', 0)
            ->assertJsonCount(0, 'belum_masuk')
            ->assertJsonCount(0, 'izin');

        HariLibur::create(['tanggal' => '2026-10-21', 'keterangan' => 'Libur Uji']);
        $this->izin($cuti, 'izin', '2026-10-21', '2026-10-21', 'disetujui');

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('ringkasan.izin', 0)
            ->assertJsonCount(0, 'izin');
    }

    private function buatPengguna(string $nip, string $nama, string $peran, bool $aktif): Pengguna
    {
        return Pengguna::create([
            'nama' => $nama,
            'email' => strtolower($nip).'@kantor.id',
            'nip' => $nip,
            'pin_hash' => Hash::make('1357'),
            'peran' => $peran,
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => $aktif,
        ]);
    }

    private function izin(
        Pengguna $pengguna,
        string $jenis,
        string $mulai,
        string $selesai,
        string $status
    ): Izin {
        return Izin::create([
            'pengguna_id' => $pengguna->id,
            'jenis' => $jenis,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'alasan' => 'Alasan uji',
            'status' => $status,
            'diajukan_at' => now(),
            'diputuskan_at' => $status === 'menunggu' ? null : now(),
        ]);
    }

    private function absen(Pengguna $pengguna): Absen
    {
        return Absen::create([
            'pengguna_id' => $pengguna->id,
            'tanggal' => '2026-10-21',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-21 07:55:00', 'Asia/Jakarta'),
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

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => $this->admin->nip,
            'pin' => '1357',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=DashboardIzinTest
```
Expected: FAIL — `ringkasan.izin` masih `0`.

- [ ] **Step 3: Implementasikan izin di dashboard**

Di `backend/app/Http/Controllers/DashboardController.php`, tambahkan import:

```php
use App\Models\Izin;
```

Setelah `$absenHari = ...;` tambahkan:

```php
        $izinHari = Izin::with('pengguna')
            ->where('status', 'disetujui')
            ->whereIn('jenis', ['cuti', 'izin', 'sakit'])
            ->where('mulai', '<=', $tanggalStr)
            ->where('selesai', '>=', $tanggalStr)
            ->orderBy('id')
            ->get()
            ->keyBy('pengguna_id');
```

Ganti blok pembentukan `$idAbsen` dan query `$kandidat` menjadi:

```php
        $idTerlibat = $absenHari->pluck('pengguna_id')
            ->merge($izinHari->keys())
            ->unique()
            ->values()
            ->all();

        $kandidat = Pengguna::with(['shift', 'lokasi'])
            ->where(function ($q) use ($tanggalStr, $idTerlibat) {
                $q->where(function ($q) use ($tanggalStr) {
                    $q->where('peran', 'magang')
                        ->where('aktif', true)
                        ->whereDate('masuk_kerja', '<=', $tanggalStr);
                })->orWhereIn('id', $idTerlibat);
            })
            ->get();
```

Ganti blok `$sudahMasuk`, `$belumMasuk`, dan `$idSudahMasuk` menjadi:

```php
        $masuk = $absenHari->where('tipe', 'masuk')->keyBy('pengguna_id');

        $sudahMasuk = $kandidat->filter(fn (Pengguna $p) => $masuk->has($p->id))->values();

        $izinOrang = $hariKerja
            ? $kandidat->filter(
                fn (Pengguna $p) => $izinHari->has($p->id) && ! $masuk->has($p->id)
            )->values()
            : collect();

        $idIzin = array_flip($izinOrang->pluck('id')->all());

        $belumMasuk = $hariKerja
            ? $kandidat->reject(
                fn (Pengguna $p) => $masuk->has($p->id) || isset($idIzin[$p->id])
            )->values()
            : collect();

        $idSudahMasuk = $sudahMasuk->pluck('id')->all();
```

Ganti isi `ringkasan` menjadi:

```php
            'ringkasan' => [
                'total' => $sudahMasuk->count() + $belumMasuk->count() + $izinOrang->count(),
                'sudah_masuk' => $sudahMasuk->count(),
                'belum_masuk' => $belumMasuk->count(),
                'izin' => $izinOrang->count(),
                'telat' => $terlambat->count(),
            ],
```

Ganti `'izin' => [],` menjadi:

```php
            'izin' => $izinOrang->map(function (Pengguna $p) use ($izinHari) {
                $izin = $izinHari->get($p->id);

                return [
                    'id' => $izin->id,
                    'nama' => $p->nama,
                    'nip' => $p->nip,
                    'divisi' => $p->divisi,
                    'jenis' => $izin->jenis,
                    'mulai' => $izin->mulai->format('Y-m-d'),
                    'selesai' => $izin->selesai->format('Y-m-d'),
                    'alasan' => $izin->alasan,
                ];
            })->values(),
```

- [ ] **Step 4: Jalankan tes baru dan tes dashboard lama**

Run:
```bash
php artisan test --filter=DashboardIzinTest
php artisan test --filter=test_dashboard_menghitung_hari_kerja_dan_libur
```
Expected: PASS untuk keduanya. Tes lama tetap `total=2`, `izin=0` karena tidak ada data izin.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/DashboardController.php backend/tests/Feature/DashboardIzinTest.php
git commit -m "feat: tampilkan izin di dashboard"
```

---

### Task 10: CRUD shift

**Files:**
- Modify: `backend/app/Http/Controllers/AdminDataController.php`
- Create: `backend/tests/Feature/AdminShiftTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Produces:
  - `GET /api/admin/shift` (sudah ada, serializer dipusatkan)
  - `POST /api/admin/shift` → `201` objek shift
  - `PUT /api/admin/shift/{id}` → `200` objek shift (parsial)
  - `DELETE /api/admin/shift/{id}` → `200 {ok:true}` atau tiga `409` sesuai kontrak.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/AdminShiftTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\Absen;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminShiftTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $reguler;

    private Pengguna $admin;

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

        $this->reguler = Shift::create([
            'nama' => 'Reguler',
            'masuk' => '08:00',
            'pulang' => '17:00',
            'toleransi_menit' => 15,
            'aktif' => true,
        ]);

        $this->admin = Pengguna::create([
            'nama' => 'Administrator',
            'email' => 'adm001@kantor.id',
            'nip' => 'ADM001',
            'pin_hash' => Hash::make('2468'),
            'peran' => 'admin',
            'divisi' => 'Pendataan',
            'shift_id' => $this->reguler->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_membuat_shift_malam_tanpa_menolak_pulang_lebih_kecil(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->postJson('/api/admin/shift', [
                'nama' => '  Shift Malam  ',
                'masuk' => '22:00',
                'pulang' => '06:00',
                'toleransi_menit' => '10',
                'aktif' => 'true',
            ])
            ->assertCreated()
            ->assertJsonPath('nama', 'Shift Malam')
            ->assertJsonPath('masuk', '22:00')
            ->assertJsonPath('pulang', '06:00')
            ->assertJsonPath('toleransi_menit', 10)
            ->assertJsonPath('aktif', true)
            ->assertJsonPath('jumlah_magang', 0);

        $this->assertDatabaseHas('shift', ['nama' => 'Shift Malam', 'pulang' => '06:00:00']);
        $this->assertDatabaseHas('audit', ['aksi' => 'tambah_shift']);
    }

    public function test_nama_kembar_dan_validasi_jam(): void
    {
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/shift', [
                'nama' => 'reguler',
                'masuk' => '08:00',
                'pulang' => '17:00',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'nama_dipakai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/shift', [
                'nama' => 'Sore',
                'masuk' => '25:00',
                'pulang' => '17:00',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('masuk');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/shift', [
                'nama' => 'Sore',
                'masuk' => '08:00',
                'pulang' => '17:00',
                'toleransi_menit' => 121,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('toleransi_menit');
    }

    public function test_put_parsial_tidak_menyentuh_jam_lain(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->putJson("/api/admin/shift/{$this->reguler->id}", [
                'nama' => 'Reguler Baru',
            ])
            ->assertOk()
            ->assertJsonPath('nama', 'Reguler Baru')
            ->assertJsonPath('masuk', '08:00')
            ->assertJsonPath('pulang', '17:00')
            ->assertJsonPath('toleransi_menit', 15);

        $this->assertDatabaseHas('audit', ['aksi' => 'ubah_shift']);
    }

    public function test_shift_terakhir_tidak_bisa_dihapus(): void
    {
        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$this->reguler->id}")
            ->assertStatus(409)
            ->assertJsonPath('kode', 'shift_terakhir')
            ->assertJsonPath(
                'message',
                'Ini satu-satunya shift. Tanpa shift, tidak ada yang bisa dipilih saat menambah anak magang.'
            );
    }

    public function test_shift_yang_dipakai_pengguna_tidak_bisa_dihapus(): void
    {
        $lain = Shift::create([
            'nama' => 'Sore',
            'masuk' => '13:00',
            'pulang' => '21:00',
            'toleransi_menit' => 10,
            'aktif' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$this->reguler->id}")
            ->assertStatus(409)
            ->assertJsonPath('kode', 'shift_dipakai_pengguna')
            ->assertJsonPath(
                'message',
                'Shift ini masih dipakai 1 orang. Pindahkan mereka ke shift lain dulu, atau nonaktifkan shift ini.'
            );
    }

    public function test_shift_yang_dipakai_absen_tidak_bisa_dihapus(): void
    {
        $sore = Shift::create([
            'nama' => 'Sore',
            'masuk' => '13:00',
            'pulang' => '21:00',
            'toleransi_menit' => 10,
            'aktif' => true,
        ]);

        $this->admin->update(['shift_id' => $sore->id]);

        Absen::create([
            'pengguna_id' => $this->admin->id,
            'tanggal' => '2026-10-20',
            'tipe' => 'masuk',
            'waktu' => Carbon::parse('2026-10-20 13:00:00', 'Asia/Jakarta'),
            'lokasi_id' => $this->lokasi->id,
            'mode' => 'kantor',
            'shift_id' => $this->reguler->id,
            'telat_menit' => 0,
            'nama_salinan' => $this->admin->nama,
            'nip_salinan' => $this->admin->nip,
            'kiosk_id' => 'kiosk-uji',
            'created_at' => now(),
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$this->reguler->id}")
            ->assertStatus(409)
            ->assertJsonPath('kode', 'shift_dipakai_absen')
            ->assertJsonPath(
                'message',
                'Shift ini dipakai 1 catatan absen. Menghapusnya membuat riwayat itu kehilangan jam kerjanya — nonaktifkan saja.'
            );
    }

    public function test_shift_tanpa_referensi_bisa_dihapus(): void
    {
        $sore = Shift::create([
            'nama' => 'Sore',
            'masuk' => '13:00',
            'pulang' => '21:00',
            'toleransi_menit' => 10,
            'aktif' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->deleteJson("/api/admin/shift/{$sore->id}")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('shift', ['id' => $sore->id]);
        $this->assertDatabaseHas('audit', ['aksi' => 'hapus_shift']);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=AdminShiftTest
```
Expected: FAIL — `POST/PUT/DELETE /admin/shift` belum ada.

- [ ] **Step 3: Implementasikan CRUD shift**

Di `backend/app/Http/Controllers/AdminDataController.php`, tambahkan import:

```php
use App\Models\Absen;
use App\Models\Pengguna;
```

Ganti method `shift()` agar memakai serializer:

```php
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
```

Tambahkan helper berikut di dekat helper lokasi:

```php
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
```

- [ ] **Step 4: Daftarkan rute**

Di grup `admin`, setelah `Route::get('/shift', ...)`:

```php
    Route::post('/shift', [AdminDataController::class, 'storeShift']);
    Route::put('/shift/{id}', [AdminDataController::class, 'updateShift']);
    Route::delete('/shift/{id}', [AdminDataController::class, 'hapusShift']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=AdminShiftTest
```
Expected: PASS (7 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/AdminDataController.php backend/tests/Feature/AdminShiftTest.php backend/routes/api.php
git commit -m "feat: tambah crud shift"
```

---

### Task 11: CRUD hari libur

**Files:**
- Modify: `backend/app/Http/Controllers/AdminDataController.php`
- Create: `backend/tests/Feature/AdminHariLiburTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Produces:
  - `GET /api/admin/hari-libur` → `{data: [{id, tanggal, keterangan}]}` urut tanggal naik.
  - `POST /api/admin/hari-libur` → `201` objek; tanggal kembar `409`.
  - `PUT /api/admin/hari-libur/{id}` → `200` objek parsial.
  - `DELETE /api/admin/hari-libur/{id}` → `200 {ok:true}`.

- [ ] **Step 1: Tulis tes yang gagal**

Buat `backend/tests/Feature/AdminHariLiburTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\HariLibur;
use App\Models\Lokasi;
use App\Models\Pengguna;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminHariLiburTest extends TestCase
{
    use RefreshDatabase;

    private Lokasi $lokasi;

    private Shift $shift;

    private Pengguna $admin;

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

        $this->admin = Pengguna::create([
            'nama' => 'Administrator',
            'email' => 'adm001@kantor.id',
            'nip' => 'ADM001',
            'pin_hash' => Hash::make('2468'),
            'peran' => 'admin',
            'divisi' => 'Pendataan',
            'shift_id' => $this->shift->id,
            'lokasi_id' => $this->lokasi->id,
            'masuk_kerja' => '2026-01-05',
            'cuti_kuota' => 12,
            'aktif' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_daftar_urut_tanggal_naik(): void
    {
        HariLibur::create(['tanggal' => '2026-12-25', 'keterangan' => 'Natal']);
        HariLibur::create(['tanggal' => '2026-01-01', 'keterangan' => 'Tahun Baru']);

        $res = $this->withHeader('Authorization', 'Bearer '.$this->tokenAdmin())
            ->getJson('/api/admin/hari-libur')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.tanggal', '2026-01-01')
            ->assertJsonPath('data.1.tanggal', '2026-12-25');

        $this->assertSame('Tahun Baru', $res->json('data.0.keterangan'));
    }

    public function test_tambah_ubah_dan_hapus_hari_libur(): void
    {
        $token = $this->tokenAdmin();

        $id = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-10-19',
                'keterangan' => '  Cuti bersama  ',
            ])
            ->assertCreated()
            ->assertJsonPath('tanggal', '2026-10-19')
            ->assertJsonPath('keterangan', 'Cuti bersama')
            ->json('id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson("/api/admin/hari-libur/{$id}", [
                'keterangan' => 'Cuti bersama panjang',
            ])
            ->assertOk()
            ->assertJsonPath('tanggal', '2026-10-19')
            ->assertJsonPath('keterangan', 'Cuti bersama panjang');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/admin/hari-libur/{$id}")
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('hari_libur', ['id' => $id]);
        $this->assertDatabaseHas('audit', ['aksi' => 'tambah_hari_libur']);
        $this->assertDatabaseHas('audit', ['aksi' => 'ubah_hari_libur']);
        $this->assertDatabaseHas('audit', ['aksi' => 'hapus_hari_libur']);
    }

    public function test_tanggal_kembar_dan_tidak_sah_ditolak(): void
    {
        HariLibur::create(['tanggal' => '2026-10-19', 'keterangan' => 'Libur Uji']);
        $token = $this->tokenAdmin();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-10-19',
                'keterangan' => 'Libur Lain',
            ])
            ->assertStatus(409)
            ->assertJsonPath('kode', 'tanggal_dipakai');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-02-31',
                'keterangan' => 'Tanggal Salah',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('tanggal');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/admin/hari-libur/999999', [
                'keterangan' => 'Tidak Ada',
            ])
            ->assertStatus(404);
    }

    public function test_perubahan_langsung_terlihat_di_dashboard(): void
    {
        $token = $this->tokenAdmin();

        $id = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/admin/hari-libur', [
                'tanggal' => '2026-10-21',
                'keterangan' => 'Libur Uji',
            ])
            ->assertCreated()
            ->json('id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('hari_kerja', false)
            ->assertJsonPath('keterangan_libur', 'Libur Uji')
            ->assertJsonPath('ringkasan.belum_masuk', 0);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/admin/hari-libur/{$id}")
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/admin/dashboard?tanggal=2026-10-21')
            ->assertOk()
            ->assertJsonPath('hari_kerja', true);
    }

    private function tokenAdmin(): string
    {
        return $this->postJson('/api/masuk', [
            'nip' => 'ADM001',
            'pin' => '2468',
        ])->assertOk()->json('token');
    }
}
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run:
```bash
php artisan test --filter=AdminHariLiburTest
```
Expected: FAIL — route hari libur belum ada.

- [ ] **Step 3: Implementasikan CRUD hari libur**

Di `backend/app/Http/Controllers/AdminDataController.php`, tambahkan import:

```php
use App\Models\HariLibur;
```

Tambahkan method berikut setelah `hapusShift()`:

```php
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

        if (HariLibur::where('tanggal', $data['tanggal'])->exists()) {
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
            $dipakai = HariLibur::where('tanggal', $data['tanggal'])
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
```

Tambahkan helper:

```php
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
```

- [ ] **Step 4: Daftarkan rute**

Di grup `admin`:

```php
    Route::get('/hari-libur', [AdminDataController::class, 'hariLibur']);
    Route::post('/hari-libur', [AdminDataController::class, 'storeHariLibur']);
    Route::put('/hari-libur/{id}', [AdminDataController::class, 'updateHariLibur']);
    Route::delete('/hari-libur/{id}', [AdminDataController::class, 'hapusHariLibur']);
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run:
```bash
php artisan test --filter=AdminHariLiburTest
```
Expected: PASS (4 tes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/AdminDataController.php backend/tests/Feature/AdminHariLiburTest.php backend/routes/api.php
git commit -m "feat: tambah crud hari libur"
```

---

### Task 12: Dokumentasi endpoint dan regresi penuh

**Files:**
- Modify: `backend/README.md`
- Modify: `docs/milestones/M5-integrasi-backend.md`
- Modify: `docs/README.md`

**Interfaces:**
- Produces: dokumentasi yang cocok dengan rute nyata; status M5 diperbarui berdasarkan hasil tes, bukan klaim.

- [ ] **Step 1: Perbarui README backend**

Di `backend/README.md`, ganti paragraf pembuka menjadi:

```markdown
Backend Laravel untuk Aplikasi Absen. Seluruh endpoint yang dipakai frontend
sudah tersedia: sesi, kiosk, data master, izin/cuti, riwayat, dashboard, dan
laporan. Bentuk request/response mengikuti `../KONTRAK-API.md`.
```

Tambahkan baris berikut ke tabel endpoint:

```markdown
| GET | `/api/saya/absen` | Riwayat harian magang satu bulan |
| GET | `/api/saya/izin` | Riwayat izin + kuota cuti magang |
| POST | `/api/saya/izin` | Ajukan izin/cuti/sakit |
| GET | `/api/admin/izin` | Daftar izin + jumlah tiap status |
| POST | `/api/admin/izin/{id}/setujui` | Setujui pengajuan |
| POST | `/api/admin/izin/{id}/tolak` | Tolak pengajuan + catatan |
| POST | `/api/admin/shift` | Tambah shift |
| PUT | `/api/admin/shift/{id}` | Ubah shift (parsial) |
| DELETE | `/api/admin/shift/{id}` | Hapus shift bila tidak dipakai |
| GET | `/api/admin/hari-libur` | Daftar hari libur |
| POST | `/api/admin/hari-libur` | Tambah hari libur |
| PUT | `/api/admin/hari-libur/{id}` | Ubah hari libur |
| DELETE | `/api/admin/hari-libur/{id}` | Hapus hari libur |
```

Perbarui paragraf pengujian menjadi:

```markdown
Tes fitur mencakup login/profil/logout, rate limit, CRUD magang, lokasi, shift,
hari libur, laporan bulanan/harian, riwayat magang, pengajuan/izin admin,
kuota cuti, serta kiosk (masuk/pulang/ketiga, validasi foto, mode luar,
perangkat asing, signed URL foto).
```

- [ ] **Step 2: Jalankan seluruh tes backend**

Run:
```bash
php artisan test
```
Expected: seluruh tes PASS. Catat jumlah tes/assertion yang keluar; jangan memakai angka lama.

- [ ] **Step 3: Perbarui milestone M5**

Di `docs/milestones/M5-integrasi-backend.md`:

- Ubah `Diperbarui` ke tanggal aktual.
- Pindahkan semua baris tabel **Sisa pekerjaan** ke **Pekerjaan yang selesai** dengan tanda `[x]`.
- Ubah tabel sisa menjadi:

```markdown
| Bagian | Endpoint / pekerjaan | Status |
|---|---|---|
| Riwayat magang | `GET /saya/absen?bulan=YYYY-MM` | Selesai |
| Izin — magang | `GET /saya/izin`, `POST /saya/izin` | Selesai |
| Izin — admin | `GET /admin/izin`, `POST /admin/izin/{id}/setujui`, `.../tolak` | Selesai |
| Integrasi izin | `App\Support\Harian` + regresi laporan | Selesai |
| Tulis shift | `POST/PUT/DELETE /admin/shift` | Selesai |
| Hari libur | `GET/POST/PUT/DELETE /admin/hari-libur` | Selesai |
| Regression test | Seluruh Fase 1 + Fase 2 | Selesai |
| Uji staging | Frontend dengan `VITE_USE_MOCK=false` | Belum — lihat Task 13 |
```

- Centang seluruh kotak **Kriteria penerimaan** kecuali baris staging.
- Tambahkan catatan hasil `php artisan test` dengan jumlah tes/assertion aktual.

- [ ] **Step 4: Perbarui status di docs/README**

Di `docs/README.md`, ubah baris M3, M4, dan M5:

```markdown
| M3 — Dashboard & data master | **Selesai** | Backend shift dan hari libur sudah tersedia. |
| M4 — Izin, riwayat, rekap & laporan | **Selesai (frontend)** | Seluruh endpoint backend sudah tersedia; verifikasi staging ada di M5. |
| M5 — Integrasi backend | **Berjalan** | Seluruh endpoint dan tes backend selesai; uji staging belum. |
```

- [ ] **Step 5: Commit**

```bash
git add backend/README.md docs/milestones/M5-integrasi-backend.md docs/README.md
git commit -m "docs: perbarui status integrasi backend"
```

---

### Task 13: Uji staging dengan backend asli

**Files:**
- Modify: `docs/milestones/M5-integrasi-backend.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: seluruh endpoint dari Task 1–12, frontend `VITE_USE_MOCK=false`.
- Produces: bukti staging; status M5 menjadi **Selesai** hanya bila seluruh checklist lulus.

**Penting:** jangan memakai database pengembangan yang berisi data. Buat file SQLite khusus staging.

- [ ] **Step 1: Siapkan database staging terpisah**

Dari `Desktop/aplikasiabsen/backend`:

```bash
touch database/staging.sqlite
DB_DATABASE="$PWD/database/staging.sqlite" php artisan migrate:fresh --seed
```

Pastikan `.env` memiliki `ADMIN_NIP` dan `ADMIN_PIN` yang tidak ditulis di repo. Expected: migration dan seeder selesai tanpa error.

- [ ] **Step 2: Jalankan backend staging**

```bash
DB_DATABASE="$PWD/database/staging.sqlite" php artisan serve --host=127.0.0.1 --port=8000
```

Biarkan proses berjalan di terminal terpisah.

- [ ] **Step 3: Jalankan frontend tanpa mock**

Dari `Desktop/aplikasiabsen`:

```bash
VITE_USE_MOCK=false npm run dev
```

Buka `http://localhost:5173/#/masuk`.

- [ ] **Step 4: Verifikasi alur di browser**

Lakukan berurutan dan catat hasil setiap langkah:

1. Masuk dengan admin dari `.env`.
2. Buat satu akun magang di **Anak Magang** (NIP unik, PIN 4–6 angka, shift Reguler, lokasi Kantor Pusat).
3. Buka **Kiosk Absen** di jendela lain. Set perangkat kiosk hasil seeder:
   ```js
   localStorage.setItem('absen-kiosk-perangkat', 'kiosk-kantor-pusat');
   location.reload();
   ```
   Lakukan absen masuk magang tadi; pastikan foto, lokasi, dan respons berhasil.
4. Masuk sebagai magang di jendela baru; buka **Riwayat Absen** dan pastikan hari ini berstatus `tepat`/`telat`, bukan `belum`.
5. Ajukan cuti dua hari kerja ke depan di **Izin & Cuti**; pastikan kuota `menunggu` bertambah dan `sisa` berkurang.
6. Masuk kembali sebagai admin; buka **Persetujuan Izin**, setujui pengajuan; pastikan hilang dari tab Menunggu dan muncul di Disetujui.
7. Buka **Rekap & Laporan**; pilih bulan berjalan dan pastikan kolom cuti bertambah, `hadir` tetap, dan tombol CSV mengunduh berkas.
8. Buka **Beranda**; pastikan orang yang cuti hari ini muncul di kartu Izin, bukan Belum Absen, dan `total = sudah_masuk + belum_masuk + izin`.
9. Buka **Shift Kerja**; tambah shift `Sore` 13:00–21:00, ubah namanya, lalu hapus. Pastikan shift `Reguler` tidak bisa dihapus karena dipakai.
10. Buka **Hari Libur**; tambah tanggal hari ini, lihat Beranda berubah menjadi libur, lalu hapus dan lihat kembali menjadi hari kerja.
11. Buka DevTools → Network; pastikan tidak ada request ke mock dan tidak ada response `500`/HTML.

Kalau browser tidak tersedia di lingkungan eksekusi, **hentikan** di sini dan laporkan bahwa staging belum diuji. Jangan menandai M5 selesai.

- [ ] **Step 5: Hentikan server dan bersihkan file staging**

Hentikan dua proses server. Hapus file `backend/database/staging.sqlite` yang dibuat pada langkah ini (hanya file itu; jangan menyentuh database lain).

- [ ] **Step 6: Perbarui status M5**

Setelah seluruh checklist lulus, di `docs/milestones/M5-integrasi-backend.md`:

- Ubah `Status` menjadi **Selesai**.
- Centang baris staging pada kriteria penerimaan.
- Catat tanggal uji, rute yang dibuka, dan hasil `php artisan test`.

Di `docs/README.md`, ubah baris M5 menjadi:

```markdown
| M5 — Integrasi backend | **Selesai** | Seluruh endpoint, tes backend, dan uji staging dengan `VITE_USE_MOCK=false` lulus. |
```

- [ ] **Step 7: Commit**

```bash
git add docs/milestones/M5-integrasi-backend.md docs/README.md
git commit -m "docs: tandai integrasi backend selesai"
```

---

## Self-Review

- **Cakupan kontrak:** `/saya/absen`, `/saya/izin` GET/POST, `/admin/izin` GET/setujui/tolak, shift GET/POST/PUT/DELETE, hari libur GET/POST/PUT/DELETE semuanya punya task. Dashboard, laporan, dan riwayat memakai `Harian` yang sama.
- **Aturan bisnis:** hanya cuti memotong kuota; pengajuan menunggu ikut dihitung; absen menang atas izin; libur menang atas semuanya; cuti yang sudah ada absennya tidak memotong kuota; rentang tanpa hari kerja dan tanggal lewat ditolak; tumpang tindih termasuk pending ditolak; setujui memeriksa ulang kuota dan bentrok; tolak wajib catatan; audit dicatat.
- **Konsistensi tipe:** `Harian::susun()` tetap mengembalikan `{bulan, hari_kerja, ringkasan, data}`; `Izin::apiArray()` dipakai tiga endpoint; `KuotaCuti::rekap()` mengembalikan empat kunci yang sama di semua pemakaian.
- **Tanpa placeholder:** setiap langkah berisi kode/command yang bisa dijalankan. Satu-satunya langkah manual adalah checklist browser di Task 13, yang memang membutuhkan mata manusia.
- **Gerbang rilis:** M5 tidak ditandai selesai sebelum staging benar-benar dijalankan. M6 tetap milestone terpisah.
