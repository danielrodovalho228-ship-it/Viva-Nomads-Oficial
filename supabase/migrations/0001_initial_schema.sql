-- ─────────────────────────────────────────────────────────────
-- Viva Nomads — esquema inicial (seções 6 e 9 do documento mestre)
-- Postgres / Supabase. Aplicar com: supabase db push
-- ─────────────────────────────────────────────────────────────

create type user_role as enum ('owner', 'tenant', 'admin');
create type property_status as enum ('draft', 'active', 'paused');
create type condo_allows as enum ('yes', 'no', 'unknown');
create type checklist_status as enum ('pending', 'approved', 'not_eligible');
create type workspace_type as enum ('coworking', 'meeting_room', 'cafe');
create type plan_type as enum ('free', 'essential', 'pro');
create type guarantee_type as enum ('seguro_fianca', 'caucao', 'titulo_cap');
create type traffic_light as enum ('green', 'yellow', 'red');

-- Perfis (1:1 com auth.users)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role user_role not null default 'tenant',
  verification_progress int not null default 0 check (verification_progress between 0 and 100),
  created_at timestamptz not null default now()
);

-- Imóveis
create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  property_type text,
  address text,
  city text not null,
  state text,
  lat double precision,
  lng double precision,
  bedrooms int default 0,
  bathrooms int default 0,
  area_m2 int default 0,
  min_period_days int not null default 30,
  monthly_price numeric(10, 2) not null,
  status property_status not null default 'draft',
  work_ready_badge boolean not null default false, -- selo Pronto para Trabalho
  work_score int not null default 0 check (work_score between 0 and 100),
  created_at timestamptz not null default now()
);

-- Checklist de qualificação (Fase 4)
create table qualification_checklists (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,
  -- Camada 1 (elegibilidade)
  furnished boolean default false,
  accepts_30days boolean default false,
  iptu_ok boolean default false,
  habitable boolean default false,
  is_owner_or_agent boolean default false,
  condo_allows condo_allows default 'unknown',
  eligible boolean default false,
  -- Camada 2 (pontuação)
  has_home_office boolean default false,
  has_desk boolean default false,
  has_chair boolean default false,
  internet_mbps int default 0,
  coworking_2km boolean default false,
  meeting_room boolean default false,
  cafe_1km boolean default false,
  washer boolean default false,
  full_kitchen boolean default false,
  ac_bedrooms boolean default false,
  pets_ok boolean default false,
  work_score int default 0,
  status checklist_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table property_workspaces (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  name text not null,
  type workspace_type not null,
  lat double precision,
  lng double precision,
  distance_m int
);

create table property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  url text not null,
  sort_order int default 0
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references profiles (id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tenant_id, property_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid not null references profiles (id) on delete cascade,
  receiver_id uuid not null references profiles (id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  tenant_id uuid not null references profiles (id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan plan_type not null default 'free',
  status text,
  current_period_end timestamptz
);

-- ── Estrutura preparada para split/garantia/contrato (seção 9) ──

create table payment_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  gateway text not null, -- 'asaas' | 'pagarme'
  gateway_account_id text,
  status text
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,
  tenant_id uuid not null references profiles (id) on delete cascade,
  start_date date,
  end_date date,
  monthly_rent numeric(10, 2),
  term_months int,
  guarantee_id uuid,
  zapsign_doc_id text,
  status text default 'draft',
  cost_split jsonb, -- {agua,luz,condominio,iptu -> 'owner'|'tenant'}
  created_at timestamptz not null default now()
);

create table guarantees (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts (id) on delete cascade,
  type guarantee_type not null,
  value numeric(10, 2),
  insurer text,
  status text
);

create table insurance_quotes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts (id) on delete cascade,
  insurer text, -- 'porto' | 'junto'
  quote_value numeric(10, 2),
  coverage text,
  status text
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts (id) on delete set null,
  property_id uuid references properties (id) on delete set null,
  owner_id uuid references profiles (id) on delete set null,
  tenant_id uuid references profiles (id) on delete set null,
  gross_amount numeric(10, 2),
  platform_commission numeric(10, 2),
  owner_net numeric(10, 2),
  gateway_tx_id text,
  status text,
  created_at timestamptz not null default now()
);

create table tenant_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references profiles (id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  caf_result jsonb,
  traffic_light traffic_light,
  created_at timestamptz not null default now()
);

-- ── Row Level Security ──
alter table profiles enable row level security;
alter table properties enable row level security;
alter table qualification_checklists enable row level security;
alter table property_workspaces enable row level security;
alter table property_photos enable row level security;
alter table favorites enable row level security;
alter table messages enable row level security;
alter table leads enable row level security;
alter table subscriptions enable row level security;
alter table payment_accounts enable row level security;
alter table contracts enable row level security;
alter table guarantees enable row level security;
alter table insurance_quotes enable row level security;
alter table transactions enable row level security;
alter table tenant_verifications enable row level security;

-- Perfil próprio
create policy "perfil próprio" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Imóveis: leitura pública dos ativos; escrita só do dono
create policy "imóveis ativos são públicos" on properties
  for select using (status = 'active' or owner_id = auth.uid());
create policy "dono gerencia seus imóveis" on properties
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Checklist: só o dono
create policy "dono gerencia seus checklists" on qualification_checklists
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Favoritos: só o inquilino dono
create policy "inquilino gerencia favoritos" on favorites
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- Mensagens: remetente ou destinatário
create policy "mensagens das partes" on messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "enviar mensagem" on messages
  for insert with check (sender_id = auth.uid());

-- Leads: dono do imóvel ou inquilino
create policy "leads das partes" on leads
  for select using (owner_id = auth.uid() or tenant_id = auth.uid());

-- Assinatura: só o dono
create policy "assinatura do dono" on subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
