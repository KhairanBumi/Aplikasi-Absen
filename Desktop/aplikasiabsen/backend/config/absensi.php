<?php

return [
    'divisi' => ['Pendataan', 'Perhitungan', 'Management Data'],

    'token_ttl_hours' => (int) env('ABSEN_TOKEN_TTL_HOURS', 12),

    'foto_max_bytes' => 200 * 1024,

    'nominatim_user_agent' => env(
        'NOMINATIM_USER_AGENT',
        'aplikasi-absen/1.0 (admin@kantor.id)'
    ),

    'ip_kantor' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('ABSEN_IP_KANTOR', ''))
    ))),

    'anomali_jarak_m' => (int) env('ABSEN_ANOMALI_JARAK_M', 100000),

    'foto_simpan_hari' => (int) env('ABSEN_FOTO_SIMPAN_HARI', 180),
    'audit_simpan_hari' => (int) env('ABSEN_AUDIT_SIMPAN_HARI', 730),

    'uji_beban_pin' => env('ABSEN_UJI_BEBAN_PIN'),

    'seed' => [
        'admin_nip' => env('ADMIN_NIP'),
        'admin_pin' => env('ADMIN_PIN'),
        'admin_nama' => env('ADMIN_NAMA', 'Administrator'),
        'admin_email' => env('ADMIN_EMAIL'),
        'admin_divisi' => env('ADMIN_DIVISI', 'Management Data'),

        'lokasi_nama' => env('SEED_LOKASI_NAMA', 'Kantor Pusat'),
        'lokasi_alamat' => env('SEED_LOKASI_ALAMAT', 'Jl. Jenderal Sudirman No. 1, Jakarta'),
        'lokasi_lintang' => (float) env('SEED_LOKASI_LINTANG', -6.2246),
        'lokasi_bujur' => (float) env('SEED_LOKASI_BUJUR', 106.8094),
        'lokasi_radius_m' => (int) env('SEED_LOKASI_RADIUS_M', 250),

        'shift_nama' => env('SEED_SHIFT_NAMA', 'Reguler'),
        'shift_masuk' => env('SEED_SHIFT_MASUK', '08:00'),
        'shift_pulang' => env('SEED_SHIFT_PULANG', '17:00'),
        'shift_toleransi' => (int) env('SEED_SHIFT_TOLERANSI', 15),

        'kiosk_id' => env('SEED_KIOSK_ID', 'kiosk-kantor-pusat'),
        'kiosk_nama' => env('SEED_KIOSK_NAMA', 'Kiosk Kantor Pusat'),
    ],
];
