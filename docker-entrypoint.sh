#!/bin/sh
set -eu

db_path="${PILE_DB_PATH:-/app/data/pile.sqlite}"
db_dir="$(dirname "$db_path")"

mkdir -p "$db_dir"
chown -R nextjs:nodejs "$db_dir" 2>/dev/null || true

if su-exec nextjs sh -c 'touch "$1/.write-test" && rm -f "$1/.write-test"' sh "$db_dir" 2>/dev/null; then
  exec su-exec nextjs "$@"
fi

echo "Warning: $db_dir is not writable by nextjs; running as container user $(id -u)." >&2
exec "$@"
