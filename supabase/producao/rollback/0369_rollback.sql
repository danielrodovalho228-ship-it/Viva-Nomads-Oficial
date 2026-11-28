-- Viva Nomads — rollback da 0369 (E1238): tira a coluna conferencias.prazo_em. Nunca roda sozinho.
-- ATENÇÃO: os prazos já gravados perdem-se; o código de antes não os lê (calcula pela hora do anúncio).
begin;
set local lock_timeout = '5s';
alter table public.conferencias drop column if exists prazo_em;
delete from supabase_migrations.schema_migrations where version = '20261127000369';
commit;
