#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Pemakaian: $0 <db.sql.gz> <foto.tar.gz> [--yes]" >&2
  exit 1
fi

DB_FILE="$1"
FOTO_FILE="$2"
shift 2

APP_DIR="${APP_DIR:-/var/www/aplikasiabsen/backend}"
DB_NAME="${DB_NAME:-absen}"
DB_DEFAULTS_FILE="${DB_DEFAULTS_FILE:-/etc/absen-backup.cnf}"
FOTO_DIR="$APP_DIR/storage/app/private"

if [ ! -r "$DB_FILE" ] || [ ! -r "$FOTO_FILE" ]; then
  echo "Berkas backup tidak bisa dibaca." >&2
  exit 1
fi

if [ ! -r "$DB_DEFAULTS_FILE" ]; then
  echo "Berkas kredensial MySQL tidak bisa dibaca: $DB_DEFAULTS_FILE" >&2
  exit 1
fi

if [ "${1:-}" != "--yes" ]; then
  echo "Tindakan ini menimpa database '$DB_NAME' dan folder foto."
  echo "Ketik PULIHKAN untuk melanjutkan:"
  read -r jawab
  if [ "$jawab" != "PULIHKAN" ]; then
    echo "Dibatalkan."
    exit 1
  fi
fi

gunzip -c "$DB_FILE" | mysql --defaults-extra-file="$DB_DEFAULTS_FILE" "$DB_NAME"
tar xzf "$FOTO_FILE" -C "$FOTO_DIR"
php "$APP_DIR/artisan" migrate --force

echo "Pemulihan selesai. Periksa aplikasi sebelum mengakhiri maintenance."
