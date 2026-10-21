#!/usr/bin/env bash
# Resiliência 2 — apaga TUDO o que a cópia ou o teste deixou no runner: rclone.conf (com o token e as senhas
# ofuscadas), dump, manifesto, listas de arquivos e logs. Roda sempre (if: always()), mesmo depois de uma falha.
set -uo pipefail
TRAB="${BACKUP_TRAB:-${RUNNER_TEMP:-/tmp}/viva-backup}"
if [ -d "$TRAB" ]; then
  [ -f "$TRAB/rclone.conf" ] && shred -u "$TRAB/rclone.conf" 2>/dev/null
  rm -rf "$TRAB"
fi
[ -e "$TRAB" ] && { echo "::error::Não foi possível apagar a pasta temporária do backup."; exit 1; }
echo "Pasta temporária do backup apagada (rclone.conf incluído)."
