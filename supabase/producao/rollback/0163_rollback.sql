-- Rollback da 0163: remove o registro das chamadas de IA do cadastro.
begin;
drop table if exists public.ia_chamadas;
delete from supabase_migrations.schema_migrations where version = '20261018000163';
commit;
