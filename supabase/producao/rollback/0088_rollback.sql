-- Rollback da 0088: tira a função (o chat volta a dizer que não lista migrações).
begin;
drop function if exists public.migracoes_aplicadas();
delete from supabase_migrations.schema_migrations where version = '20261007000088';
commit;
