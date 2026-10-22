<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lokasi', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 100)->unique();
            $table->string('alamat', 255)->nullable();
            $table->decimal('lintang', 10, 7);
            $table->decimal('bujur', 10, 7);
            $table->unsignedInteger('radius_m')->default(50);
            $table->boolean('aktif')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lokasi');
    }
};
