<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('absen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengguna_id')->constrained('pengguna')->restrictOnDelete();
            $table->date('tanggal');
            $table->string('tipe', 10);
            $table->timestamp('waktu');
            $table->foreignId('lokasi_id')->constrained('lokasi')->restrictOnDelete();
            $table->string('mode', 10)->default('kantor');
            $table->decimal('lintang', 10, 7)->nullable();
            $table->decimal('bujur', 10, 7)->nullable();
            $table->unsignedInteger('akurasi')->nullable();
            $table->unsignedInteger('jarak_m')->nullable();
            $table->string('lokasi_teks', 255)->nullable();
            $table->boolean('lokasi_meragukan')->default(false);
            $table->foreignId('shift_id')->constrained('shift')->restrictOnDelete();
            $table->unsignedInteger('telat_menit')->default(0);
            $table->string('nama_salinan', 120);
            $table->string('nip_salinan', 30);
            $table->string('foto_path', 255)->nullable();
            $table->string('kiosk_id', 64);
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['pengguna_id', 'tanggal', 'tipe']);
            $table->index('tanggal');
            $table->index(['pengguna_id', 'tanggal']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('absen');
    }
};
