<?php

use App\Http\Controllers\AdminDataController;
use App\Http\Controllers\AdminLaporanController;
use App\Http\Controllers\AdminMagangController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FotoController;
use App\Http\Controllers\KioskController;
use Illuminate\Routing\Middleware\ValidateSignature;
use Illuminate\Support\Facades\Route;

Route::post('/masuk', [AuthController::class, 'masuk']);

Route::middleware('auth.token')->group(function () {
    Route::post('/keluar', [AuthController::class, 'keluar']);
    Route::get('/saya/profil', [AuthController::class, 'profil']);
});

Route::get('/kiosk/lokasi', [KioskController::class, 'lokasi']);
Route::post('/kiosk/absen', [KioskController::class, 'absen']);

Route::get('/foto/{kode}', [FotoController::class, 'show'])
    ->name('foto')
    ->middleware(ValidateSignature::class);

Route::middleware(['auth.token', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/magang', [AdminMagangController::class, 'index']);
    Route::post('/magang', [AdminMagangController::class, 'store']);
    Route::put('/magang/{id}', [AdminMagangController::class, 'update']);

    Route::get('/lokasi', [AdminDataController::class, 'lokasi']);
    Route::post('/lokasi', [AdminDataController::class, 'storeLokasi']);
    Route::put('/lokasi/{id}', [AdminDataController::class, 'updateLokasi']);
    Route::get('/shift', [AdminDataController::class, 'shift']);

    Route::get('/laporan', [AdminLaporanController::class, 'index']);
    Route::get('/laporan/harian', [AdminLaporanController::class, 'harian']);
});
