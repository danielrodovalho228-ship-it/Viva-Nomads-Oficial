-- Rollback da 0106: remove a tabela de resultados do laboratório (só histórico de testes; sem dados de clientes).
begin;
drop table if exists public.lab_execucoes;
delete from supabase_migrations.schema_migrations where version = '20261012000106';
commit;
