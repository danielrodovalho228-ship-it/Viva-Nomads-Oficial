-- Viva Nomads — aplicar 0173 (lab_execucoes.por_categoria: boletim do laboratório por categoria). Idempotente.
-- Rollback: supabase/producao/rollback/0173_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

alter table public.lab_execucoes add column if not exists por_categoria jsonb not null default '{}'::jsonb;
comment on column public.lab_execucoes.por_categoria is 'Cobertura por tipo (paginas/rotas/actions) da execução: {total,cobertos,percentual,por_tipo}.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000173', '0173_lab_execucoes_por_categoria',
       array['-- conteúdo em supabase/migrations/0173_lab_execucoes_por_categoria.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000173');
commit;
