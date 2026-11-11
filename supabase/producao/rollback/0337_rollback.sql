-- Rollback da 0337: sai o anúncio-semente do D-7 e o contrato (bloco e pagamento saem em cascata pelos ids fixos).
begin;
set local lock_timeout = '5s';
delete from public.contratos where id = 'a0337d00-0000-4000-8000-000000000011';
delete from public.properties where id = 'a0337d00-0000-4000-8000-000000000001';
delete from supabase_migrations.schema_migrations where version = '20261111000337';
commit;
