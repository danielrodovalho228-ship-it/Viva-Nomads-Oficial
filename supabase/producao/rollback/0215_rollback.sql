-- Viva Nomads — rollback da 0215 (avaliadores credenciados — Prompt 62-B1). Idempotente. Apaga credenciamentos,
-- preços, pedidos, designações, conduta, auditoria e a fila; tira 'vistoria' das categorias dos parceiros. O bucket
-- "avaliadores" fica (apague pelo painel se estiver vazio).
begin;
set local lock_timeout = '5s';
do $cron$
begin
  perform cron.unschedule('vistoria') where exists (select 1 from cron.job where jobname = 'vistoria');
exception when others then null;
end $cron$;
drop function if exists public.vistoria_tique();
drop function if exists public.avaliadores_publicos();
drop table if exists public.vistoria_fila_admin;
drop table if exists public.vistoria_auditoria;
drop table if exists public.vistoria_conduta;
drop table if exists public.vistoria_designacoes;
drop table if exists public.vistoria_pedidos;
drop function if exists public.vistoria_sou_avaliador(uuid);
drop table if exists public.vistoria_precos;
drop table if exists public.avaliadores_credenciamento;
drop function if exists public.proximo_numero_avaliador(text);
drop table if exists public.avaliadores_contador;
update public.parceiros set categorias = array_remove(categorias, 'vistoria') where 'vistoria' = any (categorias);
alter table public.parceiros drop constraint if exists parceiros_categorias;
alter table public.parceiros add constraint parceiros_categorias check (
  categorias <@ array['fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro']::text[]
);
delete from supabase_migrations.schema_migrations where version = '20261023000215';
commit;
