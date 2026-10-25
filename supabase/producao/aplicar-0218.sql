-- Viva Nomads — aplicar 0218 (imóvel próprio sem sublocação: corrige as 2 linhas antigas e valida a restrição — 59-C1).
-- Idempotente. Rollback: supabase/producao/rollback/0218_rollback.sql.
begin;
set local lock_timeout = '5s';
update public.properties
   set sublease_authorized = false
 where ownership_type = 'own'
   and sublease_authorized is true;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'properties_proprio_sem_sublocacao' and conrelid = 'public.properties'::regclass and not convalidated
  ) then
    alter table public.properties validate constraint properties_proprio_sem_sublocacao;
  end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000218', '0218_proprio_sem_sublocacao_validar',
       array['-- conteúdo em supabase/migrations/0218_proprio_sem_sublocacao_validar.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000218');
commit;
