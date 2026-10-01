-- ── 0048 — tokens de push por dispositivo (app nativo: Capacitor + FCM/APNs) ──
-- Guarda o token de notificação de cada aparelho do usuário, para avisá-lo de
-- eventos (ex.: nova candidatura ao dono). O ENVIO roda no servidor com a
-- service_role (que ignora RLS para ler os tokens do destinatário) — ver PUSH.md.

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

-- O usuário gerencia apenas os próprios tokens (registrar/atualizar/remover).
drop policy if exists "push: dono gerencia" on public.push_tokens;
create policy "push: dono gerencia" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
