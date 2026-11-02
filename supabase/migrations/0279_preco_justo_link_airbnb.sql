-- 0279 — E399-C, pacote 1 (liberado pelo Daniel em 01/11): o link do anúncio no Airbnb, para o selo "Preço justo".
-- Guarda SÓ o número do anúncio (a chave do fornecedor, desenho do E293); o link colado nunca é gravado e nunca aparece
-- em público. Tabela fechada: só o servidor (cliente de serviço) lê e grava, depois de conferir que quem pede é o dono.
-- Trava antifraude: cidade e quartos do anúncio × imóvel da Viva ("confere" | "diverge"); divergência bloqueia o selo e
-- entra na Central de Pendências. Sai junto com o anúncio (on delete cascade). Idempotente.
-- Rollback: supabase/producao/rollback/0279_rollback.sql.

create table if not exists public.preco_justo_airbnb (
  property_id uuid primary key references public.properties(id) on delete cascade,
  airbnb_id text not null check (airbnb_id ~ '^[0-9]{3,20}$'),
  informado_em timestamptz not null default now(),
  conferencia text not null default 'pendente' check (conferencia in ('pendente', 'confere', 'diverge')),
  divergencias text[] not null default '{}',
  conferido_em timestamptz,
  fonte text not null default 'simulada',
  atualizado_em timestamptz not null default now()
);

comment on table public.preco_justo_airbnb is
  'E399-C: número do anúncio no Airbnb (nunca o link) e a conferência antifraude (cidade e quartos). Só o servidor lê.';

alter table public.preco_justo_airbnb enable row level security;
revoke all on public.preco_justo_airbnb from anon, authenticated;

create index if not exists preco_justo_airbnb_diverge_idx on public.preco_justo_airbnb (conferido_em) where conferencia = 'diverge';
