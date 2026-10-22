-- Viva Nomads — rollback da 0210 (Prompt 59: padrão mínimo de conforto + prazo de solução). Idempotente.
-- Apaga as declarações, prazos, pendências e a seção da conferência; tira as colunas novas de service_orders e volta os
-- tipos do histórico da manutenção. As linhas do histórico com tipos novos são apagadas antes (senão a trava antiga recusa).
begin;
set local lock_timeout = '5s';
do $cron$
begin
  perform cron.unschedule('prazos-conforto') where exists (select 1 from cron.job where jobname = 'prazos-conforto');
exception when others then
  raise notice 'pg_cron indisponível (%).', sqlerrm;
end $cron$;
drop function if exists public.prazos_conforto_tique();
drop trigger if exists trg_properties_exige_conforto on public.properties;
drop function if exists public.properties_exige_conforto();
drop trigger if exists trg_service_orders_protege_prazos on public.service_orders;
drop function if exists public.service_orders_protege_prazos();
drop table if exists public.conforto_pendencias;
drop table if exists public.conferencia_conforto;
drop function if exists public.conferencia_conforto_trava();
drop table if exists public.conforto_adequacao;
drop function if exists public.conforto_completo(uuid);
drop table if exists public.conforto_declaracoes;
drop function if exists public.conforto_chaves();
delete from public.service_order_eventos where tipo not in ('aberto', 'status') or papel not in ('inquilino', 'proprietario', 'sistema');
alter table public.service_order_eventos drop constraint if exists service_order_eventos_tipo_check;
alter table public.service_order_eventos add constraint service_order_eventos_tipo_check check (tipo in ('aberto', 'status'));
alter table public.service_order_eventos drop constraint if exists service_order_eventos_papel_check;
alter table public.service_order_eventos add constraint service_order_eventos_papel_check check (papel in ('inquilino', 'proprietario', 'sistema'));
alter table public.service_orders drop column if exists reclassificacao_pedida_em;
alter table public.service_orders drop column if exists reclassificacao_motivo;
alter table public.service_orders drop column if exists prioridade_original;
alter table public.service_orders drop column if exists reclassificada_em;
alter table public.service_orders drop column if exists reclassificada_por;
alter table public.service_orders drop column if exists reaberta_em;
alter table public.service_orders drop column if exists solucao_confirmada_em;
alter table public.service_orders drop column if exists solucao_marcada_em;
alter table public.service_orders drop column if exists provisoria_em;
delete from supabase_migrations.schema_migrations where version = '20261022000210';
commit;
