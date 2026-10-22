-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.3 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for absen
CREATE DATABASE IF NOT EXISTS `absen` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `absen`;

-- Dumping structure for table absen.absen
CREATE TABLE IF NOT EXISTS `absen` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pengguna_id` bigint unsigned NOT NULL,
  `tanggal` date NOT NULL,
  `tipe` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `waktu` timestamp NOT NULL,
  `lokasi_id` bigint unsigned NOT NULL,
  `mode` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'kantor',
  `lintang` decimal(10,7) DEFAULT NULL,
  `bujur` decimal(10,7) DEFAULT NULL,
  `akurasi` int unsigned DEFAULT NULL,
  `jarak_m` int unsigned DEFAULT NULL,
  `lokasi_teks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lokasi_meragukan` tinyint(1) NOT NULL DEFAULT '0',
  `shift_id` bigint unsigned NOT NULL,
  `telat_menit` int unsigned NOT NULL DEFAULT '0',
  `nama_salinan` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nip_salinan` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `foto_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kiosk_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `absen_pengguna_id_tanggal_tipe_unique` (`pengguna_id`,`tanggal`,`tipe`),
  KEY `absen_lokasi_id_foreign` (`lokasi_id`),
  KEY `absen_shift_id_foreign` (`shift_id`),
  KEY `absen_tanggal_index` (`tanggal`),
  KEY `absen_pengguna_id_tanggal_index` (`pengguna_id`,`tanggal`),
  CONSTRAINT `absen_lokasi_id_foreign` FOREIGN KEY (`lokasi_id`) REFERENCES `lokasi` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `absen_pengguna_id_foreign` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `absen_shift_id_foreign` FOREIGN KEY (`shift_id`) REFERENCES `shift` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.absen: ~0 rows (approximately)
INSERT INTO `absen` (`id`, `pengguna_id`, `tanggal`, `tipe`, `waktu`, `lokasi_id`, `mode`, `lintang`, `bujur`, `akurasi`, `jarak_m`, `lokasi_teks`, `lokasi_meragukan`, `shift_id`, `telat_menit`, `nama_salinan`, `nip_salinan`, `foto_path`, `kiosk_id`, `ip`, `user_agent`, `created_at`) VALUES
	(1, 2, '2026-10-21', 'masuk', '2026-10-21 08:36:50', 1, 'kantor', -7.2736610, 112.7459060, 114, 414, 'Jalan Sumatera, Gubeng, Surabaya', 1, 1, 441, 'Ilmaan Zuhriy', 'PHP0123', 'absen/2026/10/21/1ad0fa5b-a7aa-4160-8d8b-aebdc85667d3.jpg', 'kiosk-kantor-pusat', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:36:50'),
	(2, 2, '2026-10-21', 'pulang', '2026-10-21 08:49:25', 1, 'kantor', -7.2736580, 112.7459000, 141, 414, 'Jalan Sumatera, Gubeng, Surabaya', 1, 1, 0, 'Ilmaan Zuhriy', 'PHP0123', 'absen/2026/10/21/ca221519-b921-4d60-b289-94385bc1e833.jpg', 'kiosk-kantor-pusat', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:49:25'),
	(3, 3, '2026-10-21', 'masuk', '2026-10-21 09:10:35', 1, 'luar', -7.2736860, 112.7460230, 105, 5890, 'Jalan Sumatera, Gubeng, Surabaya', 1, 1, 475, 'Rafa Aulia', 'RAP123', 'absen/2026/10/21/cdb7c7e8-68e1-48ab-86e3-d8f1d8c8875a.jpg', 'kiosk-kantor-pusat', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:10:35'),
	(4, 3, '2026-10-21', 'pulang', '2026-10-21 09:12:51', 1, 'luar', -7.2736250, 112.7459050, 124, 5902, 'Jalan Sumatera, Gubeng, Surabaya', 1, 1, 0, 'Rafa Aulia', 'RAP123', 'absen/2026/10/21/44363298-94bc-46a6-9ada-b56065d785a1.jpg', 'kiosk-kantor-pusat', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:12:51'),
	(5, 4, '2026-10-21', 'masuk', '2026-10-21 09:52:19', 1, 'luar', -7.2737090, 112.7459010, 129, 5894, 'Jalan Sumatera, Gubeng, Surabaya', 1, 1, 517, 'Bumi', 'YSS123', 'absen/2026/10/21/4749bd93-769d-4301-bd17-fcdc0a036576.jpg', 'kiosk-kantor-pusat', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:52:19');

-- Dumping structure for table absen.audit
CREATE TABLE IF NOT EXISTS `audit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pengguna_id` bigint unsigned DEFAULT NULL,
  `aksi` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rincian` json DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_pengguna_id_foreign` (`pengguna_id`),
  CONSTRAINT `audit_pengguna_id_foreign` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.audit: ~0 rows (approximately)
INSERT INTO `audit` (`id`, `pengguna_id`, `aksi`, `rincian`, `ip`, `user_agent`, `created_at`) VALUES
	(1, 1, 'tambah_magang', '{"nip": "PHP0123", "pengguna_id": 2}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 07:55:08'),
	(2, 1, 'ubah_lokasi', '{"nama": "Kantor Cabang Karimunjawa", "lokasi_id": 1}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:30:11'),
	(3, 2, 'absen_masuk', '{"mode": "kantor", "tipe": "masuk", "akurasi": 114, "jarak_m": 414, "absen_id": 1, "kiosk_id": "kiosk-kantor-pusat", "lokasi_meragukan": true}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:36:50'),
	(4, 2, 'absen_pulang', '{"mode": "kantor", "tipe": "pulang", "akurasi": 141, "jarak_m": 414, "absen_id": 2, "kiosk_id": "kiosk-kantor-pusat", "lokasi_meragukan": true}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:49:25'),
	(5, 1, 'ubah_lokasi', '{"nama": "Kantor Cabang Karimunjawa", "lokasi_id": 1}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:51:05'),
	(6, 1, 'ubah_lokasi', '{"nama": "Kantor Cabang Karimunjawa", "lokasi_id": 1}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 08:52:02'),
	(7, 1, 'tambah_magang', '{"nip": "RAP123", "pengguna_id": 3}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:10:12'),
	(8, 3, 'absen_masuk', '{"mode": "luar", "tipe": "masuk", "akurasi": 105, "jarak_m": 5890, "absen_id": 3, "kiosk_id": "kiosk-kantor-pusat", "lokasi_meragukan": true}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:10:35'),
	(9, 3, 'absen_pulang', '{"mode": "luar", "tipe": "pulang", "akurasi": 124, "jarak_m": 5902, "absen_id": 4, "kiosk_id": "kiosk-kantor-pusat", "lokasi_meragukan": true}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:12:51'),
	(10, 1, 'tambah_magang', '{"nip": "YSS123", "pengguna_id": 4}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:51:42'),
	(11, 4, 'absen_masuk', '{"mode": "luar", "tipe": "masuk", "akurasi": 129, "jarak_m": 5894, "absen_id": 5, "kiosk_id": "kiosk-kantor-pusat", "lokasi_meragukan": true}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-21 09:52:19');

-- Dumping structure for table absen.cache
CREATE TABLE IF NOT EXISTS `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.cache: ~0 rows (approximately)

