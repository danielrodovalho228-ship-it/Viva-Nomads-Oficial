-- Viva Nomads — rollback da 0248: remove a tabela do vínculo profissional (só tem domínio e hash de código). Idempotente.
begin;
set local lock_timeout = '5s';
drop table if exists public.vinculo_profissional;
delete from supabase_migrations.schema_migrations where version = '20261025000248';
commit;
