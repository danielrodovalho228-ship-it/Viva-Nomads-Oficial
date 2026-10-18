-- Viva Nomads — aplicar 0162 (avise-me de fotógrafo parceiro por cidade). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0162_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.interesse_fotografo_cidade (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  chave text not null check (chave = lower(chave) and char_length(chave) between 2 and 80),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  criado_em timestamptz not null default now(),
  avisado_em timestamptz,
  unique (user_id, uf, chave)
);
create index if not exists interesse_fotografo_cidade_ranking on public.interesse_fotografo_cidade (uf, chave);

alter table public.interesse_fotografo_cidade enable row level security;
revoke all on public.interesse_fotografo_cidade from public, anon, authenticated;
grant select, insert on public.interesse_fotografo_cidade to authenticated;
grant all on public.interesse_fotografo_cidade to service_role;

drop policy if exists interesse_fotografo_proprio_insere on public.interesse_fotografo_cidade;
create policy interesse_fotografo_proprio_insere on public.interesse_fotografo_cidade for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists interesse_fotografo_le on public.interesse_fotografo_cidade;
create policy interesse_fotografo_le on public.interesse_fotografo_cidade for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000162', '0162_interesse_fotografo_cidade',
       array['-- conteúdo em supabase/migrations/0162_interesse_fotografo_cidade.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000162');
commit;
