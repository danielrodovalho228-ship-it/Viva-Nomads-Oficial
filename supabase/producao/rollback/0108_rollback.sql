-- Rollback da 0108: remove as colunas de assinatura (perde as datas gravadas; o contrato volta a não ter registro de assinatura).
begin;
alter table public.contratos drop column if exists assinado_inquilino_em;
alter table public.contratos drop column if exists assinado_proprietario_em;
delete from supabase_migrations.schema_migrations where version = '20261012000108';
commit;
