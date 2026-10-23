-- Viva Nomads — rollback da 0214 (checklist dos selos de estrutura). Idempotente. Apaga só o checklist gravado.
begin;
set local lock_timeout = '5s';
drop table if exists public.imovel_estrutura;
delete from supabase_migrations.schema_migrations where version = '20261023000214';
commit;
