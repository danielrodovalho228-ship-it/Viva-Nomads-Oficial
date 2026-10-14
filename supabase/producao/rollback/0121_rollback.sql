-- Rollback da 0121: remove as fichas de pet (perde só os dados das fichas).
begin;
drop trigger if exists pets_inquilino_limite on public.pets_inquilino;
drop function if exists public.pets_inquilino_limite();
drop table if exists public.pets_inquilino;
delete from supabase_migrations.schema_migrations where version = '20261014000121';
commit;
