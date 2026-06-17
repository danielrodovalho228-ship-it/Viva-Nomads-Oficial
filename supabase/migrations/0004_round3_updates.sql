-- ─────────────────────────────────────────────────────────────
-- Rodada 3 — consumo, nota fiscal, acesso mútuo/LGPD, LinkedIn, avaliações
-- ─────────────────────────────────────────────────────────────

create type utilities_mode as enum ('fixed', 'real');

-- Atualização 6 — despesas de consumo
-- Atualização 7 — nota fiscal · Atualização 10 — seguro/avaliação
-- Atualização 9 — endereço exato (restrito) vs região aproximada (público)
alter table properties
  add column utilities_mode utilities_mode default 'fixed',
  add column utilities_estimate numeric(10, 2) default 0,
  add column utilities_overage_margin int default 20,
  add column issues_invoice boolean default false,
  add column accepts_insurance boolean default false,
  add column exact_address text,            -- restrito (RLS)
  add column approximate_area text,         -- público
  add column rating numeric(2, 1) default 0,
  add column review_count int default 0;

-- Atualização 6 — cobrança complementar de consumo (registrada, não intermediada)
create table utility_extra_charges (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts (id) on delete cascade,
  amount numeric(10, 2) not null,
  reference_month date,
  receipt_url text,                         -- comprovante
  created_at timestamptz not null default now()
);

-- Atualização 8 — LinkedIn manual + categoria profissional do inquilino
alter table profiles
  add column linkedin_url text,
  add column professional_category text;

-- Atualização 9 — laudo CAF: expor só semáforo + categorias; liberar contato após aceite
alter table tenant_verifications
  add column risk_categories text[];

alter table leads
  add column contact_unlocked boolean not null default false;

-- Atualização 10 — avaliação mútua pós-locação
create table reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  target_id uuid not null references profiles (id) on delete cascade,
  target_role text not null,                -- 'owner' | 'tenant' | 'property'
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table utility_extra_charges enable row level security;
alter table reviews enable row level security;

-- Avaliações são públicas para leitura; escrita só pelo autor.
create policy "avaliações públicas" on reviews for select using (true);
create policy "autor cria avaliação" on reviews
  for insert with check (author_id = auth.uid());

-- Cobranças de consumo: visíveis às partes do contrato.
create policy "cobranças do contrato" on utility_extra_charges
  for select using (
    exists (
      select 1 from contracts c
      where c.id = contract_id and (c.owner_id = auth.uid() or c.tenant_id = auth.uid())
    )
  );
