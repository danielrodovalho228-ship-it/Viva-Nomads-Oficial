-- Viva Nomads — aplicar 0362 (E1177: a alternância de avaliadores sem beco). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0362_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.vistoria_pedidos
  add column if not exists motivo_da_espera text
  check (motivo_da_espera is null or motivo_da_espera in ('so_o_anterior', 'sem_avaliador_na_cidade', 'contestacao_sem_segundo', 'ja_escolhidos', 'independencia', 'indisponiveis', 'varios'));

comment on column public.vistoria_pedidos.motivo_da_espera is
  'E1177: por que o dono não tem lista comum para escolher. Nulo: há lista comum. so_o_anterior: só o avaliador da avaliação anterior.';

alter table public.vistoria_designacoes
  add column if not exists mesmo_da_anterior boolean not null default false;

comment on column public.vistoria_designacoes.mesmo_da_anterior is
  'E1177: o avaliador escolhido fez a avaliação anterior do imóvel e só pôde ser escolhido pela exceção da alternância.';

alter table public.vistoria_laudos
  add column if not exists mesmo_da_anterior boolean not null default false;

comment on column public.vistoria_laudos.mesmo_da_anterior is
  'E1177: laudo emitido pelo mesmo avaliador da avaliação anterior do imóvel, pela exceção da alternância.';

alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio', 'contestacao_sem_avaliador'));

insert into supabase_migrations.schema_migrations (version, name)
select '20261124000362', '0362_vistoria_alternancia_sem_beco_e1177'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261124000362');
commit;
