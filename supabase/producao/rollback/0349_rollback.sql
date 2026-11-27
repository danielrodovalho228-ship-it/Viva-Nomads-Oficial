-- Viva Nomads — rollback da 0349 (E1075): tira a função e a tabela do perfil público. Nunca roda sozinho.
-- A página volta a mostrar só os credenciados: o endereço do perfil dá 404. O número gasto no contador da cidade não
-- volta (o contador só anda para a frente, como no credenciamento).
begin;
set local lock_timeout = '5s';
drop function if exists public.avaliador_perfil_publico(text);
drop table if exists public.avaliadores_perfil_publico;
delete from supabase_migrations.schema_migrations where version = '20261121000349';
commit;
