-- Rollback da 0173: tira a coluna por_categoria do histórico do laboratório (só contagens; nada de clientes).
begin;
alter table public.lab_execucoes drop column if exists por_categoria;
delete from supabase_migrations.schema_migrations where version = '20261019000173';
commit;
