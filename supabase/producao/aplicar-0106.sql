-- Viva Nomads — aplicar 0106 (tabela lab_execucoes: resultados do laboratório; só admin lê).
-- PRECISA APROVAÇÃO DO DANIEL — não aplicado. Aplicada pela Action quando o PR é mesclado (o merge é a aprovação).
-- Rollback: supabase/producao/rollback/0106_rollback.sql.
begin;
set local lock_timeout = '5s';

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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261012000106', '0106_lab_execucoes',
       array['-- conteúdo em supabase/migrations/0106_lab_execucoes.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261012000106');
commit;
