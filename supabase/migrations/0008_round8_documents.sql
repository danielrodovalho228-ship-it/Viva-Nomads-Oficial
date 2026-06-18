-- ─────────────────────────────────────────────────────────────
-- Rodada 8 — fluxo Orçamento → Fechamento → Contrato
-- Documentos numerados, versionados e rastreáveis.
-- ─────────────────────────────────────────────────────────────

create type doc_type as enum ('orcamento', 'contrato');
create type doc_status as enum
  ('rascunho', 'enviado', 'visto', 'recusado', 'aceito', 'assinado', 'expirado');
create type line_item_payer as enum ('owner', 'tenant');

-- Sequência por ano para numeração ORC/CTR-AAAA-NNNN.
create table document_counters (
  year int not null,
  doc_type doc_type not null,
  last_seq int not null default 0,
  primary key (year, doc_type)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  doc_number text not null unique,              -- ORC/CTR-AAAA-NNNN
  doc_type doc_type not null,
  version int not null default 1,
  property_id uuid references properties (id) on delete set null,
  owner_id uuid not null references profiles (id) on delete cascade,
  tenant_id uuid references profiles (id) on delete set null,
  tenant_name text not null,
  tenant_contact text,                          -- e-mail/telefone (sem cadastro)
  status doc_status not null default 'rascunho',
  total_value numeric(10, 2) not null default 0,
  valid_until date,                             -- prazo de validade do orçamento
  parent_document_id uuid references documents (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  signed_at timestamptz
);

create index documents_owner_idx on documents (owner_id, created_at desc);

create table document_line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  item_key text not null,                       -- aluguel | consumo | preparacao | comissao | garantia
  label text not null,
  amount numeric(10, 2) not null default 0,
  payer line_item_payer not null default 'tenant',
  recurring boolean not null default true,      -- mensal vs. cobrança única
  editable boolean not null default true,
  position int not null default 0
);

alter table documents enable row level security;
alter table document_line_items enable row level security;

-- Proprietário gerencia seus documentos; inquilino vê os endereçados a ele.
create policy "documentos do proprietário" on documents
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "inquilino vê o documento" on documents
  for select using (tenant_id = auth.uid());

create policy "itens seguem o documento" on document_line_items
  for all using (
    exists (
      select 1 from documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

-- Gera o próximo número sequencial do ano de forma atômica.
create or replace function next_document_number(p_type doc_type, p_year int)
returns text
language plpgsql
as $$
declare
  v_seq int;
  v_prefix text;
begin
  insert into document_counters (year, doc_type, last_seq)
  values (p_year, p_type, 1)
  on conflict (year, doc_type)
  do update set last_seq = document_counters.last_seq + 1
  returning last_seq into v_seq;

  v_prefix := case when p_type = 'orcamento' then 'ORC' else 'CTR' end;
  return v_prefix || '-' || p_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
