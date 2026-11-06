-- Rollback da 0309 (E640 (b)): remove a função, a tabela de alertas e o marcador. A foto e o hash seguem como estavam.
begin;
drop function if exists public.fotos_parecidas(uuid, int);
drop table if exists public.fotos_repetidas_alertas;
alter table public.properties drop column if exists foto_repetida_em;
delete from supabase_migrations.schema_migrations where version = '20261105000309';
commit;
