-- Rollback da 0098. Rodar no SQL Editor (tem DROP).
begin;
set local lock_timeout = '5s';
alter table public.contratos drop constraint if exists contratos_tipo_cobranca_check;
alter table public.contratos drop column if exists tipo_cobranca;
delete from public.config_cobranca where chave = 'taxa_extensao';
delete from supabase_migrations.schema_migrations where version = '20261010000098';
commit;
