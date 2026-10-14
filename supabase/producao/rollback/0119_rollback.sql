-- Rollback da 0119: remove a coluna de regras de pets (perde só as regras detalhadas).
begin;
alter table public.properties drop column if exists pets_regras;
delete from supabase_migrations.schema_migrations where version = '20261014000119';
commit;
