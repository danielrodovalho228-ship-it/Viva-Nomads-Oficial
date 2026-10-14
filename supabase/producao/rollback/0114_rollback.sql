-- Rollback da 0114: apaga a tabela de leads do /empresas (os e-mails ao suporte continuam chegando).
begin;
drop table if exists public.leads_empresas;
delete from supabase_migrations.schema_migrations where version = '20261014000114';
commit;
