-- Viva Nomads — rollback da 0142: remove o motivo da estadia das candidaturas. Só use se o Daniel mandar.
begin;
set local lock_timeout = '5s';
alter table public.leads drop constraint if exists leads_motivo_estadia_chk;
alter table public.leads drop column if exists motivo_estadia;
delete from supabase_migrations.schema_migrations where version = '20261016000142';
commit;
