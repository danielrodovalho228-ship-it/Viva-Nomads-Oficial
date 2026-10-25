-- Rollback da 0200: remove a restrição (estado anterior).
begin;
alter table public.properties drop constraint if exists properties_proprio_sem_sublocacao;
delete from supabase_migrations.schema_migrations where version = '20261021000200';
commit;
