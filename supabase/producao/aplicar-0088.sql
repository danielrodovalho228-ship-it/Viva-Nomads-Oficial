-- Viva Nomads — aplicar 0088 (leitura das migrações aplicadas, só servidor). Sem NOTICE, sem DROP. Rollback: supabase/producao/rollback/0088_rollback.sql
begin;
set local lock_timeout = '5s';
create or replace function public.migracoes_aplicadas()
returns table (version text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.version::text, coalesce(m.name, '')::text
    from supabase_migrations.schema_migrations m
   order by m.version desc
   limit 60
$$;
revoke all on function public.migracoes_aplicadas() from public, anon, authenticated;
grant execute on function public.migracoes_aplicadas() to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000088', '0088_migracoes_aplicadas',
       array['-- conteúdo em supabase/migrations/0088_migracoes_aplicadas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000088');
commit;

-- Conferência: anon e logado NÃO executam; a lista sai só com versão e nome.
select has_function_privilege('anon', 'public.migracoes_aplicadas()', 'execute') as anon,
       has_function_privilege('authenticated', 'public.migracoes_aplicadas()', 'execute') as logado;
select * from public.migracoes_aplicadas() limit 5;
