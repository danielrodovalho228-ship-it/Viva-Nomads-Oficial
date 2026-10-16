-- Viva Nomads — rollback da 0140: apaga o registro de envios das automações. Só use se o Daniel mandar.
begin;
set local lock_timeout = '5s';
drop table if exists public.automacoes_envios;
delete from supabase_migrations.schema_migrations where version = '20261016000140';
commit;
