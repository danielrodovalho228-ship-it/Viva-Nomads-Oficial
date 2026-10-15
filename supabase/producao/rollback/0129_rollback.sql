-- Rollback da 0129: remove resposta pública e pedidos de revisão de avaliação (os dados dessas duas tabelas se perdem).
begin;
drop table if exists public.avaliacao_contestacoes;
drop table if exists public.avaliacao_respostas;
drop function if exists public.avaliacao_resposta_valida();
drop function if exists public.avaliacao_contestacao_valida();
delete from supabase_migrations.schema_migrations where version = '20261015000129';
commit;
