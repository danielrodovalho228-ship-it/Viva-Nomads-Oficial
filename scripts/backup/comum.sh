# shellcheck shell=bash
# Resiliência 2 — o que a cópia noturna, o teste de restauração e o ensaio têm em comum. Incluído com "source".
#
# Regras de segredo (o log da Action é público para quem vê o repositório):
#  • sem rastreio de comandos (xtrace); nenhum echo de variável que venha de segredo;
#  • o rclone escreve SÓ no arquivo privado $RLOG (nunca impresso: pode ter nome de arquivo de usuário);
#  • a saída de erro do pg_dump/pg_restore/psql vai para arquivo privado; do erro sai só a 1ª linha, sem URL;
#  • tudo fica em $TRAB (pasta 700, arquivos 600) e é apagado no fim (limpar.sh, sempre).
# Variáveis usadas por quem inclui este arquivo (copia.sh, drill.sh, finalizar.sh…).
# shellcheck disable=SC2034
set -euo pipefail
umask 077

TRAB="${BACKUP_TRAB:-${RUNNER_TEMP:-/tmp}/viva-backup}"
mkdir -p "$TRAB"
chmod 700 "$TRAB"
export RCLONE_CONFIG="$TRAB/rclone.conf"
RLOG="$TRAB/rclone.log"

# O destino cifrado (remoto crypt "cripto:") e a pasta de verdade por baixo dele (no Drive do Daniel).
DESTINO="${BACKUP_DESTINO:-cripto:VivaNomads-Backup}"
CRIPTO_BASE="${BACKUP_CRIPTO_BASE:-drive:VivaNomads-Backup}"
RCLONE="${RCLONE_BIN:-rclone}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
export PSQL="${PSQL:-$PG_BIN/psql}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-20}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# rclone sempre com log só no arquivo privado e sem barra de progresso.
rc() { "$RCLONE" --config "$RCLONE_CONFIG" --log-file "$RLOG" --log-level NOTICE --stats 0 "$@"; }

# Etapa atual: vira o motivo curto da falha ("falha na etapa: dump do banco"). Só textos fixos daqui.
etapa() {
  printf '%s\n' "$1" >"$TRAB/etapa"
  echo "▶ $1"
}

# Grava um valor do resultado (números e textos fixos; nunca dado).
resultado() { printf '%s\n' "$2" >"$TRAB/res_$1"; }

# Primeira linha de erro de um arquivo de stderr, sem URL nem DETAIL (o arquivo em si nunca é impresso).
primeiro_erro() {
  grep -m1 -E '(ERROR|FATAL|error):' "$1" 2>/dev/null | sed -E 's#[a-z]+://[^ ]+#[url]#g; s/"[^"]*@[^"]*"/[credencial]/g' | cut -c1-200 || true
}

# Data e hora de Brasília para o nome do dump (AAAA-MM-DD_HHMM).
agora_brt() { TZ=America/Sao_Paulo date +%F_%H%M; }

# Em Action: o valor passa a sair como *** no log, se algum dia aparecer.
mascarar() { if [ -n "${GITHUB_ACTIONS:-}" ] && [ -n "$1" ]; then echo "::add-mask::$1"; fi; }
