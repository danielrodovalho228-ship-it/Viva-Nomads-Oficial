#!/usr/bin/env bash
# Resiliência 2 — fim da cópia (copia) ou do teste de restauração (drill). Roda SEMPRE (if: always()):
#  1. decide OK/falha e o motivo curto (a etapa que falhou; textos fixos, sem dado);
#  2. compara com a cópia anterior (dump < 50% do anterior; objetos do storage −20%) → alerta;
#  3. grava a linha em public.backups_execucoes (é o aviso no admin);
#  4. havendo falha ou alerta: e-mail ao Daniel (scripts/backup/alarme.ts) e a Action termina vermelha.
#   bash scripts/backup/finalizar.sh <copia|drill>
# Variáveis: SUPABASE_DB_URL (onde gravar), RESEND_API_KEY, AVISO_DANIEL_EMAIL (opcional), ALARME_SIMULAR=1 (ensaio).
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"
set +e

TIPO="${1:-}"
case "$TIPO" in copia | drill) ;; *)
  echo "uso: finalizar.sh <copia|drill>"
  exit 2
  ;;
esac
export NODE_OPTIONS="${NODE_OPTIONS:-} --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

ler() { [ -f "$TRAB/res_$1" ] && cat "$TRAB/res_$1"; }
FIM="$(date -u +%FT%TZ)"
INICIO="$(ler inicio)"
[ -n "$INICIO" ] || INICIO="$FIM"

if [ "$(ler ok)" = "1" ]; then
  OK=1
  MOTIVO="$(ler motivo)"
else
  OK=0
  MOTIVO="$(ler motivo)"
  if [ -z "$MOTIVO" ]; then
    if [ -f "$TRAB/etapa" ]; then MOTIVO="falha na etapa: $(cat "$TRAB/etapa")"; else MOTIVO="falha antes de começar (instalação ou configuração)"; fi
  fi
fi
MOTIVO="${MOTIVO//@/ }"
printf '%s\n' "$OK" >"$TRAB/res_ok"
printf '%s\n' "$MOTIVO" >"$TRAB/res_motivo_final"

psqlq() { "$PSQL" "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@" 2>"$TRAB/psql.err"; }

# 2. A cópia anterior que deu certo (só números).
: >"$TRAB/anterior.txt"
if [ "$TIPO" = "copia" ]; then
  psqlq -At -F'|' -c "select coalesce(bytes_banco::text, ''), coalesce(objetos_storage::text, '') from public.backups_execucoes where tipo = 'copia' and ok order by inicio desc limit 1" >"$TRAB/anterior.txt" ||
    echo "Aviso: não foi possível ler a cópia anterior ($(primeiro_erro "$TRAB/psql.err"))."
fi
node "$RAIZ/scripts/backup/alarme.ts" avaliar "$TIPO" "$TRAB"
ALERTAS="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(m.length))' "$TRAB/alarme_motivos.json")"
if [ "$OK" = "1" ] && [ "${ALERTAS:-0}" -gt 0 ]; then
  MOTIVO="Alerta: $(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(m.join(" ").slice(0,280))' "$TRAB/alarme_motivos.json")"
fi

# 3. A linha do registro (aviso no admin).
gravou=1
psqlq \
  -v tipo="$TIPO" -v inicio="$INICIO" -v fim="$FIM" -v ok="$([ "$OK" = 1 ] && echo true || echo false)" -v motivo="$MOTIVO" \
  -v bytes_banco="$(ler bytes_banco)" -v objetos_storage="$(ler objetos_storage)" -v bytes_storage="$(ler bytes_storage)" \
  -v duracao="$(ler duracao_restauracao_s)" -v bytes_pasta="$(ler bytes_pasta)" <<'SQL' || gravou=0
insert into public.backups_execucoes
  (tipo, inicio, fim, ok, motivo, bytes_banco, objetos_storage, bytes_storage, duracao_restauracao_s, bytes_pasta)
values (
  :'tipo', :'inicio'::timestamptz, :'fim'::timestamptz, :'ok'::boolean, nullif(:'motivo', ''),
  nullif(:'bytes_banco', '')::bigint, nullif(:'objetos_storage', '')::bigint, nullif(:'bytes_storage', '')::bigint,
  nullif(:'duracao', '')::integer, nullif(:'bytes_pasta', '')::bigint
);
SQL
if [ "$gravou" = 1 ]; then
  echo "Registro gravado em backups_execucoes ($TIPO, ok=$OK)."
else
  echo "::error::Não foi possível gravar em backups_execucoes ($(primeiro_erro "$TRAB/psql.err"))."
fi

# 4. Alarme.
if [ "$OK" != "1" ] || [ "${ALERTAS:-0}" -gt 0 ]; then
  if [ "${ALARME_SIMULAR:-}" != "1" ]; then
    psqlq -At -c "select coalesce(json_agg(json_build_object('id', p.id, 'role', p.role, 'recebe_avisos_ceo', p.recebe_avisos_ceo, 'recebe_alertas_operacionais', p.recebe_alertas_operacionais, 'email', u.email)), '[]') from public.profiles p join auth.users u on u.id = p.id where p.role = 'admin' and p.recebe_avisos_ceo" >"$TRAB/destinos.json" ||
      echo "[]" >"$TRAB/destinos.json"
  fi
  node "$RAIZ/scripts/backup/alarme.ts" enviar "$TIPO" "$TRAB"
  echo "::error::$([ "$TIPO" = copia ] && echo "Cópia noturna" || echo "Teste de restauração"): ${MOTIVO}"
  exit 1
fi
[ "$gravou" = 1 ] || exit 1
echo "Tudo certo."
