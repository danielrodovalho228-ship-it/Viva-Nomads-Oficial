-- Viva Nomads — aplicar 0311 (E641: cobrança mensal de contratos longos, atrás da chave COBRANCA_MENSAL_ATIVA desligada). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0311_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.cobranca_mensal_parcelas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  numero int not null check (numero >= 1),
  vence_em date not null,
  tipo text not null check (tipo in ('mensal', 'prorata_final')),
  dias int check (dias is null or dias between 1 and 29),
  adiantada boolean not null default false,
  valor numeric(12, 2) not null check (valor > 0),
  taxa_viva numeric(12, 2) not null check (taxa_viva >= 0),
  estado_livro text check (estado_livro is null or estado_livro in ('registrado_morador', 'aguardando_confirmacao', 'confirmado_dono')),
  registrado_em timestamptz,
  confirmado_em timestamptz,
  lembrou_d5_em timestamptz,
  lembrou_d3_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint cobranca_mensal_parcelas_unica unique (contrato_id, numero),
  constraint cobranca_mensal_parcelas_livro_coerente check (
    (estado_livro is null) = (registrado_em is null) and (estado_livro = 'confirmado_dono') = (confirmado_em is not null)
  )
);
create index if not exists cobranca_mensal_parcelas_vencimento_idx on public.cobranca_mensal_parcelas (vence_em) where estado_livro is null;

alter table public.cobranca_mensal_parcelas enable row level security;
revoke all on public.cobranca_mensal_parcelas from anon, authenticated;
grant select on public.cobranca_mensal_parcelas to authenticated;
drop policy if exists "cobranca_mensal_parcelas: as partes leem" on public.cobranca_mensal_parcelas;
create policy "cobranca_mensal_parcelas: as partes leem" on public.cobranca_mensal_parcelas for select to authenticated using (public.pode_ver_contrato(contrato_id));
comment on table public.cobranca_mensal_parcelas is 'E641: cronograma mensal e livro de pagamentos (registrado pelo morador / aguardando confirmação / confirmado pelo dono). Sem registro = não registrado, nunca "não pago". Só o servidor grava. Atrás da chave COBRANCA_MENSAL_ATIVA.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000311', '0311_cobranca_mensal_e641', array['-- conteúdo em supabase/migrations/0311_cobranca_mensal_e641.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000311');

commit;
