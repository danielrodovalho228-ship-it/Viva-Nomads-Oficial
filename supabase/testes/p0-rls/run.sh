#!/bin/bash
# Teste do P0/P1 (0052/0054/0053/0055/0056/0057/0060/0061/0062/0063/0064/0065/0066 + rollbacks) num Postgres LOCAL descartável — nunca em produção.
# Reproduz o estado atual (políticas/funções copiadas das migrações) e executa os
# ARQUIVOS REAIS de migração e rollback do repo, simulando anon/authenticated/
# service_role. Uso: PGHOST=/tmp/pgs PGPORT=5499 PGUSER=postgres supabase/testes/p0-rls/run.sh
set -e
H="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$H/../../.." && pwd)"
: "${PGHOST:?defina PGHOST}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"
psql -qc "drop database if exists p0_teste" -c "create database p0_teste" >/dev/null
DB="psql -q -v ON_ERROR_STOP=1 -d p0_teste"
$DB -f "$H/pre_estado.sql" >/dev/null
# Alinhamento: as 3 migrações que faltam em produção, nos arquivos REAIS (2x = idempotentes).
for M in 0018_property_enrichment 0035_plano_fundador 0036_vistorias 0018_property_enrichment 0035_plano_fundador 0036_vistorias; do
  $DB -f "$R/supabase/migrations/$M.sql" >/dev/null
done
$DB -f "$H/seed.sql" >/dev/null; $DB -f "$H/fase_pre.sql" >/dev/null
$DB -f "$R/supabase/migrations/0052_p0_seguranca_compativel.sql" >/dev/null
$DB -f "$R/supabase/migrations/0054_p0_ajustes_indicacao_mensagens.sql" >/dev/null
$DB -f "$R/supabase/migrations/0054_p0_ajustes_indicacao_mensagens.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_main0052.sql" >/dev/null
$DB -f "$R/supabase/migrations/0053_p0_seguranca_revokes.sql" >/dev/null
$DB -f "$H/fase_novo0053.sql" >/dev/null
$DB -f "$R/supabase/migrations/0055_p1_dados_documentos_chamados_exclusao.sql" >/dev/null
$DB -f "$R/supabase/migrations/0055_p1_dados_documentos_chamados_exclusao.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0055.sql" >/dev/null
$DB -f "$R/supabase/migrations/0056_p1_integridade_limites.sql" >/dev/null
$DB -f "$R/supabase/migrations/0056_p1_integridade_limites.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0056.sql" >/dev/null
$DB -f "$R/supabase/migrations/0057_p1_contratos_candidaturas_contato.sql" >/dev/null
$DB -f "$R/supabase/migrations/0057_p1_contratos_candidaturas_contato.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0057.sql" >/dev/null
$DB -f "$H/fase_pre0060.sql" >/dev/null
$DB -f "$R/supabase/migrations/0060_qualificacao_por_imovel.sql" >/dev/null
$DB -f "$R/supabase/migrations/0060_qualificacao_por_imovel.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0060.sql" >/dev/null
$DB -f "$H/fase_pre0061.sql" >/dev/null
$DB -f "$R/supabase/migrations/0061_publicar_qualificacao_fotos.sql" >/dev/null
$DB -f "$R/supabase/migrations/0061_publicar_qualificacao_fotos.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0061.sql" >/dev/null
$DB -f "$H/fase_pre0062.sql" >/dev/null
$DB -f "$R/supabase/migrations/0062_seguranca_p0.sql" >/dev/null
$DB -f "$R/supabase/migrations/0062_seguranca_p0.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0062.sql" >/dev/null
$DB -f "$H/fase_pre0063.sql" >/dev/null
$DB -f "$R/supabase/migrations/0063_dinheiro_regras.sql" >/dev/null
$DB -f "$R/supabase/migrations/0063_dinheiro_regras.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0063.sql" >/dev/null
$DB -f "$H/fase_pre0064.sql" >/dev/null
$DB -f "$R/supabase/migrations/0064_pedido_compatibilidade.sql" >/dev/null
$DB -f "$R/supabase/migrations/0064_pedido_compatibilidade.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0064.sql" >/dev/null
$DB -f "$H/fase_pre0065.sql" >/dev/null
$DB -f "$R/supabase/migrations/0065_correcoes_revisao.sql" >/dev/null
$DB -f "$R/supabase/migrations/0065_correcoes_revisao.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0065.sql" >/dev/null
$DB -f "$H/fase_pre0066.sql" >/dev/null
$DB -f "$R/supabase/migrations/0066_coordenadas_aproximadas.sql" >/dev/null
$DB -f "$R/supabase/migrations/0066_coordenadas_aproximadas.sql" >/dev/null  # reaplicar é seguro
$DB -f "$H/fase_novo0066.sql" >/dev/null
psql -q -d p0_teste -P pager=off -f "$R/supabase/producao/verificar-seguranca.sql" 2>&1 | grep -E "^ [A-H][0-9a-z.]" | sed 's/  */ /g'
$DB -f "$R/supabase/producao/rollback/0064_rollback.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0063_rollback.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0062_rollback.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0061_rollback.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0060_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0060.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0057_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0057.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0056_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0056.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0055_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0055.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0053_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0053.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0054_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0054.sql" >/dev/null
$DB -f "$R/supabase/producao/rollback/0052_rollback.sql" >/dev/null; $DB -f "$H/fase_rb0052.sql" >/dev/null
set +e
# Prova do risco: em produção SEM o alinhamento, a 0052 tem que FALHAR (não pode entrar pela metade).
psql -qc "drop database if exists p0_sem_alinhamento" -c "create database p0_sem_alinhamento" >/dev/null
psql -q -v ON_ERROR_STOP=1 -d p0_sem_alinhamento -f "$H/pre_estado.sql" >/dev/null
if psql -q -v ON_ERROR_STOP=1 -1 -d p0_sem_alinhamento -f "$R/supabase/migrations/0052_p0_seguranca_compativel.sql" >/dev/null 2>&1; then
  $DB -qc "insert into resultado (fase, caso, esperado, obtido, ok) values ('ORDEM','0052 sem 0018/0035/0036 falha inteira','falha','passa',false)"
else
  $DB -qc "insert into resultado (fase, caso, esperado, obtido, ok) values ('ORDEM','0052 sem 0018/0035/0036 falha inteira','falha','falha',true)"
fi
psql -qc "drop database p0_sem_alinhamento" >/dev/null
$DB -P pager=off -c "select fase, count(*) casos, count(*) filter (where ok) ok from resultado group by fase order by min(ordem)"
$DB -P pager=off -c "select fase, caso, esperado, obtido, detalhe from resultado where not ok order by ordem"
FALHAS=$($DB -Atc "select count(*) from resultado where not ok"); [ "$FALHAS" = "0" ] && echo "✅ todos os cenários batem" || { echo "❌ $FALHAS cenário(s) divergentes"; exit 1; }
