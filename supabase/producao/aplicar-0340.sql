-- Viva Nomads — aplicar 0340 (12a8086d: links de aprovação de uso único). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0340_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.aprovacoes_links_usados (
  assinatura text primary key check (assinatura ~ '^[0-9a-f]{32}$'),
  expira_em timestamptz not null,
  usado_em timestamptz not null default now()
);

create index if not exists aprovacoes_links_usados_expira on public.aprovacoes_links_usados (expira_em);

comment on table public.aprovacoes_links_usados is
  'Links de aviso já abertos (uso único, 72 h). Só a assinatura; sem dado pessoal. Só o servidor acessa.';

alter table public.aprovacoes_links_usados enable row level security;
revoke all on public.aprovacoes_links_usados from public, anon, authenticated;
grant select, insert, delete on public.aprovacoes_links_usados to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261111000340', '0340_aprovacoes_links_usados', array['-- conteúdo em supabase/migrations/0340_aprovacoes_links_usados.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261111000340');
commit;