-- Dumping structure for table absen.cache_locks
CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.cache_locks: ~0 rows (approximately)

-- Dumping structure for table absen.failed_jobs
CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.failed_jobs: ~0 rows (approximately)

-- Dumping structure for table absen.hari_libur
CREATE TABLE IF NOT EXISTS `hari_libur` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tanggal` date NOT NULL,
  `keterangan` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hari_libur_tanggal_unique` (`tanggal`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.hari_libur: ~5 rows (approximately)
INSERT INTO `hari_libur` (`id`, `tanggal`, `keterangan`) VALUES
	(1, '2026-01-01', 'Tahun Baru Masehi'),
	(2, '2026-05-01', 'Hari Buruh Internasional'),
	(3, '2026-06-01', 'Hari Lahir Pancasila'),
	(4, '2026-08-17', 'Hari Kemerdekaan Republik Indonesia'),
	(5, '2026-12-25', 'Hari Raya Natal');

-- Dumping structure for table absen.jobs
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.jobs: ~0 rows (approximately)

-- Dumping structure for table absen.job_batches
CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.job_batches: ~0 rows (approximately)

-- Dumping structure for table absen.lokasi
CREATE TABLE IF NOT EXISTS `lokasi` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alamat` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lintang` decimal(10,7) NOT NULL,
  `bujur` decimal(10,7) NOT NULL,
  `radius_m` int unsigned NOT NULL DEFAULT '50',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lokasi_nama_unique` (`nama`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.lokasi: ~0 rows (approximately)
INSERT INTO `lokasi` (`id`, `nama`, `alamat`, `lintang`, `bujur`, `radius_m`, `aktif`, `created_at`, `updated_at`) VALUES
	(1, 'Kantor Cabang Karimunjawa', 'Jl. Raya Kalirungkut No.25, Kali Rungkut, Kec. Rungkut, Surabaya, Jawa Timur', -7.3207800, 112.7704700, 50, 1, '2026-10-21 07:39:12', '2026-10-21 08:52:02');

-- Dumping structure for table absen.migrations
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.migrations: ~0 rows (approximately)
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
	(1, '0001_01_01_000000_create_users_table', 1),
	(2, '0001_01_01_000001_create_cache_table', 1),
	(3, '0001_01_01_000002_create_jobs_table', 1),
	(4, '2026_10_21_000001_create_lokasi_table', 1),
	(5, '2026_10_21_000002_create_shift_table', 1),
	(6, '2026_10_21_000003_create_pengguna_table', 1),
	(7, '2026_10_21_000004_create_sesi_table', 1),
	(8, '2026_10_21_000005_create_perangkat_kiosk_table', 1),
	(9, '2026_10_21_000006_create_absen_table', 1),
	(10, '2026_10_21_000007_create_hari_libur_table', 1),
	(11, '2026_10_21_000008_create_audit_table', 1);

-- Dumping structure for table absen.password_reset_tokens
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.password_reset_tokens: ~0 rows (approximately)

-- Dumping structure for table absen.pengguna
CREATE TABLE IF NOT EXISTS `pengguna` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nip` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nik` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pin_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `peran` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'magang',
  `divisi` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shift_id` bigint unsigned NOT NULL,
  `lokasi_id` bigint unsigned NOT NULL,
  `masuk_kerja` date NOT NULL,
  `cuti_kuota` smallint unsigned NOT NULL DEFAULT '12',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `foto_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pengguna_nip_unique` (`nip`),
  UNIQUE KEY `pengguna_email_unique` (`email`),
  KEY `pengguna_shift_id_foreign` (`shift_id`),
  KEY `pengguna_lokasi_id_foreign` (`lokasi_id`),
  KEY `pengguna_peran_aktif_index` (`peran`,`aktif`),
  CONSTRAINT `pengguna_lokasi_id_foreign` FOREIGN KEY (`lokasi_id`) REFERENCES `lokasi` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `pengguna_shift_id_foreign` FOREIGN KEY (`shift_id`) REFERENCES `shift` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.pengguna: ~1 rows (approximately)
INSERT INTO `pengguna` (`id`, `nama`, `email`, `nip`, `nik`, `pin_hash`, `peran`, `divisi`, `shift_id`, `lokasi_id`, `masuk_kerja`, `cuti_kuota`, `aktif`, `foto_path`, `created_at`, `updated_at`) VALUES
	(1, 'Administrator', 'admin@kantor.id', 'ADM001', NULL, '$argon2id$v=19$m=65536,t=4,p=1$QTFmVGF5a1g5Wkw0eml3VA$ZVsR0IIXmVMYiX4cw8FzsbJPvwQXzQQpZtGoPjk67oE', 'admin', 'Management Data', 1, 1, '2026-10-21', 12, 1, NULL, '2026-10-21 07:39:13', '2026-10-21 07:39:13'),
	(2, 'Ilmaan Zuhriy', 'ilmaan@gmail.com', 'PHP0123', '1019181716151413', '$argon2id$v=19$m=65536,t=4,p=1$cWRCWC9FdTV3V2gvRkxrLw$YyriMXZv6MrHq41zpqIcIXX+f8eCb0U+IPbYORWZChk', 'magang', 'Pendataan', 1, 1, '2026-10-21', 12, 1, NULL, '2026-10-21 07:55:08', '2026-10-21 07:55:08'),
	(3, 'Rafa Aulia', 'rap@gmail.com', 'RAP123', '2029282726252423', '$argon2id$v=19$m=65536,t=4,p=1$anBFVTdKa29BTTNGWldnNg$9zkvdobU+Rl6/drBwrJ4bExKPBexO3dfBZfvAcYi1U4', 'magang', 'Pendataan', 1, 1, '2026-10-21', 12, 1, NULL, '2026-10-21 09:10:12', '2026-10-21 09:10:12'),
	(4, 'Bumi', 'bumi@gmail', 'YSS123', '1213151416151415', '$argon2id$v=19$m=65536,t=4,p=1$OThnamR1MmZoajJucTVVWQ$hwsZsTxyu0nrkvx/NPhLYS2OtHTMtaKEZmGT89zIt6I', 'magang', 'Pendataan', 1, 1, '2026-10-21', 12, 1, NULL, '2026-10-21 09:51:42', '2026-10-21 09:51:42');

-- Dumping structure for table absen.perangkat_kiosk
CREATE TABLE IF NOT EXISTS `perangkat_kiosk` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lokasi_id` bigint unsigned NOT NULL,
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `terakhir_dilihat_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `perangkat_kiosk_lokasi_id_foreign` (`lokasi_id`),
  CONSTRAINT `perangkat_kiosk_lokasi_id_foreign` FOREIGN KEY (`lokasi_id`) REFERENCES `lokasi` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.perangkat_kiosk: ~1 rows (approximately)
INSERT INTO `perangkat_kiosk` (`id`, `nama`, `lokasi_id`, `aktif`, `terakhir_dilihat_at`, `created_at`) VALUES
	('kiosk-kantor-pusat', 'Kiosk Kantor Pusat', 1, 1, '2026-10-21 09:52:19', '2026-10-21 07:39:13');

-- Dumping structure for table absen.sesi
CREATE TABLE IF NOT EXISTS `sesi` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pengguna_id` bigint unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sesi_token_hash_unique` (`token_hash`),
  KEY `sesi_pengguna_id_foreign` (`pengguna_id`),
  KEY `sesi_expires_at_index` (`expires_at`),
  CONSTRAINT `sesi_pengguna_id_foreign` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.sesi: ~0 rows (approximately)
INSERT INTO `sesi` (`id`, `pengguna_id`, `token_hash`, `expires_at`, `created_at`, `last_used_at`, `ip`, `user_agent`) VALUES
	(1, 1, '74513ba199995d0a128ca1e4087f2dfe64e28fc2d35a6522373d10864637ee4c', '2026-10-21 19:44:31', '2026-10-21 07:44:31', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9711'),
	(2, 1, '5d6d581fea53a15179644b4d86c37870d1c57bc607c4ad74f283e1887b6ad173', '2026-10-21 19:51:25', '2026-10-21 07:51:25', '2026-10-21 09:59:00', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'),
	(3, 1, 'bf75f6e25a00be1f820614f8c98bc81669ffefc3be647a2eca79601c165a62c6', '2026-10-21 20:19:52', '2026-10-21 08:19:52', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9711');

-- Dumping structure for table absen.sessions
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.sessions: ~0 rows (approximately)

-- Dumping structure for table absen.shift
CREATE TABLE IF NOT EXISTS `shift` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `masuk` time NOT NULL,
  `pulang` time NOT NULL,
  `toleransi_menit` smallint unsigned NOT NULL DEFAULT '0',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shift_nama_unique` (`nama`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.shift: ~0 rows (approximately)
INSERT INTO `shift` (`id`, `nama`, `masuk`, `pulang`, `toleransi_menit`, `aktif`, `created_at`, `updated_at`) VALUES
	(1, 'Reguler', '08:00:00', '17:00:00', 15, 1, '2026-10-21 07:39:12', '2026-10-21 07:39:12');

-- Dumping structure for table absen.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table absen.users: ~0 rows (approximately)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
