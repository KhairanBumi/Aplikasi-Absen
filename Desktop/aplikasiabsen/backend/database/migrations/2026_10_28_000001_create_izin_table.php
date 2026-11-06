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
