<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absen', function (Blueprint $table) {
            $table->string('kunci_idempoten', 80)->nullable()->after('user_agent');
            $table->unique(['kiosk_id', 'kunci_idempoten'], 'absen_kiosk_kunci_unique');
        });
    }

    public function down(): void
    {
        Schema::table('absen', function (Blueprint $table) {
            $table->dropUnique('absen_kiosk_kunci_unique');
            $table->dropColumn('kunci_idempoten');
        });
    }
};
