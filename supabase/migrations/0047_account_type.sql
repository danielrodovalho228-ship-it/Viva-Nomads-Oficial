-- ESCADA DE PLANOS — Gestor por ELEGIBILIDADE (não de prateleira).
--
-- O plano Gestor não é auto-serviço: só entra para quem é elegível — conta do
-- tipo 'gestor' (administradora, marcada por admin) OU 5+ imóveis com
-- documentação APROVADA. Aqui persistimos o tipo de conta e AUDITAMOS toda
-- mudança (quem mudou, de quê para quê, quando e por quê) — decisão sensível
-- de acesso comercial.

alter table public.profiles
  add column if not exists account_type text not null default 'individual'
    check (account_type in ('individual', 'gestor'));

-- Trilha de auditoria das mudanças de tipo de conta (só admin escreve/lê).
create table if not exists public.account_type_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  old_type text,
  new_type text not null,
  changed_by uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.account_type_audit enable row level security;

-- Só admin lê a trilha (is_admin() já existe — 0011). A escrita é feita por
-- server action com service role (admin client), então não abrimos INSERT via RLS.
drop policy if exists "admin lê auditoria de conta" on public.account_type_audit;
create policy "admin lê auditoria de conta" on public.account_type_audit
  for select using (public.is_admin());

create index if not exists account_type_audit_profile_idx
  on public.account_type_audit (profile_id, created_at desc);
