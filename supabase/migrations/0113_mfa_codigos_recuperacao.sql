-- 2FA: códigos de recuperação de uso único + controle de tentativas/refazer (ordem 58901f0f + 10484c4c).
-- Só o servidor (service_role) lê e escreve: RLS ligada, sem política, sem permissão para anon/authenticated.
-- Guarda apenas HASH dos códigos (nunca o código). Sem dados pessoais além do id do usuário. Idempotente.

create table if not exists public.mfa_codigos_recuperacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, codigo_hash)
);
create index if not exists mfa_codigos_recuperacao_user_idx on public.mfa_codigos_recuperacao (user_id);

create table if not exists public.mfa_controle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  falhas int not null default 0,
  bloqueado_ate timestamptz,
  refazer_hash text,
  refazer_expira timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.mfa_codigos_recuperacao enable row level security;
alter table public.mfa_controle enable row level security;
revoke all on public.mfa_codigos_recuperacao from anon, authenticated;
revoke all on public.mfa_controle from anon, authenticated;

comment on table public.mfa_codigos_recuperacao is 'Hash de códigos de recuperação do 2FA (uso único). Só service_role.';
comment on table public.mfa_controle is 'Tentativas de recuperação do 2FA e código de e-mail para refazer. Só service_role.';
