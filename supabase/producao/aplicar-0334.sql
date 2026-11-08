-- Viva Nomads — aplicar 0334 (E722: pré-aceitação de 72 horas em propostas). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0334_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.propostas add column if not exists pre_aceitacao_ate timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_reaberturas smallint not null default 0;
alter table public.propostas add column if not exists pre_aceitacao_lembrete_24h_em timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_lembrete_6h_em timestamptz;
alter table public.propostas add column if not exists pre_aceitacao_expirou_em timestamptz;
alter table public.propostas drop constraint if exists propostas_pre_aceitacao_reaberturas_valida;
alter table public.propostas add constraint propostas_pre_aceitacao_reaberturas_valida check (pre_aceitacao_reaberturas between 0 and 2);
create index if not exists propostas_pre_aceitacao_idx on public.propostas (pre_aceitacao_ate) where status = 'aceita' and pre_aceitacao_ate is not null;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000334', '0334_propostas_pre_aceitacao_e722', array['-- conteúdo em supabase/migrations/0334_propostas_pre_aceitacao_e722.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000334');
commit;
