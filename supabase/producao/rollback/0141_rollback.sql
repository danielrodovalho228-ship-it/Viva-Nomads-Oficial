-- Viva Nomads — rollback da 0141: remove o motivo da estadia do perfil. Só use se o Daniel mandar.
begin;
set local lock_timeout = '5s';
alter table public.profiles drop constraint if exists profiles_motivo_estadia_chk;
alter table public.profiles drop column if exists motivo_estadia;
delete from supabase_migrations.schema_migrations where version = '20261016000141';
commit;
