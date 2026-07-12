-- ── 0045 — geração de anúncio por IA: rate-limit + auditoria ──
-- Registro de cada geração (para o limite diário por proprietário e trilha de
-- auditoria). Não guarda o conteúdo gerado — só o fato e o instante.
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'anuncio',
  created_at timestamptz not null default now()
);

alter table public.ai_generations enable row level security;

drop policy if exists "ai_gen: dono lê" on public.ai_generations;
create policy "ai_gen: dono lê"
  on public.ai_generations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ai_gen: dono insere" on public.ai_generations;
create policy "ai_gen: dono insere"
  on public.ai_generations for insert to authenticated
  with check (auth.uid() = user_id);

create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

-- Auditoria: a descrição do anúncio foi gerada por IA (transparência).
alter table public.properties
  add column if not exists descricao_gerada_por_ia boolean not null default false;
