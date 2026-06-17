-- ─────────────────────────────────────────────────────────────
-- Rodada 5 — taxa de limpeza/preparação e ordens de serviço
-- ─────────────────────────────────────────────────────────────

-- Bloco B — taxa de preparação/limpeza
alter table properties
  add column prep_fee numeric(10, 2) default 0,            -- preparação (única, obrigatória)
  add column checkout_cleaning_enabled boolean default false,
  add column checkout_cleaning_fee numeric(10, 2) default 0;

-- Bloco C — ordens de serviço
create type so_category as enum
  ('hidraulica', 'eletrica', 'eletrodomesticos', 'estrutura', 'internet', 'outros');
create type so_priority as enum ('baixa', 'media', 'urgente');
create type so_status as enum ('aberto', 'visto', 'em_andamento', 'resolvido');

create table service_orders (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts (id) on delete set null,
  property_id uuid not null references properties (id) on delete cascade,
  tenant_id uuid not null references profiles (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,
  category so_category not null,
  priority so_priority not null default 'media',
  description text not null,
  photo_url text,
  status so_status not null default 'aberto',
  opened_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz
);

create table service_order_messages (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table service_orders enable row level security;
alter table service_order_messages enable row level security;

-- Inquilino vê os próprios chamados; proprietário vê os dos seus imóveis.
create policy "chamados das partes" on service_orders
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
create policy "inquilino abre chamado" on service_orders
  for insert with check (tenant_id = auth.uid());
create policy "proprietário atualiza status" on service_orders
  for update using (owner_id = auth.uid());

create policy "mensagens do chamado" on service_order_messages
  for select using (
    exists (
      select 1 from service_orders s
      where s.id = service_order_id and (s.tenant_id = auth.uid() or s.owner_id = auth.uid())
    )
  );

-- Métricas do selo "Proprietário Responsivo" (tempo de resposta/resolução).
create view owner_response_metrics as
select
  owner_id,
  avg(extract(epoch from (first_response_at - opened_at)) / 3600)
    filter (where first_response_at is not null) as avg_first_response_hours,
  avg(extract(epoch from (resolved_at - opened_at)) / 3600)
    filter (where resolved_at is not null) as avg_resolution_hours
from service_orders
group by owner_id;
