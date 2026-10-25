-- 0248 — Vínculo profissional por e-mail corporativo (ordem 9950ef15, item 2, parte 1).
-- Guarda o pedido de confirmação: só o NOME DO DOMÍNIO e o HASH do código de 6 dígitos (nunca o código nem o e-mail inteiro).
-- RLS ligada e nenhuma política: só o servidor (service role) lê e grava; o código nunca chega ao navegador.
create table if not exists public.vinculo_profissional (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dominio text not null check (dominio = lower(dominio) and dominio ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0 check (tentativas >= 0),
  confirmado_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table public.vinculo_profissional enable row level security;
revoke all on public.vinculo_profissional from anon, authenticated;

comment on table public.vinculo_profissional is
  'Vínculo profissional por e-mail corporativo: domínio + hash do código. Sem política de RLS: só o servidor acessa.';
