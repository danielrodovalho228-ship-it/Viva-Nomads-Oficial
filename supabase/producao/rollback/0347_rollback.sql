-- Viva Nomads — rollback da 0347 (E1032): tira o índice único e a coluna agentes_conversas.retorno_da_ordem. Nunca roda
-- sozinho. A Central não quebra sem a coluna: o código volta a postar o Retorno como antes (só com a conferência pelo
-- texto), e a mensagem em dobro volta a ser possível com a Central desenhada duas vezes no mesmo instante.
begin;
set local lock_timeout = '5s';
drop index if exists public.agentes_conversas_retorno_unico;
alter table public.agentes_conversas drop column if exists retorno_da_ordem;
delete from supabase_migrations.schema_migrations where version = '20261119000347';
commit;
