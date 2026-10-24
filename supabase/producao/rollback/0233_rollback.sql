-- Viva Nomads — rollback da 0233: tira a coluna regras_casa (o anúncio volta a mostrar só os fatos antigos). Idempotente.
begin;
set local lock_timeout = '5s';
alter table public.properties drop constraint if exists properties_regras_casa_objeto;
alter table public.properties drop column if exists regras_casa;
delete from supabase_migrations.schema_migrations where version = '20261023000233';
commit;
