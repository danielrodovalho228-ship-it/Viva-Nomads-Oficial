-- Viva Nomads — aplicar 0341 (Frente 0: completude e regressões do laboratório em lab_execucoes). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0341_rollback.sql.
begin;
set local lock_timeout = '5s';

-- Frente 0 (correção consolidada de 11/11/2026): cada rodada do laboratório grava se executou tudo o que o commit lista e
-- quais specs que já foram verdes voltaram a falhar. Linhas antigas ficam com null (não se sabe a listagem delas).
alter table public.lab_execucoes add column if not exists listados integer;
alter table public.lab_execucoes add column if not exists executados integer;
alter table public.lab_execucoes add column if not exists nao_executados integer;
alter table public.lab_execucoes add column if not exists regressoes jsonb not null default '[]'::jsonb;

insert into supabase_migrations.schema_migrations (version, name)
select '20261111000341', '0341_lab_execucoes_completude_regressoes'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261111000341');
commit;
