<?php

return [
    'required' => ':attribute wajib diisi.',
    'string' => ':attribute harus berupa teks.',
    'integer' => ':attribute harus berupa angka bulat.',
    'numeric' => ':attribute harus berupa angka.',
    'boolean' => ':attribute harus bernilai ya atau tidak.',
    'email' => ':attribute harus berupa alamat email yang sah.',
    'unique' => ':attribute sudah dipakai.',
    'exists' => ':attribute tidak ditemukan.',
    'in' => ':attribute tidak sah.',
    'regex' => ':attribute tidak sah.',
    'date_format' => ':attribute harus berbentuk :format.',
    'max' => [
        'string' => ':attribute maksimal :max karakter.',
        'numeric' => ':attribute maksimal :max.',
    ],
    'min' => [
        'string' => ':attribute minimal :min karakter.',
        'numeric' => ':attribute minimal :min.',
    ],
    'between' => [
        'numeric' => ':attribute harus antara :min dan :max.',
    ],

    'attributes' => [
        'nama' => 'Nama',
        'nip' => 'NIP',
        'nik' => 'NIK',
        'email' => 'Email',
        'pin' => 'PIN',
        'divisi' => 'Divisi',
        'peran' => 'Peran',
        'shift_id' => 'Shift',
        'lokasi_id' => 'Lokasi',
        'masuk_kerja' => 'Tanggal masuk kerja',
        'cuti_kuota' => 'Jatah cuti',
        'aktif' => 'Status aktif',
        'kiosk_id' => 'Identitas perangkat',
        'mode' => 'Mode absen',
        'lintang' => 'Lintang',
        'bujur' => 'Bujur',
        'akurasi' => 'Akurasi GPS',
        'foto' => 'Foto',
        'tanggal' => 'Tanggal',
    ],
];
