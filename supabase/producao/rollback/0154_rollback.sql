-- Rollback da 0154: tira o número de pessoas da candidatura.
begin;
alter table public.leads drop constraint if exists leads_qtd_ocupantes_chk;
alter table public.leads drop column if exists qtd_ocupantes;
delete from supabase_migrations.schema_migrations where version = '20261017000154';
commit;
