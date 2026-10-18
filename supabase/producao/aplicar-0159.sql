-- Viva Nomads — aplicar 0159 (cidades liberadas + interesse por cidade). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0159_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.cidades_liberadas (
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  chave text not null check (chave = lower(chave) and char_length(chave) between 2 and 80),  -- nome sem acento, minúsculo
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  liberada boolean not null default false,
  liberada_em timestamptz,
  observacao text check (observacao is null or char_length(observacao) <= 300),
  bairro text,  -- reservado: liberação por bairro no futuro (sem regra agora)
  primary key (uf, chave)
);

create table if not exists public.interesse_cidade (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  chave text not null check (char_length(chave) between 2 and 80),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  papel text not null check (papel in ('proprietario','inquilino')),
  criado_em timestamptz not null default now(),
  unique (user_id, uf, chave, papel)
);
create index if not exists interesse_cidade_ranking on public.interesse_cidade (uf, chave, papel);

alter table public.cidades_liberadas enable row level security;
alter table public.interesse_cidade enable row level security;
revoke all on public.cidades_liberadas, public.interesse_cidade from public, anon, authenticated;
grant select on public.cidades_liberadas to anon, authenticated;
grant insert, update, delete on public.cidades_liberadas to authenticated;   -- só passa a política de admin
grant select, insert on public.interesse_cidade to authenticated;
grant all on public.cidades_liberadas, public.interesse_cidade to service_role;

drop policy if exists cidades_liberadas_leitura on public.cidades_liberadas;
create policy cidades_liberadas_leitura on public.cidades_liberadas for select to anon, authenticated using (true);
drop policy if exists cidades_liberadas_admin on public.cidades_liberadas;
create policy cidades_liberadas_admin on public.cidades_liberadas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists interesse_cidade_proprio_insere on public.interesse_cidade;
create policy interesse_cidade_proprio_insere on public.interesse_cidade for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists interesse_cidade_le on public.interesse_cidade;
create policy interesse_cidade_le on public.interesse_cidade for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

insert into public.cidades_liberadas (uf, chave, cidade, liberada, liberada_em, observacao)
values ('MG', 'uberlandia', 'Uberlândia', true, now(), 'Cidade do piloto')
on conflict (uf, chave) do nothing;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000159', '0159_cidades_liberadas',
       array['-- conteúdo em supabase/migrations/0159_cidades_liberadas.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000159');
commit;
