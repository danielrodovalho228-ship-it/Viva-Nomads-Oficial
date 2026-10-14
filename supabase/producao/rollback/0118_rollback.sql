-- Rollback da 0118: remove a coluna (as ordens continuam, só perdem o vínculo com o contrato).
begin;
drop index if exists public.service_orders_contrato_idx;
alter table public.service_orders drop column if exists contrato_id;
delete from supabase_migrations.schema_migrations where version = '20261014000118';
commit;
