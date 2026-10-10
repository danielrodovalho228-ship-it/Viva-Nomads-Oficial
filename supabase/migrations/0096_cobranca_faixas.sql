-- 0096 — COBRANÇA "PAGUE QUANDO ALUGAR" (ordens 07fb7229, 31e8d72c e 9106387a, parte 1). PRECISA APROVAÇÃO DO DANIEL.
--   • config_cobranca: chaves de configuração (assinatura_ativa=false, carência de 90 dias).
--   • faixas_comissao: 5 degraus (12/10/8/6/4%) sobre o PRIMEIRO aluguel, pelo nº de imóveis ativos.
--   • faixas_assinatura: Fase 2 (desligada pela flag).
--   • comissao_fixada_admin: taxa negociada fora do sistema, com motivo e validade obrigatórios (histórico, sem apagar).
--   • contratos ganha modelo_cobranca, taxa_aplicada, valor_comissao e faixa_no_fechamento (nulos nos antigos).
-- Sem dado pessoal. Quem já está em plano pago NÃO é migrado (grandfather). Só cria coisas novas; idempotente; sem DROP.

create table if not exists public.config_cobranca (
  chave text primary key check (char_length(chave) between 1 and 60),
  valor text not null check (char_length(valor) <= 200),
  atualizado_em timestamptz not null default now()
);
insert into public.config_cobranca (chave, valor) values
  ('assinatura_ativa', 'false'),
  ('carencia_assinatura_dias', '90')
on conflict (chave) do nothing;

create table if not exists public.faixas_comissao (
  min_imoveis int primary key check (min_imoveis >= 1),
  max_imoveis int check (max_imoveis is null or max_imoveis >= min_imoveis),
  taxa numeric(5,4) not null check (taxa >= 0 and taxa <= 1)
);
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values
  (1, 2, 0.12), (3, 5, 0.10), (6, 15, 0.08), (16, 30, 0.06), (31, null, 0.04)
on conflict (min_imoveis) do nothing;

create table if not exists public.faixas_assinatura (
  min_imoveis int primary key check (min_imoveis >= 1),
  max_imoveis int check (max_imoveis is null or max_imoveis >= min_imoveis),
  mensal numeric(10,2) not null check (mensal >= 0)
);
insert into public.faixas_assinatura (min_imoveis, max_imoveis, mensal) values
  (1, 2, 149), (3, 5, 299), (6, 10, 499), (11, 20, 799), (21, null, 999)
on conflict (min_imoveis) do nothing;

create table if not exists public.comissao_fixada_admin (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  taxa numeric(5,4) not null check (taxa >= 0 and taxa <= 1),
  motivo text not null check (char_length(btrim(motivo)) between 3 and 300),
  valido_ate timestamptz not null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists comissao_fixada_admin_owner on public.comissao_fixada_admin (owner_id, valido_ate desc);

alter table public.config_cobranca enable row level security;
alter table public.faixas_comissao enable row level security;
alter table public.faixas_assinatura enable row level security;
alter table public.comissao_fixada_admin enable row level security;
revoke all on public.config_cobranca, public.faixas_comissao, public.faixas_assinatura, public.comissao_fixada_admin from public, anon, authenticated;
grant select on public.faixas_comissao, public.faixas_assinatura to anon, authenticated;
grant select on public.config_cobranca, public.comissao_fixada_admin to authenticated;
grant all on public.config_cobranca, public.faixas_comissao, public.faixas_assinatura, public.comissao_fixada_admin to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='faixas_comissao' and policyname='faixas_comissao: leitura publica') then
    create policy "faixas_comissao: leitura publica" on public.faixas_comissao for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='faixas_assinatura' and policyname='faixas_assinatura: leitura publica') then
    create policy "faixas_assinatura: leitura publica" on public.faixas_assinatura for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='config_cobranca' and policyname='config_cobranca: admin le') then
    create policy "config_cobranca: admin le" on public.config_cobranca for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comissao_fixada_admin' and policyname='comissao_fixada_admin: admin le') then
    create policy "comissao_fixada_admin: admin le" on public.comissao_fixada_admin for select to authenticated using (public.is_admin());
  end if;
end;
$$;

alter table public.contratos add column if not exists modelo_cobranca text;
alter table public.contratos add column if not exists taxa_aplicada numeric(5,4);
alter table public.contratos add column if not exists valor_comissao numeric(12,2);
alter table public.contratos add column if not exists faixa_no_fechamento text;
