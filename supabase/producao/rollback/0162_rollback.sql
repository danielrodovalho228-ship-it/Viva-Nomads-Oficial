-- Rollback da 0162: remove os pedidos de aviso de fotógrafo por cidade.
begin;
drop table if exists public.interesse_fotografo_cidade;
delete from supabase_migrations.schema_migrations where version = '20261018000162';
commit;
