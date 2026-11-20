<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absen', function (Blueprint $table) {
            $table->string('status_persetujuan', 20)->default('disetujui')->after('tipe');
            $table->text('keterangan_dinas')->nullable()->after('status_persetujuan');
            $table->string('catatan_admin', 500)->nullable()->after('keterangan_dinas');
            $table->foreignId('diputuskan_oleh')->nullable()->after('catatan_admin')
                ->constrained('pengguna')->nullOnDelete();
            $table->timestamp('diputuskan_at')->nullable()->after('diputuskan_oleh');

            // Baris absen mandiri tidak berasal dari perangkat kiosk.
            $table->string('kiosk_id', 64)->nullable()->change();
            $table->unique(['pengguna_id', 'kunci_idempoten'], 'absen_pengguna_kunci_unique');
        });
    }

    public function down(): void
    {
        Schema::table('absen', function (Blueprint $table) {
            $table->dropUnique('absen_pengguna_kunci_unique');
            $table->dropConstrainedForeignId('diputuskan_oleh');
            $table->dropColumn([
                'status_persetujuan',
                'keterangan_dinas',
                'catatan_admin',
                'diputuskan_at',
            ]);
            $table->string('kiosk_id', 64)->nullable(false)->change();
        });
    }
};
