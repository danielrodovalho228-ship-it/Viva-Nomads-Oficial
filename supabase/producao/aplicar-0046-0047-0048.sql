-- ════════════════════════════════════════════════════════════════════════
-- MIGRAÇÕES QUE FALTAM EM PRODUÇÃO — Viva Nomads (projeto esezeutgtycekfosxplk)
-- Cole TUDO no SQL Editor do Supabase e rode. Seguro e idempotente.
-- 0042/0044 (moderação) JÁ estão aplicadas — não entram aqui.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────── 0046 — aceite persistido da candidatura ───────────
alter table public.leads
  add column if not exists accepted_at              timestamptz,
  add column if not exists rejected_at              timestamptz,
  add column if not exists reject_reason            text,
  add column if not exists decided_by               uuid references public.profiles (id),
  add column if not exists accepted_plan            text,
  add column if not exists accepted_commission_rate numeric(5, 4);

drop policy if exists "dono decide candidatura" on public.leads;
create policy "dono decide candidatura" on public.leads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index if not exists leads_owner_status_idx on public.leads (owner_id, status);
create index if not exists leads_tenant_status_idx on public.leads (tenant_id, status);

-- ─────────── 0047 — account_type (planos / Gestor) + auditoria ───────────
alter table public.profiles
  add column if not exists account_type text not null default 'individual'
    check (account_type in ('individual', 'gestor'));

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

drop policy if exists "admin lê auditoria de conta" on public.account_type_audit;
create policy "admin lê auditoria de conta" on public.account_type_audit
  for select using (public.is_admin());

create index if not exists account_type_audit_profile_idx
  on public.account_type_audit (profile_id, created_at desc);

-- ─────────── 0048 — tokens de push (app nativo) ───────────
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push: dono gerencia" on public.push_tokens;
create policy "push: dono gerencia" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
