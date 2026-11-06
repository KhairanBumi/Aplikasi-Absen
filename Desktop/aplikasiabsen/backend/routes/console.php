<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('absen:periksa')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('absen:bersihkan --force')->monthlyOn(1, '02:00')->withoutOverlapping();
