#!/bin/bash
# Teste do P0 (0052/0054/0053 + rollbacks) num Postgres LOCAL descartável — nunca em produção.
# Reproduz o estado atual (políticas/funções copiadas das migrações) e executa os
# ARQUIVOS REAIS de migração e rollback do repo, simulando anon/authenticated/
# service_role. Uso: PGHOST=/tmp/pgs PGPORT=5499 PGUSER=postgres supabase/testes/p0-rls/run.sh
set -e
H="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$H/../../.." && pwd)"
: "${PGHOST:?defina PGHOST}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"
psql -qc "drop database if exists p0_teste" -c "create database p0_teste" >/dev/null
DB="psql -q -v ON_ERROR_STOP=1 -d p0_teste"
$DB -f "$H/pre_estado.sql" >/dev/null; $DB -f "$H/seed.sql" >/dev/null; $DB -f "$H/fase_pre.sql" >/dev/null
$DB -f "$R/supabase/migrations/0052_p0_seguranca_compativel.sql" >/dev/null
$DB -f "$R/supabase/migrations/0054_p0_ajustes_indicacao_mensagens.sql" >/dev/null
$DB -f "$R/supabase/migrations/0054_p0_ajustes_indicacao_mensagens.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_main0052.sql" >/dev/null
$DB -f "$R/supabase/migrations/0053_p0_seguranca_revokes.sql" >/dev/null
$DB -f "$H/fase_novo0053.sql" >/dev/null
psql -q -d p0_teste -P pager=off -f "$R/supabase/producao/verificar-seguranca.sql" 2>&1 | grep -E "^ [A-D][0-9a-z.]" | sed 's/  */ /g'
$DB -f "$R/supabase/producao/rollback/0053_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0053.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0054_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0054.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0052_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0052.sql" >/dev/null
set +e
$DB -P pager=off -c "select fase, count(*) casos, count(*) filter (where ok) ok from resultado group by fase order by min(ordem)"
$DB -P pager=off -c "select fase, caso, esperado, obtido, detalhe from resultado where not ok order by ordem"
FALHAS=$($DB -Atc "select count(*) from resultado where not ok"); [ "$FALHAS" = "0" ] && echo "✅ todos os cenários batem" || { echo "❌ $FALHAS cenário(s) divergentes"; exit 1; }
