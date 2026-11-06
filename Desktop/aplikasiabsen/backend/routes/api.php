<?php

use App\Http\Controllers\AdminAnomaliController;
use App\Http\Controllers\AdminAuditController;
use App\Http\Controllers\AdminDataController;
use App\Http\Controllers\AdminIzinController;
use App\Http\Controllers\AdminLaporanController;
use App\Http\Controllers\AdminMagangController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FotoController;
use App\Http\Controllers\KioskController;
use App\Http\Controllers\SayaAbsenController;
use App\Http\Controllers\SayaIzinController;
use Illuminate\Routing\Middleware\ValidateSignature;
use Illuminate\Support\Facades\Route;

Route::post('/masuk', [AuthController::class, 'masuk']);

Route::middleware('auth.token')->group(function () {
    Route::post('/keluar', [AuthController::class, 'keluar']);
    Route::get('/saya/profil', [AuthController::class, 'profil']);
    Route::get('/saya/absen', [SayaAbsenController::class, 'index']);
    Route::get('/saya/izin', [SayaIzinController::class, 'index']);
    Route::post('/saya/izin', [SayaIzinController::class, 'store']);
});

Route::get('/kiosk/lokasi', [KioskController::class, 'lokasi']);
Route::post('/kiosk/absen', [KioskController::class, 'absen']);

Route::get('/foto/{kode}', [FotoController::class, 'show'])
    ->name('foto')
    ->middleware(ValidateSignature::class);

Route::middleware(['auth.token', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/audit', [AdminAuditController::class, 'index']);
    Route::get('/anomali', [AdminAnomaliController::class, 'index']);
    Route::get('/izin', [AdminIzinController::class, 'index']);
    Route::post('/izin/{id}/setujui', [AdminIzinController::class, 'setujui'])->whereNumber('id');
    Route::post('/izin/{id}/tolak', [AdminIzinController::class, 'tolak'])->whereNumber('id');

    Route::get('/magang', [AdminMagangController::class, 'index']);
    Route::post('/magang', [AdminMagangController::class, 'store']);
    Route::put('/magang/{id}', [AdminMagangController::class, 'update']);
    Route::delete('/magang/{id}', [AdminMagangController::class, 'destroy'])->whereNumber('id');

    Route::get('/lokasi', [AdminDataController::class, 'lokasi']);
    Route::post('/lokasi', [AdminDataController::class, 'storeLokasi']);
    Route::put('/lokasi/{id}', [AdminDataController::class, 'updateLokasi']);
    Route::get('/shift', [AdminDataController::class, 'shift']);
    Route::post('/shift', [AdminDataController::class, 'storeShift']);
    Route::put('/shift/{id}', [AdminDataController::class, 'updateShift'])->whereNumber('id');
    Route::delete('/shift/{id}', [AdminDataController::class, 'hapusShift'])->whereNumber('id');

    Route::get('/hari-libur', [AdminDataController::class, 'hariLibur']);
    Route::post('/hari-libur', [AdminDataController::class, 'storeHariLibur']);
    Route::put('/hari-libur/{id}', [AdminDataController::class, 'updateHariLibur'])->whereNumber('id');
    Route::delete('/hari-libur/{id}', [AdminDataController::class, 'hapusHariLibur'])->whereNumber('id');

    Route::get('/laporan', [AdminLaporanController::class, 'index']);
    Route::get('/laporan/harian', [AdminLaporanController::class, 'harian']);
});
