-- Viva Nomads — aplicar 0251 (registro das entradas da QA). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0251_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.qa_entradas (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  ip_hash text not null check (length(ip_hash) <= 64),
  conta_criada boolean not null default false
);
create index if not exists qa_entradas_criado_idx on public.qa_entradas (criado_em);
create index if not exists qa_entradas_usuario_idx on public.qa_entradas (usuario_id, criado_em);

-- RLS ligada e SEM política: só o servidor (service role) grava e lê.
alter table public.qa_entradas enable row level security;
revoke all on public.qa_entradas from anon, authenticated;
grant select, insert, delete on public.qa_entradas to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261028000251', '0251_qa_entradas', array['-- conteúdo em supabase/migrations/0251_qa_entradas.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028000251');
commit;
