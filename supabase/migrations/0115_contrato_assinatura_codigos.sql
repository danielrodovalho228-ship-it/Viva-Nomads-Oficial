-- Assinatura de contrato: código de uso único enviado por e-mail, conferido no SERVIDOR (ordens 810ffe98 / 0a097187).
-- Só service_role lê e escreve: RLS ligada, sem política, sem permissão para anon/authenticated.
-- Guarda apenas o HASH do código (nunca o código). Uma linha por contrato+pessoa. Idempotente.

create table if not exists public.contrato_assinatura_codigos (
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  expira_em timestamptz not null,
  falhas int not null default 0,
  usado_em timestamptz,
  enviado_em timestamptz not null default now(),
  primary key (contrato_id, user_id)
);

alter table public.contrato_assinatura_codigos enable row level security;
revoke all on public.contrato_assinatura_codigos from anon, authenticated;

comment on table public.contrato_assinatura_codigos is 'Hash do código de e-mail para assinar contrato (uso único, expira, limite de falhas). Só service_role.';
