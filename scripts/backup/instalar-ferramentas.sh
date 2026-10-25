#!/usr/bin/env bash
# Resiliência 2 — instala o rclone (versão FIXA, conferida pelo SHA-256) e o cliente do Postgres 17 (pg_dump,
# pg_restore e psql na mesma versão do servidor do Supabase). Roda no runner ubuntu da Action.
set -euo pipefail

RCLONE_VERSAO="1.71.2"
RCLONE_SHA256="ab9fa5877cee91c64fdfd61a27028a458cf618b39259e5c371dc2ec34a12e415" # rclone-v1.71.2-linux-amd64.zip

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ! command -v rclone >/dev/null || ! rclone version 2>/dev/null | head -1 | grep -q "v$RCLONE_VERSAO\$"; then
  zip="rclone-v$RCLONE_VERSAO-linux-amd64.zip"
  curl -fsSL --retry 3 -o "$tmp/$zip" "https://github.com/rclone/rclone/releases/download/v$RCLONE_VERSAO/$zip"
  echo "$RCLONE_SHA256  $tmp/$zip" | sha256sum -c --quiet -
  unzip -q "$tmp/$zip" -d "$tmp"
  sudo install -m 0755 "$tmp/rclone-v$RCLONE_VERSAO-linux-amd64/rclone" /usr/local/bin/rclone
fi
rclone version | head -1

if [ ! -x /usr/lib/postgresql/17/bin/pg_dump ]; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-common >/dev/null
  sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
  sudo apt-get install -y -qq postgresql-client-17 >/dev/null
fi
/usr/lib/postgresql/17/bin/pg_dump --version
