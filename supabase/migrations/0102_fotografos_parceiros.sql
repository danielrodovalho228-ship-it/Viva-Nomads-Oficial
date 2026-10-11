-- 0102 — FOTÓGRAFOS PARCEIROS, parte 1 (ordem 46edeaa5): cadastro pelo admin, busca pública, pedido do dono.
-- PRECISA APROVAÇÃO DO DANIEL — não aplicado (o merge aplica).
-- Segurança: a Viva NÃO recebe dinheiro do dono. A "taxa de parceria" é paga pelo fotógrafo no aceite (parte 2, Asaas).
-- Por isso o BANCO já impede status de pedido aceito/entregue/concluído sem taxa paga (check abaixo): o contato do dono
-- só é liberado depois do pagamento, mesmo que um código futuro erre.
-- Contato do fotógrafo fica em tabela à parte (só admin); o público lê apenas o perfil dos APROVADOS.
-- Sem dado pessoal de inquilino. Idempotente.

create table if not exists public.fotografos (
  id uuid primary key default gen_random_uuid(),
  nome_comercial text not null check (char_length(btrim(nome_comercial)) between 2 and 80),
  cidades text[] not null check (cardinality(cidades) between 1 and 30),
  portfolio_url text check (portfolio_url is null or (portfolio_url ~ '^https://' and char_length(portfolio_url) <= 300)),
  pacote_fotos int not null default 20 check (pacote_fotos between 1 and 200),
  pacote_prazo_dias int not null default 3 check (pacote_prazo_dias between 1 and 30),
  pacote_preco numeric(10,2) not null check (pacote_preco >= 0 and pacote_preco <= 100000),
  nota_media numeric(3,2) check (nota_media is null or nota_media between 1 and 5),
  avaliacoes_qtd int not null default 0 check (avaliacoes_qtd >= 0),
  aprovado boolean not null default false,
  aprovado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists fotografos_aprovados on public.fotografos (aprovado) where aprovado;

create table if not exists public.fotografos_contato (
  fotografo_id uuid primary key references public.fotografos(id) on delete cascade,
  email text check (email is null or char_length(email) <= 200),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 30)
);

create table if not exists public.fotografo_pedidos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fotografo_id uuid not null references public.fotografos(id) on delete restrict,
  cep text not null check (cep ~ '^[0-9]{8}$'),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  data_sugerida date not null,
  observacao text check (observacao is null or char_length(observacao) <= 300),
  status text not null default 'enviado' check (status in ('enviado','aceito','recusado','cancelado','entregue','concluido')),
  taxa_valor numeric(8,2) check (taxa_valor is null or taxa_valor >= 0),
  taxa_paga_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Contato só depois do pagamento: sem taxa paga o pedido não passa de "enviado".
  constraint fotografo_pedidos_aceite_exige_taxa check (status not in ('aceito','entregue','concluido') or taxa_paga_em is not null)
);
create index if not exists fotografo_pedidos_owner on public.fotografo_pedidos (owner_id, criado_em desc);
create index if not exists fotografo_pedidos_fotografo on public.fotografo_pedidos (fotografo_id, status);
-- Um pedido aberto por dono e fotógrafo (evita spam).
create unique index if not exists fotografo_pedidos_um_aberto on public.fotografo_pedidos (owner_id, fotografo_id) where status = 'enviado';

create table if not exists public.config_parceria (
  chave text primary key,
  valor numeric(10,2) not null check (valor >= 0 and valor <= 10000)
);
insert into public.config_parceria (chave, valor) values ('taxa_parceria_fotografo', 40) on conflict (chave) do nothing;

alter table public.fotografos enable row level security;
alter table public.fotografos_contato enable row level security;
alter table public.fotografo_pedidos enable row level security;
alter table public.config_parceria enable row level security;

revoke all on public.fotografos, public.fotografos_contato, public.fotografo_pedidos, public.config_parceria from public, anon, authenticated;
grant select on public.fotografos to anon, authenticated;
grant insert, update, delete on public.fotografos to authenticated;          -- só passa a política de admin
grant select, insert, update, delete on public.fotografos_contato to authenticated;  -- só admin
grant select, update on public.fotografo_pedidos to authenticated;            -- dono lê; update só admin (política)
grant insert (fotografo_id, cep, cidade, uf, data_sugerida, observacao) on public.fotografo_pedidos to authenticated;
grant select, insert, update on public.config_parceria to authenticated;      -- só admin
grant all on public.fotografos, public.fotografos_contato, public.fotografo_pedidos, public.config_parceria to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fotografos' and policyname='fotografos: aprovados publicos') then
    create policy "fotografos: aprovados publicos" on public.fotografos for select to anon, authenticated using (aprovado);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fotografos' and policyname='fotografos: admin tudo') then
    create policy "fotografos: admin tudo" on public.fotografos for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fotografos_contato' and policyname='fotografos_contato: admin tudo') then
    create policy "fotografos_contato: admin tudo" on public.fotografos_contato for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fotografo_pedidos' and policyname='fotografo_pedidos: dono le') then
    create policy "fotografo_pedidos: dono le" on public.fotografo_pedidos for select to authenticated using (owner_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fotografo_pedidos' and policyname='fotografo_pedidos: dono cria') then
    create policy "fotografo_pedidos: dono cria" on public.fotografo_pedidos for insert to authenticated
      with check (owner_id = auth.uid() and status = 'enviado' and taxa_paga_em is null
                  and exists (select 1 from public.fotografos f where f.id = fotografo_id and f.aprovado));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fotografo_pedidos' and policyname='fotografo_pedidos: admin atualiza') then
    create policy "fotografo_pedidos: admin atualiza" on public.fotografo_pedidos for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='config_parceria' and policyname='config_parceria: admin tudo') then
    create policy "config_parceria: admin tudo" on public.config_parceria for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end;
$$;
