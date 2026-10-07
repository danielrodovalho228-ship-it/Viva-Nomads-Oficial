-- Viva Nomads — aplicar 0080 (exclusão de conta não trava nas fotos) em produção.
-- SQL Editor ou ferramenta do Supabase: nenhum comando gera NOTICE. Reaplicar é seguro.
-- Conteúdo = supabase/migrations/0080_exclusao_conta_fotos.sql + registro no histórico.
begin;
alter function public.recalc_listing_quality(uuid) security definer;
alter function public.recalc_listing_quality(uuid) set search_path = public;
alter function public.trg_recalc_listing_quality() security definer;
alter function public.trg_recalc_listing_quality() set search_path = public;

revoke all on function public.recalc_listing_quality(uuid) from public, anon, authenticated;
revoke all on function public.trg_recalc_listing_quality() from public, anon, authenticated;
grant execute on function public.recalc_listing_quality(uuid) to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000080', '0080_exclusao_conta_fotos',
       array['-- conteúdo em supabase/migrations/0080_exclusao_conta_fotos.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000080');
commit;

-- Conferência (só leitura): as 2 funções com prosecdef = true; ninguém além de
-- postgres/service_role executa recalc; a versão no histórico.
select proname, prosecdef, proconfig, proacl::text from pg_proc
 where proname in ('recalc_listing_quality', 'trg_recalc_listing_quality');
select version, name from supabase_migrations.schema_migrations where version = '20261007000080';
