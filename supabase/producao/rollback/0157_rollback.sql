-- Rollback da 0157: remove as conferências de matrícula (o document_status da qualificação continua como estava).
begin;
drop table if exists public.property_ownership_checks;
delete from supabase_migrations.schema_migrations where version = '20261018000157';
commit;
