-- ─────────────────────────────────────────────────────────────
-- Rodada 4 — APIs: subcontas Asaas e emissão de NFS-e
-- ─────────────────────────────────────────────────────────────

-- Subconta Asaas por proprietário (walletId p/ split + apiKey criptografada)
alter table payment_accounts
  add column asaas_wallet_id text,
  add column asaas_subaccount_apikey text; -- armazenar criptografada

-- NFS-e (LC 214/2025): receitas da plataforma e, futuramente, aluguel do PJ
create type invoice_type as enum ('platform', 'rent');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  type invoice_type not null default 'platform',
  reference_id text,                 -- id da transação/assinatura/serviço
  owner_id uuid references profiles (id) on delete set null,
  provider text,                     -- 'focus' | 'plugnotas' | 'brasilnfe'
  nfse_id text,
  amount numeric(10, 2),
  status text default 'processing',
  pdf_url text,
  created_at timestamptz not null default now()
);

alter table invoices enable row level security;

-- Proprietário vê as próprias NFs; NFs da plataforma ficam restritas ao backend.
create policy "notas do proprietário" on invoices
  for select using (owner_id = auth.uid());
