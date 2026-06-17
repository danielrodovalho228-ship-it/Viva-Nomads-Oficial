-- ─────────────────────────────────────────────────────────────
-- Rodada 2 — PF/PJ + tributação, verificação reutilizável e indicações
-- ─────────────────────────────────────────────────────────────

create type person_type as enum ('pf', 'pj');

-- Atualização 2 — tipo de pessoa e dados fiscais do proprietário
alter table profiles
  add column person_type person_type default 'pf',
  add column cpf text,
  add column cnpj text,
  add column company_name text,
  add column needs_nfse boolean default false; -- emite NFS-e c/ CBS/IBS (a partir de ago/2026)

-- Atualização 3 — indicação
alter table profiles
  add column referral_code text unique,
  add column referred_by uuid references profiles (id);

-- Atualização 4.1 — verificação reutilizável (Inquilino Verificado)
alter table tenant_verifications
  add column is_reusable boolean default true,
  add column valid_until timestamptz;

-- Programa de indicação
create type referral_status as enum ('pending', 'qualified', 'rewarded');
create type qualifying_event as enum ('first_booking', 'first_lease');

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  referred_id uuid not null references profiles (id) on delete cascade,
  referred_role text not null, -- 'owner' | 'tenant'
  status referral_status not null default 'pending',
  reward_type text,
  reward_value numeric(10, 2),
  qualifying_event qualifying_event,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);

create table referral_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  amount numeric(10, 2) not null,
  type text not null, -- 'commission_discount' | 'service_credit'
  used boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table referrals enable row level security;
alter table referral_credits enable row level security;

create policy "indicações do usuário" on referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid());

create policy "créditos do usuário" on referral_credits
  for select using (user_id = auth.uid());
