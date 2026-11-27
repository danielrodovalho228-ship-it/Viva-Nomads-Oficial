-- Viva Nomads — rollback da 0350 (E1077): tira a função e a lista do piloto. Nunca roda sozinho.
-- Sem a lista, a chave volta a abrir só no lançamento público (VISTORIA_ATIVA) e no laboratório, como antes.
begin;
set local lock_timeout = '5s';
drop function if exists public.vistoria_no_piloto();
drop table if exists public.vistoria_piloto;
delete from supabase_migrations.schema_migrations where version = '20261121000350';
commit;
