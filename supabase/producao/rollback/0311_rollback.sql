-- Rollback da 0311 (E641): remove a tabela nova (nada mais depende dela; a chave COBRANCA_MENSAL_ATIVA está desligada).
begin;
drop table if exists public.cobranca_mensal_parcelas;
delete from supabase_migrations.schema_migrations where version = '20261105000311';
commit;
