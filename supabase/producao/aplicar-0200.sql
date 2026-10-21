-- Viva Nomads — aplicar 0200 (imóvel próprio sem sublocação autorizada). Idempotente. Rollback: supabase/producao/rollback/0200_rollback.sql.
begin;
set local lock_timeout = '5s';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_proprio_sem_sublocacao' and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_proprio_sem_sublocacao
      check (ownership_type <> 'own' or sublease_authorized is not true) not valid;
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261021000200', '0200_proprio_sem_sublocacao',
       array['-- conteúdo em supabase/migrations/0200_proprio_sem_sublocacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261021000200');
commit;
