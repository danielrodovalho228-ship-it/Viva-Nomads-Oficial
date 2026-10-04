-- ─────────────────────────────────────────────────────────────────────────────
-- 0067 — eventos anônimos de uso + gastos de marketing (admin, PR A). Idempotente.
--
-- 1. eventos: o que as pessoas FAZEM no site (busca, ver anúncio, candidatar…),
--    SEM dado pessoal: sem IP, sem e-mail, sem texto livre. `sessao` é um hash
--    diário (não liga dias diferentes). usuario_id só quando há login.
--    Só o servidor grava (/api/evento, com limite por IP). Ninguém lê pela API:
--    o admin lê por funções agregadas (admin_*), nos próximos PRs.
--    Retenção: 18 meses (job mensal).
-- 2. gastos_marketing: quanto se gastou por mês e canal — base do CAC/ROI.
--    Só admin lê e grava.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 ──────────────────────────────────────────────────────────────────────────
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  tipo text not null,
  criado_em timestamptz not null default now(),
  usuario_id uuid references public.profiles(id) on delete set null,
  sessao text,
  imovel_id uuid references public.properties(id) on delete set null,
  cidade_chave text,
  origem_source text,
  origem_medium text,
  origem_campaign text,
  plataforma text not null default 'web'
);

alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio'
));
alter table public.eventos drop constraint if exists eventos_plataforma_check;
alter table public.eventos add constraint eventos_plataforma_check
  check (plataforma in ('web', 'ios', 'android'));
-- Campos curtos: nada de texto livre/PII passando por aqui.
alter table public.eventos drop constraint if exists eventos_tamanhos_check;
alter table public.eventos add constraint eventos_tamanhos_check check (
  coalesce(length(sessao), 0) <= 64
  and coalesce(length(cidade_chave), 0) <= 80
  and coalesce(length(origem_source), 0) <= 80
  and coalesce(length(origem_medium), 0) <= 80
  and coalesce(length(origem_campaign), 0) <= 120
);

create index if not exists eventos_tipo_criado_idx on public.eventos (tipo, criado_em);
create index if not exists eventos_criado_idx on public.eventos (criado_em);
create index if not exists eventos_imovel_idx on public.eventos (imovel_id) where imovel_id is not null;

-- RLS ligada e SEM política: anon/authenticated não leem nem gravam.
alter table public.eventos enable row level security;
revoke all on public.eventos from anon, authenticated;
grant select, insert, delete on public.eventos to service_role;

create or replace function public.limpar_eventos_antigos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.eventos where criado_em < now() - interval '18 months';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.limpar_eventos_antigos() from public, anon, authenticated;
grant execute on function public.limpar_eventos_antigos() to service_role;

-- Dia 1 de cada mês, 04:30 UTC. Sem pg_cron a migração não falha.
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('limpar-eventos-antigos')
    where exists (select 1 from cron.job where jobname = 'limpar-eventos-antigos');
  perform cron.schedule('limpar-eventos-antigos', '30 4 1 * *', 'select public.limpar_eventos_antigos();');
exception when others then
  raise notice 'pg_cron indisponível (%). Rode select public.limpar_eventos_antigos() todo mês.', sqlerrm;
end $cron$;

-- 2 ──────────────────────────────────────────────────────────────────────────
create table if not exists public.gastos_marketing (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  canal text not null,
  valor numeric(12, 2) not null,
  observacao text,
  criado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

alter table public.gastos_marketing drop constraint if exists gastos_marketing_canal_check;
alter table public.gastos_marketing add constraint gastos_marketing_canal_check
  check (canal in ('instagram', 'google', 'indicacao', 'outro'));
alter table public.gastos_marketing drop constraint if exists gastos_marketing_valor_check;
alter table public.gastos_marketing add constraint gastos_marketing_valor_check
  check (valor >= 0 and valor <= 10000000);
-- Mês sempre no dia 1 (um lançamento = um mês).
alter table public.gastos_marketing drop constraint if exists gastos_marketing_mes_check;
alter table public.gastos_marketing add constraint gastos_marketing_mes_check
  check (extract(day from mes) = 1);
alter table public.gastos_marketing drop constraint if exists gastos_marketing_obs_check;
alter table public.gastos_marketing add constraint gastos_marketing_obs_check
  check (coalesce(length(observacao), 0) <= 500);

create index if not exists gastos_marketing_mes_idx on public.gastos_marketing (mes);

alter table public.gastos_marketing enable row level security;
revoke all on public.gastos_marketing from anon;
grant select, insert, update, delete on public.gastos_marketing to authenticated, service_role;

drop policy if exists "admin lê gastos" on public.gastos_marketing;
create policy "admin lê gastos" on public.gastos_marketing for select using (public.is_admin());
drop policy if exists "admin grava gastos" on public.gastos_marketing;
create policy "admin grava gastos" on public.gastos_marketing for insert with check (public.is_admin());
drop policy if exists "admin altera gastos" on public.gastos_marketing;
create policy "admin altera gastos" on public.gastos_marketing for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin apaga gastos" on public.gastos_marketing;
create policy "admin apaga gastos" on public.gastos_marketing for delete using (public.is_admin());

-- Conferência (rodar depois):
--   select has_table_privilege('anon','public.eventos','select');           -- false
--   select has_table_privilege('authenticated','public.eventos','insert');  -- false
--   select jobname, schedule from cron.job where jobname = 'limpar-eventos-antigos';
