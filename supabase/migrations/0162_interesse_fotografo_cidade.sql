-- 0162 — QA do Muse (18/10): "avise-me quando houver fotógrafo parceiro na minha cidade" (/parceiros/fotografos).
-- Uma linha por pessoa e cidade. Sem e-mail/telefone na tabela: o contato vem do perfil. RLS: só a própria pessoa
-- (grava e lê a sua) e o admin (lê todas). Idempotente.
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
