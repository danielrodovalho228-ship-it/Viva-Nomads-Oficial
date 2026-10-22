-- Viva Nomads — rollback da 0209 (Aceite nas ordens dos agentes). Idempotente.
-- Ordens reabertas já voltaram a 'pendente'; só se retiram o gatilho, as colunas e os índices.
begin;
set local lock_timeout = '5s';
drop trigger if exists agentes_ordens_aceite_so_criador on public.agentes_ordens;
drop function if exists public.agentes_ordens_aceite_so_criador();
drop index if exists public.agentes_ordens_aguardando_aceite;
drop index if exists public.idx_agentes_ordens_aceito_por;
alter table public.agentes_ordens drop constraint if exists agentes_ordens_reaberto_motivo_tam;
alter table public.agentes_ordens drop column if exists aceito_por, drop column if exists aceito_em,
  drop column if exists reaberto_em, drop column if exists reaberto_motivo;
delete from supabase_migrations.schema_migrations where version = '20261022000209';
commit;
