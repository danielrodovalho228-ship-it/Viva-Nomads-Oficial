-- Rollback da 0191: remove o registro da cópia noturna e do teste de restauração (o cartão do admin some sozinho).
-- As cópias no Google Drive não são tocadas.
begin;
drop table if exists public.backups_execucoes;
delete from supabase_migrations.schema_migrations where version = '20261019000191';
commit;
