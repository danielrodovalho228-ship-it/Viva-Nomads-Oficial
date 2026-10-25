-- 0226 — Prompt 44 (B1): push só pela matriz. Dois apoios do notify():
--   • push_adiados: o push que caiu no silêncio (22h–7h) espera aqui e sai às 7h (cron); enviado = apagado;
--   • conversa_aberturas: quando cada pessoa abriu cada conversa (mensagem nova só vira push se ela não abriu nos
--     últimos 10 min).
-- Só o servidor lê e grava as duas (service role). Idempotente.

-- ── 1. Push adiado pelo silêncio ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.push_adiados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  evento text not null check (char_length(evento) between 1 and 80),
  titulo text not null check (char_length(titulo) between 1 and 120),
  corpo text not null check (char_length(corpo) <= 240),
  url text check (url is null or (char_length(url) <= 300 and url like '/%' and url not like '//%')),
  -- Mensagens da mesma conversa substituem o push anterior (um só, com a contagem).
  grupo text check (grupo is null or char_length(grupo) <= 120),
  sair_em timestamptz not null,
  criado_em timestamptz not null default now()
);
create index if not exists push_adiados_sair_em on public.push_adiados (sair_em);
create unique index if not exists push_adiados_grupo on public.push_adiados (user_id, grupo) where grupo is not null;
comment on table public.push_adiados is
  'Prompt 44: push que caiu no silêncio (22h–7h, Brasília) e sai às 7h. Texto genérico da matriz (sem contato, sobrenome nem documento). Apagado ao enviar.';
alter table public.push_adiados enable row level security;
revoke all on public.push_adiados from anon, authenticated;
grant all on public.push_adiados to service_role;

-- ── 2. Quando a pessoa abriu a conversa ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.conversa_aberturas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null,
  aberta_em timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
comment on table public.conversa_aberturas is
  'Prompt 44: última abertura de cada conversa por pessoa. Mensagem nova só vira push sem abertura nos últimos 10 min.';
alter table public.conversa_aberturas enable row level security;
revoke all on public.conversa_aberturas from anon, authenticated;
grant all on public.conversa_aberturas to service_role;
