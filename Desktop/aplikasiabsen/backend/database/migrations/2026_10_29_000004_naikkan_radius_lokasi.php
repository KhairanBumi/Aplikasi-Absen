<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 50 m adalah bawaan lama. Naikkan hanya baris yang masih memakai
        // bawaan itu; radius yang sudah disesuaikan admin tidak disentuh.
        DB::table('lokasi')->where('radius_m', 50)->update(['radius_m' => 250]);
    }

    public function down(): void
    {
        // Sengaja tidak membalik angka. Setelah migrasi berjalan, admin boleh
        // memilih 250 m sendiri; mengubah semua 250 kembali ke 50 akan
        // menimpa pilihan itu tanpa bisa dibedakan.
    }
};
