-- 0106 — RESULTADOS DO LABORATÓRIO NO BANCO (ordem 225d0648).
-- Por quê: a suíte E2E roda no GitHub Actions a cada merge e às 03h; o resultado ficava só no resumo da Action.
-- Gravando 1 linha por execução, o Daniel, o Moacir e os agentes leem o histórico sem abrir o Actions.
-- Segurança: RLS ligada; só admin lê (is_admin); NINGUÉM escreve pela API (sem política e sem grant de escrita).
-- Quem grava é a Action, pela conexão direta do banco (SUPABASE_DB_URL, papel postgres). Só títulos de testes e contagens — sem dados pessoais.
create table if not exists public.lab_execucoes (
  id uuid primary key default gen_random_uuid(),
  criada_em timestamptz not null default now(),
  commit_sha text,
  gatilho text,
  passou int not null default 0,
  falhou int not null default 0,
  pulou int not null default 0,
  instavel int not null default 0,
  por_spec jsonb not null default '{}'::jsonb,
  falhas jsonb not null default '[]'::jsonb,
  run_url text
);
comment on table public.lab_execucoes is 'Uma linha por execução do laboratório E2E (Action). Só contagens e títulos de testes.';
create index if not exists lab_execucoes_criada_em_idx on public.lab_execucoes (criada_em desc);

alter table public.lab_execucoes enable row level security;
revoke all on public.lab_execucoes from anon, authenticated;
grant select on public.lab_execucoes to authenticated;

drop policy if exists "lab_execucoes: admin le" on public.lab_execucoes;
create policy "lab_execucoes: admin le" on public.lab_execucoes for select to authenticated using (public.is_admin());
