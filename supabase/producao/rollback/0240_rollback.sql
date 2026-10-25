-- Viva Nomads — rollback da 0240: tira os locais pessoais, o agregado e os pedidos "Não achei meu local". Idempotente.
-- As âncoras oficiais (destinos) não são tocadas; a busca volta a aceitar só o endereço na URL.
begin;
set local lock_timeout = '5s';
drop function if exists public.destinos_pessoais_agregado(int, int);
drop table if exists public.destinos_pessoais;
drop table if exists public.destinos_nao_achados;
delete from supabase_migrations.schema_migrations where version = '20261024000240';
commit;
