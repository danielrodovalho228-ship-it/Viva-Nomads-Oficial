-- Contatos do formulário /empresas (ordem cdef67f8 item 3): guarda o lead no banco além do e-mail.
-- RLS ligada: só admin lê (política de select); ninguém escreve pelo cliente — a rota grava com service_role.
-- Guarda só o que a pessoa digitou no formulário comercial (nome, empresa, e-mail, volume, mensagem). Idempotente.

create table if not exists public.leads_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 200),
  empresa text not null check (char_length(empresa) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  volume_ano text check (volume_ano is null or char_length(volume_ano) <= 100),
  mensagem text check (mensagem is null or char_length(mensagem) <= 2000),
  criado_em timestamptz not null default now()
);
create index if not exists leads_empresas_criado_idx on public.leads_empresas (criado_em desc);

alter table public.leads_empresas enable row level security;
revoke all on public.leads_empresas from anon, authenticated;
grant select on public.leads_empresas to authenticated;

drop policy if exists leads_empresas_admin_select on public.leads_empresas;
create policy leads_empresas_admin_select on public.leads_empresas
  for select to authenticated using (public.is_admin());

comment on table public.leads_empresas is 'Contatos comerciais do formulário /empresas. Só admin lê; a rota grava com service_role.';
