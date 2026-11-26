-- Viva Nomads — aplicar 0360 (E1146: registo da proposta de avaliação descartada pelo dono). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0360_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.vistoria_designacoes add column if not exists proposta_descartada_em timestamptz;

comment on column public.vistoria_designacoes.proposta_descartada_em is
  'Quando o dono descartou o avaliador escolhido e a proposta dele. Nulo nas outras designações.';

insert into supabase_migrations.schema_migrations (version, name)
select '20261124000360', '0360_vistoria_designacao_proposta_descartada_e1146'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261124000360');
commit;
