-- Rollback da 0308 (E634): apaga a tabela nova (nada mais depende dela; a chave FICHA_RESUMO_ATIVA está desligada).
begin;
drop table if exists public.contrato_ficha_resumo;
delete from supabase_migrations.schema_migrations where version = '20261105000308';
commit;
