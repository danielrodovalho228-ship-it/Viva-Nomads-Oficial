\set ON_ERROR_STOP 1
drop database if exists p0340;
create database p0340;
\c p0340
do $$ begin create role authenticated; exception when duplicate_object then null; end $$; do $$ begin create role anon; exception when duplicate_object then null; end $$; do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text, statements text[], created_by text);
create function public.is_admin() returns boolean language sql as $$ select false $$;
\i supabase/migrations/0106_lab_execucoes.sql
alter table public.lab_execucoes add column por_categoria jsonb not null default '{}'::jsonb; -- 0173
insert into public.lab_execucoes (gatilho, passou, falhou, por_spec) values
 ('schedule', 5, 0, '{"t132-solicitar-reserva.spec.ts":{"passou":3,"falhou":0},"t999-sempre.spec.ts":{"passou":0,"falhou":1}}'),
 ('pull_request', 5, 0, '{"t500-so-no-pr.spec.ts":{"passou":3,"falhou":0}}');
\i supabase/producao/aplicar-0341.sql
\i supabase/producao/aplicar-0341.sql
select count(*) as registros_0341 from supabase_migrations.schema_migrations where name = '0341_lab_execucoes_completude_regressoes';
select listados, executados, nao_executados, regressoes from public.lab_execucoes limit 1;
-- o insert do workflow, com as colunas novas
\set resumo '{"passou":1,"falhou":1,"pulou":0,"instavel":0,"por_spec":{"t132-solicitar-reserva.spec.ts":{"passou":0,"falhou":1}},"falhas":[]}'
\set numeros '{"listados":4516,"executados":4500,"nao_executados":16}'
\set regressoes '[{"spec":"t132-solicitar-reserva.spec.ts","ultimoVerde":"2026-10-23","falhou":1}]'
\set categoria '{}'
\set sha 'abc' 
\set gatilho 'schedule'
\set run_url 'x'
-- histórico ANTES do insert (a mesma consulta do workflow)
select coalesce(jsonb_object_agg(spec, ultimo), '{}'::jsonb) is not null as tem,
       (select string_agg(spec, ',') from (select k.key as spec, max(e.criada_em) as ultimo
          from public.lab_execucoes e
          cross join lateral jsonb_each(case when jsonb_typeof(e.por_spec) = 'object' then e.por_spec else '{}'::jsonb end) k
         where e.gatilho is distinct from 'pull_request'
           and coalesce((k.value->>'passou')::int, 0) > 0 and coalesce((k.value->>'falhou')::int, 0) = 0
         group by k.key) y) as verdes
  from (select 1 as spec, now() as ultimo) z where false;
insert into public.lab_execucoes (commit_sha, gatilho, passou, falhou, pulou, instavel, por_spec, falhas, run_url, por_categoria,
                                  listados, executados, nao_executados, regressoes)
select :'sha', :'gatilho',
       (j->>'passou')::int, (j->>'falhou')::int, (j->>'pulou')::int, (j->>'instavel')::int,
       j->'por_spec', j->'falhas', :'run_url', :'categoria'::jsonb,
       (n->>'listados')::int, (n->>'executados')::int, (n->>'nao_executados')::int, :'regressoes'::jsonb
  from (select :'resumo'::jsonb as j, :'numeros'::jsonb as n) x;
select listados, executados, nao_executados, regressoes->0->>'spec' as regressao from public.lab_execucoes where commit_sha = 'abc';
-- numeros vazio ({}) não derruba o insert
insert into public.lab_execucoes (commit_sha, listados, executados, nao_executados, regressoes)
select 'vazio', (n->>'listados')::int, (n->>'executados')::int, (n->>'nao_executados')::int, '[]'::jsonb from (select '{}'::jsonb as n) x;
select commit_sha, listados from public.lab_execucoes where commit_sha='vazio';
\i supabase/producao/rollback/0341_rollback.sql
select count(*) as colunas_novas_depois_do_rollback from information_schema.columns where table_name='lab_execucoes' and column_name in ('listados','executados','nao_executados','regressoes');
select count(*) as registro_depois_do_rollback from supabase_migrations.schema_migrations where version='20261111000341';
\i supabase/producao/aplicar-0341.sql
select count(*) as reaplicada from information_schema.columns where table_name='lab_execucoes' and column_name in ('listados','executados','nao_executados','regressoes');
