-- Rollback da 0279 (E399-C pacote 1): tira a tabela do link do Airbnb. Nada mais é tocado.
begin;
set local lock_timeout = '5s';
drop table if exists public.preco_justo_airbnb;
delete from supabase_migrations.schema_migrations where version = '20261101000279';
commit;
