#!/usr/bin/env bash
# Aplica em produção os scripts supabase/producao/aplicar-NNNN.sql que ainda não
# estão registrados em supabase_migrations.schema_migrations ("merge aplica migração").
#
#   SUPABASE_DB_URL=… bash scripts/aplicar-migracoes.sh            # aplica
#   SUPABASE_DB_URL=… bash scripts/aplicar-migracoes.sh --simular  # só lista o que aplicaria
#
# Regras:
#  • só arquivos aplicar-NNNN.sql (4 dígitos, um por migração), em ordem numérica, a
#    partir da 0076 (as anteriores foram aplicadas à mão e não seguem o padrão);
#  • "já aplicada" = existe em schema_migrations um registro com nome "NNNN_…";
#  • o script precisa ter begin/commit e se registrar em schema_migrations — senão PARA
#    (rodaria de novo a cada merge);
#  • erro em um script: para tudo; a transação dele é desfeita (nada pela metade);
#  • nunca roda rollback; nunca imprime a URL, a senha ou dados do banco (o repositório é
#    público, o log da Action também): a saída das consultas vai para /dev/null e do erro
#    sai só a primeira linha "ERROR:", sem DETAIL.
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL (secret do GitHub; nunca no código nem no chat).}"
DIR="${MIGRACOES_DIR:-supabase/producao}"
MINIMA=76
SIMULAR=0
[ "${1:-}" = "--simular" ] && SIMULAR=1
export PGCONNECT_TIMEOUT=20

psqlq() { psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

registradas() {
  psqlq -At -c "select coalesce(string_agg(distinct substr(name, 1, 4), ' '), '') from supabase_migrations.schema_migrations where name ~ '^[0-9]{4}_'"
}

APLICADAS="$(registradas)"
aplicou=()
pulou=()
erro_arq="$(mktemp)"
trap 'rm -f "$erro_arq"' EXIT

# 1) Descobre e VALIDA todas as pendentes antes de aplicar a primeira.
pendentes=()
for arq in $(ls "$DIR" | grep -E '^aplicar-[0-9]{4}\.sql$' | sort); do
  n="${arq:8:4}"
  [ $((10#$n)) -lt $MINIMA ] && continue
  if [[ " $APLICADAS " == *" $n "* ]]; then
    pulou+=("$n")
    continue
  fi
  caminho="$DIR/$arq"
  if ! grep -qE "^begin;" "$caminho" || ! grep -qE "^commit;" "$caminho"; then
    echo "::error::$arq não tem begin;/commit; — nada foi aplicado."
    exit 1
  fi
  if ! grep -qE "insert into supabase_migrations\.schema_migrations" "$caminho" || ! grep -qE "'${n}_[a-z0-9_]+'" "$caminho"; then
    echo "::error::$arq não se registra em schema_migrations com o nome '${n}_…' — nada foi aplicado."
    exit 1
  fi
  pendentes+=("$n")
done

# 2) Aplica em ordem; erro em uma = para (a transação dela é desfeita).
for n in "${pendentes[@]}"; do
  caminho="$DIR/aplicar-$n.sql"
  if [ "$SIMULAR" = 1 ]; then
    echo "$n: seria aplicada (simulação)"
    aplicou+=("$n")
    continue
  fi
  echo "$n: aplicando…"
  if ! psqlq -o /dev/null -f "$caminho" >/dev/null 2>"$erro_arq"; then
    msg="$(grep -m1 -E 'ERROR:' "$erro_arq" | sed -E 's/^psql:[^:]*:[0-9]+: //' | cut -c1-300 || true)"
    echo "::error::$n falhou e foi desfeita: ${msg:-erro sem mensagem}"
    echo "Aplicadas nesta execução: ${aplicou[*]:-nenhuma}"
    exit 1
  fi
  APLICADAS="$(registradas)"
  if [[ " $APLICADAS " != *" $n "* ]]; then
    echo "::error::$n rodou mas não ficou registrada em schema_migrations — parado."
    exit 1
  fi
  aplicou+=("$n")
  echo "$n: aplicada e registrada"
done

echo "Puladas (já estavam aplicadas): ${pulou[*]:-nenhuma}"
if [ "$SIMULAR" = 1 ]; then
  echo "Aplicaria: ${aplicou[*]:-nenhuma}"
else
  echo "Aplicadas agora: ${aplicou[*]:-nenhuma}"
fi
