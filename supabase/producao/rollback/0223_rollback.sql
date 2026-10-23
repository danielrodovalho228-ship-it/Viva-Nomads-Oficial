-- Viva Nomads — rollback da 0223 (pausar e reativar anúncio — 64-B). Idempotente. Os anúncios pausados continuam
-- pausados (só perdem o motivo); nada volta para a busca sozinho.
begin;
set local lock_timeout = '5s';
drop trigger if exists trg_properties_reativar_so_dono on public.properties;
drop trigger if exists trg_properties_pausa_coerente on public.properties;
drop function if exists public.properties_reativar_so_dono();
drop function if exists public.properties_pausa_coerente();
alter table public.properties drop constraint if exists properties_pausa_motivo_chk;
alter table public.properties drop column if exists pausa_motivo;
alter table public.properties drop column if exists pausado_em;
delete from supabase_migrations.schema_migrations where version = '20261023000223';
commit;
