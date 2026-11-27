-- Viva Nomads — aplicar 0359 (E1142: registo da proposta de avaliação que venceu sem o aceite). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0359_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.vistoria_designacoes add column if not exists proposta_expirada_em timestamptz;

comment on column public.vistoria_designacoes.proposta_expirada_em is
  'Quando o prazo do dono para aceitar a proposta acabou sem o aceite. Nulo nas outras designações.';

insert into supabase_migrations.schema_migrations (version, name)
select '20261124000359', '0359_vistoria_designacao_proposta_expirada_e1142'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261124000359');
commit;
