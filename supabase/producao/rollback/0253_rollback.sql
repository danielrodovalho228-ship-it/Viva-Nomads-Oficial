-- Viva Nomads — rollback da 0253: tira as políticas restritivas do admin observador (as permissivas não mudaram).
-- Idempotente. A linha da 0253 em schema_migrations sai junto, para a Action poder reaplicar.
begin;
set local lock_timeout = '5s';
do $$
declare
  p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' and policyname like 'qa_observador: nao escreve (%)' loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
drop policy if exists "qa_observador: nao apaga arquivo alheio" on storage.objects;
delete from supabase_migrations.schema_migrations where version = '20261029000253';
commit;
