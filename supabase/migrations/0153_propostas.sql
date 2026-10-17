-- 0153: orçamentos de verdade (prompt 17) — proposta, contraproposta, aceite/recusa e virada para o fechamento.
-- Tudo aditivo. A tabela `documents` (0008) guarda só o PDF/contrato em texto livre (nome e contato digitados,
-- sem versão estruturada); aqui cada proposta nasce de uma candidatura real (`leads`) e cada rodada é uma versão
-- com os valores. A NUMERAÇÃO é a da 0008 (`next_document_number('orcamento', ano)` → ORC-AAAA-NNNN).
--
-- 1) propostas: uma negociação por candidatura (no máximo uma aberta), status, validade, taxa congelada no aceite.
-- 2) proposta_versoes: até 3 versões (rodadas) por proposta, com quem propôs e os valores de cada uma.
-- 3) messages.proposta_id: o cartão da proposta na conversa. Só o servidor preenche.
-- Leitura: só o proprietário e o interessado daquela proposta. Escrita: só o servidor (service role).

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  lead_id uuid not null references public.leads (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'enviada',
  versao_atual integer not null default 1,
  validade_dias integer not null,
  valida_ate timestamptz not null,
  visto_em timestamptz,
  recusada_por text,
  recusa_motivo text,
  recusa_texto text,
  taxa_congelada numeric(5, 4),
  aceita_em timestamptz,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  constraint propostas_status_valido check (status in ('enviada', 'vista', 'contraproposta', 'aceita', 'recusada', 'expirada', 'em_contrato', 'contrato_assinado')),
  constraint propostas_versao_valida check (versao_atual between 1 and 3),
  constraint propostas_validade_valida check (validade_dias in (3, 7, 15)),
  constraint propostas_recusa_valida check (
    (recusada_por is null or recusada_por in ('owner', 'tenant'))
    and (recusa_motivo is null or recusa_motivo in ('valor', 'datas', 'outro_imovel', 'outro'))
    and (recusa_texto is null or char_length(recusa_texto) <= 500)
  ),
  constraint propostas_taxa_valida check (taxa_congelada is null or (taxa_congelada >= 0 and taxa_congelada < 1))
);

-- No máximo UMA proposta em andamento por candidatura.
create unique index if not exists propostas_uma_aberta_por_lead
  on public.propostas (lead_id) where status in ('enviada', 'vista', 'contraproposta');
create index if not exists propostas_owner_idx on public.propostas (owner_id, criada_em desc);
create index if not exists propostas_tenant_idx on public.propostas (tenant_id, criada_em desc);
create index if not exists propostas_property_idx on public.propostas (property_id);
create index if not exists propostas_abertas_validade_idx on public.propostas (valida_ate) where status in ('enviada', 'vista', 'contraproposta');

create table if not exists public.proposta_versoes (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas (id) on delete cascade,
  versao integer not null,
  autor text not null,
  valor_base numeric(12, 2) not null,
  desconto_pct numeric(5, 2) not null default 0,
  desconto_valor numeric(12, 2) not null default 0,
  motivo_desconto text,
  desconto_estadia_pct numeric(5, 2) not null default 0,
  valor_mensal numeric(12, 2) not null,
  meses integer not null,
  data_entrada date not null,
  condominio numeric(12, 2) not null default 0,
  consumo numeric(12, 2) not null default 0,
  limpezas_mes integer not null default 0,
  valor_limpeza numeric(12, 2) not null default 0,
  taxa_pet numeric(12, 2) not null default 0,
  limpeza_unica numeric(12, 2) not null default 0,
  pessoas integer,
  total_mensal numeric(12, 2) not null,
  total_contrato numeric(12, 2) not null,
  mensagem text,
  criada_em timestamptz not null default now(),
  constraint proposta_versoes_unica unique (proposta_id, versao),
  constraint proposta_versoes_valores check (
    versao between 1 and 3
    and autor in ('owner', 'tenant')
    and valor_base > 0 and valor_mensal > 0
    and meses between 1 and 6
    and desconto_pct between 0 and 30 and desconto_estadia_pct between 0 and 30 and desconto_valor >= 0
    and limpezas_mes between 0 and 8
    and condominio >= 0 and consumo >= 0 and valor_limpeza >= 0 and taxa_pet >= 0 and limpeza_unica >= 0
    and (mensagem is null or char_length(mensagem) <= 500)
    and (motivo_desconto is null or char_length(motivo_desconto) <= 80)
    and (pessoas is null or pessoas between 1 and 20)
  )
);
create index if not exists proposta_versoes_proposta_idx on public.proposta_versoes (proposta_id, versao);

alter table public.propostas enable row level security;
alter table public.proposta_versoes enable row level security;
revoke all on public.propostas from anon;
revoke all on public.proposta_versoes from anon;
revoke insert, update, delete on public.propostas from authenticated;
revoke insert, update, delete on public.proposta_versoes from authenticated;
grant select on public.propostas to authenticated;
grant select on public.proposta_versoes to authenticated;
grant all on public.propostas to service_role;
grant all on public.proposta_versoes to service_role;

drop policy if exists propostas_das_partes on public.propostas;
create policy propostas_das_partes on public.propostas
  for select to authenticated
  using (owner_id = (select auth.uid()) or tenant_id = (select auth.uid()));

drop policy if exists proposta_versoes_das_partes on public.proposta_versoes;
create policy proposta_versoes_das_partes on public.proposta_versoes
  for select to authenticated
  using (exists (
    select 1 from public.propostas p
    where p.id = proposta_id and (p.owner_id = (select auth.uid()) or p.tenant_id = (select auth.uid()))
  ));

-- 3) Cartão da proposta na conversa.
alter table public.messages add column if not exists proposta_id uuid references public.propostas (id) on delete set null;
create index if not exists idx_messages_proposta_id on public.messages (proposta_id) where proposta_id is not null;

-- Só o servidor liga uma mensagem a uma proposta (ninguém forja um cartão).
create or replace function public.messages_proposta_so_servidor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.proposta_id is not null and coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.proposta_id := null;
    else
      new.proposta_id := old.proposta_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists messages_proposta_so_servidor on public.messages;
create trigger messages_proposta_so_servidor
  before insert or update of proposta_id on public.messages
  for each row execute function public.messages_proposta_so_servidor();
revoke execute on function public.messages_proposta_so_servidor() from public, anon, authenticated;
