#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/aplikasiabsen/backend}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/absen}"
DB_NAME="${DB_NAME:-absen}"
DB_DEFAULTS_FILE="${DB_DEFAULTS_FILE:-/etc/absen-backup.cnf}"
SIMPAN_HARI="${SIMPAN_HARI:-14}"

if [ ! -r "$DB_DEFAULTS_FILE" ]; then
  echo "Berkas kredensial MySQL tidak bisa dibaca: $DB_DEFAULTS_FILE" >&2
  echo "Buat berkas 0600 berisi [client] host, user, dan password." >&2
  exit 1
fi

if [ ! -d "$APP_DIR/storage/app/private/absen" ]; then
  echo "Folder foto tidak ditemukan: $APP_DIR/storage/app/private/absen" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077
stamp="$(date +%Y%m%d-%H%M%S)"
db_file="$BACKUP_DIR/db-$stamp.sql.gz"
foto_file="$BACKUP_DIR/foto-$stamp.tar.gz"

mysqldump \
  --defaults-extra-file="$DB_DEFAULTS_FILE" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "$DB_NAME" | gzip -c > "$db_file"

tar czf "$foto_file" -C "$APP_DIR/storage/app/private" absen

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$db_file")" "$(basename "$foto_file")" > "SHA256SUMS-$stamp"
)

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-*.sql.gz' -mtime +"$SIMPAN_HARI" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'foto-*.tar.gz' -mtime +"$SIMPAN_HARI" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'SHA256SUMS-*' -mtime +"$SIMPAN_HARI" -delete

echo "Backup selesai: $stamp"
echo "Database: $db_file"
echo "Foto: $foto_file"
echo "Checksum: $BACKUP_DIR/SHA256SUMS-$stamp"
