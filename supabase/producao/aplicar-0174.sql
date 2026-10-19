-- Viva Nomads — 0174: serviços para o morador (ordem 521c5af7, telas S1–S3). Idempotente.
-- Rollback: supabase/producao/rollback/0174_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

alter table public.servicos_adicionais add column if not exists preco_texto text
  check (preco_texto is null or char_length(preco_texto) <= 120);

create table if not exists public.servicos_pedidos (
  id uuid primary key default gen_random_uuid(),
  servico_id text not null references public.servicos_adicionais (id),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  data_desejada date not null,
  faixa text not null check (faixa in ('manha', 'tarde', 'noite')),
  observacao text check (observacao is null or char_length(observacao) <= 300),
  prestador_nome text not null,
  preco_texto text,
  status text not null default 'enviado' check (status in ('enviado', 'confirmado', 'feito', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists servicos_pedidos_tenant_idx on public.servicos_pedidos (tenant_id, criado_em desc);
create index if not exists servicos_pedidos_status_idx on public.servicos_pedidos (status, criado_em desc);

alter table public.servicos_pedidos enable row level security;
revoke all on public.servicos_pedidos from anon, authenticated;
grant select on public.servicos_pedidos to authenticated;
grant all on public.servicos_pedidos to service_role;

drop policy if exists servicos_pedidos_ler on public.servicos_pedidos;
create policy servicos_pedidos_ler on public.servicos_pedidos
  for select to authenticated
  using (tenant_id = (select auth.uid()) or (select public.is_admin()));

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000174', '0174_servicos_pedidos',
       array['-- conteúdo em supabase/migrations/0174_servicos_pedidos.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000174');
commit;
