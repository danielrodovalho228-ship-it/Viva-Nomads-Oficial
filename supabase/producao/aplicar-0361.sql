-- Viva Nomads — aplicar 0361 (E1156: prazo do laudo combinado, em dias úteis depois da visita). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0361_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.vistoria_pedidos
  add column if not exists prazo_laudo_dias_uteis smallint
  check (prazo_laudo_dias_uteis is null or (prazo_laudo_dias_uteis between 1 and 5));

comment on column public.vistoria_pedidos.prazo_laudo_dias_uteis is
  'Prazo do laudo combinado com o avaliador, em dias úteis depois da visita (1 a 5). Nulo: vale o padrão de 2 dias úteis.';

insert into supabase_migrations.schema_migrations (version, name)
select '20261124000361', '0361_vistoria_prazo_do_laudo_combinado_e1156'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261124000361');
commit;
