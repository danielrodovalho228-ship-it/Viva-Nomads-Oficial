-- 0251 — QA-LOGIN-B: registro das entradas diretas da QA em contas de teste (/api/qa/entrar).
-- Guarda o horário, a conta e o HASH do IP. Nunca a chave da QA nem o e-mail. Idempotente.
create table if not exists public.qa_entradas (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash text not null check (length(ip_hash) <= 64),
  conta_criada boolean not null default false
);
create index if not exists qa_entradas_criado_idx on public.qa_entradas (criado_em);
create index if not exists qa_entradas_usuario_idx on public.qa_entradas (usuario_id, criado_em);

-- RLS ligada e SEM política: só o servidor (service role) grava e lê.
alter table public.qa_entradas enable row level security;
revoke all on public.qa_entradas from anon, authenticated;
grant select, insert, delete on public.qa_entradas to service_role;
