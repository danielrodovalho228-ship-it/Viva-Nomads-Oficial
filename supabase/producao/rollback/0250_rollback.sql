-- Viva Nomads — rollback da 0250: remove as colunas de interesse em espaço de trabalho. Idempotente.
begin;
set local lock_timeout = '5s';
alter table public.profiles drop constraint if exists profiles_espaco_trabalho_chk;
alter table public.profiles drop column if exists espaco_trabalho_oferta;
alter table public.profiles drop column if exists espaco_trabalho_procura;
delete from supabase_migrations.schema_migrations where version = '20261028000250';
commit;
