-- Viva Nomads — rollback da 0357 (E1112): tira os gatilhos de contacto da página do parceiro. Nunca roda sozinho.
begin;
set local lock_timeout = '5s';
drop trigger if exists contato_parceiro_nome_publico on public.parceiros;
drop trigger if exists contato_parceiro_descricao on public.parceiros;
drop trigger if exists contato_parceiro_descricao_curta on public.parceiros;
delete from supabase_migrations.schema_migrations where version = '20261122000357';
commit;
