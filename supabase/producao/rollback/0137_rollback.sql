-- Viva Nomads — rollback da 0137 (alerta de busca salva). Apaga o registro de envios e a coluna do alerta.
begin;
set local lock_timeout = '5s';
drop table if exists public.alertas_busca_envios;
drop policy if exists buscas_salvas_alerta on public.buscas_salvas;
revoke update (alerta_ativo) on public.buscas_salvas from authenticated;
alter table public.buscas_salvas drop column if exists alerta_ativo;
delete from supabase_migrations.schema_migrations where version = '20261016000137';
commit;
