#!/usr/bin/env bash
# Resiliência 2 — o teste de restauração (Action "Teste de restauração", domingo). Antes: instalar-ferramentas.sh e
# montar-rclone.sh. Depois (sempre): finalizar.sh drill e limpar.sh.
#  1. baixa e decifra o manifesto mais recente e o dump que ele aponta; confere o SHA-256;
#  2. num Postgres 17 limpo (o serviço do job), prepara os papéis/extensões e roda pg_restore — cronometrado (RTO);
#  3. scripts/drill/conferir.ts: migrações = repositório, linhas por tabela = manifesto, 5 consultas-chave e 20
#     objetos sorteados do storage baixados, decifrados e comparados com o Supabase (rclone check --download).
# Nunca imprime linha de dado nem nome de arquivo.
# Variáveis: DRILL_ADMIN_URL (o Postgres do job, banco "postgres"), DRILL_BANCO (padrão drill_restauracao).
source "$(dirname "${BASH_SOURCE[0]}")/../backup/comum.sh"
export NODE_OPTIONS="${NODE_OPTIONS:-} --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

: "${DRILL_ADMIN_URL:?Falta DRILL_ADMIN_URL (o Postgres de teste do job).}"
DRILL_BANCO="${DRILL_BANCO:-drill_restauracao}"
export DRILL_DB_URL="${DRILL_ADMIN_URL%/*}/$DRILL_BANCO"
[ -f "$RCLONE_CONFIG" ] || {
  echo "::error::rclone.conf não montado (rode montar-rclone.sh antes)."
  exit 1
}
rm -f "$TRAB"/res_*
resultado inicio "$(date -u +%FT%TZ)"
falhou() {
  resultado motivo "$1"
  echo "::error::$1"
  exit 1
}

etapa "manifesto mais recente"
MANIFESTO="$(rc lsf --files-only "$DESTINO/manifestos/" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$' | sort | tail -1 || true)"
[ -n "$MANIFESTO" ] || falhou "nenhum manifesto no backup"
rc copyto "$DESTINO/manifestos/$MANIFESTO" "$TRAB/manifesto.json" || falhou "não foi possível baixar e decifrar o manifesto"
DUMP="$(node "$RAIZ/scripts/drill/conferir.ts" dump "$TRAB/manifesto.json")" || falhou "manifesto fora do formato"
echo "  manifesto de ${MANIFESTO%.json}"

etapa "download do dump"
baixou=0
for pasta in diario semanal mensal; do
  if rc copyto "$DESTINO/banco/$pasta/$DUMP" "$TRAB/restaurar.dump" 2>/dev/null; then
    baixou=1
    break
  fi
done
[ "$baixou" = 1 ] || falhou "não foi possível baixar e decifrar o dump (arquivo ausente ou cifra corrompida)"
resultado bytes_banco "$(stat -c %s "$TRAB/restaurar.dump")"

etapa "hash do dump"
node "$RAIZ/scripts/drill/conferir.ts" hash "$TRAB/manifesto.json" "$TRAB/restaurar.dump" || falhou "o dump baixado não bate com o hash do manifesto (corrompido)"

etapa "restauração"
T0="$(date +%s)"
"$PSQL" "$DRILL_ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$DRILL_BANCO\"" -c "create database \"$DRILL_BANCO\" template template0" 2>"$TRAB/psql.err" ||
  falhou "não foi possível criar o banco de teste ($(primeiro_erro "$TRAB/psql.err"))"
"$PSQL" "$DRILL_DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$RAIZ/scripts/drill/preparo.sql" >/dev/null 2>"$TRAB/psql.err" ||
  falhou "não foi possível preparar o banco de teste ($(primeiro_erro "$TRAB/psql.err"))"
CODIGO_RESTORE=0
"$PG_BIN/pg_restore" --no-owner --no-privileges --dbname="$DRILL_DB_URL" "$TRAB/restaurar.dump" 2>"$TRAB/restore.err" || CODIGO_RESTORE=$?
T1="$(date +%s)"
ERROS_RESTORE="$(grep -c 'error:' "$TRAB/restore.err" || true)"
resultado duracao_restauracao_s "$((T1 - T0))"
echo "  pg_restore: $((T1 - T0)) s, código $CODIGO_RESTORE, $ERROS_RESTORE erro(s)"

etapa "conferência"
if DESTINO="$DESTINO" RCLONE_BIN="$RCLONE" RLOG="$RLOG" node "$RAIZ/scripts/drill/conferir.ts" conferir "$TRAB" "$ERROS_RESTORE"; then
  resultado ok 1
  echo "Teste de restauração verde."
else
  resultado motivo "$(cat "$TRAB/motivo_drill.txt" 2>/dev/null || echo "a conferência não bateu")"
  exit 1
fi
