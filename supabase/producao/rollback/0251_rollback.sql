-- Viva Nomads — rollback da 0251: remove o registro das entradas da QA. Idempotente.
begin;
set local lock_timeout = '5s';
drop table if exists public.qa_entradas;
delete from supabase_migrations.schema_migrations where version = '20261028000251';
commit;
