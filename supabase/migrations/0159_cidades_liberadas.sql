-- 0159 — CIDADES LIBERADAS (ordem 335b4064, sócio Rogério). Trava geográfica de publicação + interesse por cidade.
-- Leitura pública (a busca e o pedido precisam saber se a cidade está liberada); escrita só admin.
-- Interesse: só o próprio usuário logado grava (user_id = auth.uid()); sem e-mail/telefone na tabela — o contato vem do perfil. Idempotente.

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
