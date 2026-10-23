-- Viva Nomads — rollback da 0214 (intenção no perfil — Prompt 49). Idempotente. Apaga as respostas de intenção.
begin;
set local lock_timeout = '5s';
revoke update (intencao) on public.profiles from authenticated;
alter table public.profiles drop constraint if exists profiles_intencao_chk;
alter table public.profiles drop column if exists intencao;
delete from supabase_migrations.schema_migrations where version = '20261023000214';
commit;
