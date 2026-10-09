-- Rollback da 0095: remove a tabela de aprovações (só pedidos internos, sem dado de cliente).
-- Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
drop trigger if exists aprovacoes_imutavel on public.aprovacoes;
drop function if exists public.aprovacoes_imutavel();
drop table if exists public.aprovacoes;
delete from supabase_migrations.schema_migrations where version = '20261009000095';
commit;
