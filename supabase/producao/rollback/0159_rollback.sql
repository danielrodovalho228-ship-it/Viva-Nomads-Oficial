-- Rollback da 0159: remove a trava de cidades e o interesse por cidade (publicar volta a valer em qualquer cidade).
begin;
drop table if exists public.interesse_cidade;
drop table if exists public.cidades_liberadas;
delete from supabase_migrations.schema_migrations where version = '20261018000159';
commit;
