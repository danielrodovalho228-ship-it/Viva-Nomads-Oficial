-- Rollback da 0332: volta ao índice parcial da 0226.
begin;
create unique index if not exists push_adiados_grupo on public.push_adiados (user_id, grupo) where grupo is not null;
drop index if exists public.push_adiados_user_grupo;
delete from supabase_migrations.schema_migrations where version = '20261107000332';
commit;
