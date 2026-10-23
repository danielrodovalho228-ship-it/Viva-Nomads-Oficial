-- Viva Nomads — rollback da 0222 (papel ativo — PAPEL-B). Idempotente. O papel volta a ser derivado do modo
-- (preferred_mode, que a troca também grava para morador e proprietário).
begin;
set local lock_timeout = '5s';
alter table public.profiles drop constraint if exists profiles_papel_ativo_chk;
alter table public.profiles drop column if exists papel_ativo;
delete from supabase_migrations.schema_migrations where version = '20261023000222';
commit;
