<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('perangkat_kiosk', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('nama', 100);
            $table->foreignId('lokasi_id')->constrained('lokasi')->restrictOnDelete();
            $table->boolean('aktif')->default(true);
            $table->timestamp('terakhir_dilihat_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('perangkat_kiosk');
    }
};
