<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengguna', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 120);
            $table->string('email', 160)->nullable()->unique();
            $table->string('nip', 30)->unique();
            $table->string('nik', 16)->nullable();
            $table->string('pin_hash', 255);
            $table->string('peran', 20)->default('magang');
            $table->string('divisi', 40);
            $table->foreignId('shift_id')->constrained('shift')->restrictOnDelete();
            $table->foreignId('lokasi_id')->constrained('lokasi')->restrictOnDelete();
            $table->date('masuk_kerja');
            $table->unsignedSmallInteger('cuti_kuota')->default(12);
            $table->boolean('aktif')->default(true);
            $table->string('foto_path', 255)->nullable();
            $table->timestamps();

            $table->index(['peran', 'aktif']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengguna');
    }
};
