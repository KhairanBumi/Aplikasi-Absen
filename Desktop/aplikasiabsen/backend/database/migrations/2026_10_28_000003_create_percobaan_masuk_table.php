<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('percobaan_masuk', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengguna_id')->nullable()->constrained('pengguna')->nullOnDelete();
            $table->string('nip', 30);
            $table->string('kiosk_id', 64);
            $table->string('ip', 45)->nullable();
            $table->boolean('berhasil')->default(false);
            $table->string('alasan', 40)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['nip', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('percobaan_masuk');
    }
};
