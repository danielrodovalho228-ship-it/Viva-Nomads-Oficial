-- Viva Nomads — rollback da 0122 (buscas salvas). Apaga a tabela e as buscas salvas.
begin;
set local lock_timeout = '5s';
drop trigger if exists buscas_salvas_limite on public.buscas_salvas;
drop function if exists public.buscas_salvas_limite();
drop table if exists public.buscas_salvas;
delete from supabase_migrations.schema_migrations where version = '20261014000122';
commit;
