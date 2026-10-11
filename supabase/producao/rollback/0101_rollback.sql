-- Rollback da 0101: remove o índice único do CNPJ.
begin;
drop index if exists public.profiles_cnpj_unico;
delete from supabase_migrations.schema_migrations where version = '20261011000101';
commit;
