-- Viva Nomads — aplicar 0155 ("Publicamos para você": fila de ajuda para montar o anúncio). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0155_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.pedidos_ajuda_publicacao (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  link_anuncio text check (link_anuncio is null or char_length(link_anuncio) <= 500),
  texto_anuncio text check (texto_anuncio is null or char_length(texto_anuncio) <= 6000),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  property_id uuid references public.properties (id) on delete set null,
  status text not null default 'recebido' check (status in ('recebido', 'em_montagem', 'enviado_dono', 'cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ajuda_publicacao_tem_conteudo check (link_anuncio is not null or texto_anuncio is not null)
);

create index if not exists ajuda_publicacao_owner_idx on public.pedidos_ajuda_publicacao (owner_id, criado_em desc);
create index if not exists ajuda_publicacao_status_idx on public.pedidos_ajuda_publicacao (status, criado_em);

alter table public.pedidos_ajuda_publicacao enable row level security;
revoke all on public.pedidos_ajuda_publicacao from anon;
revoke all on public.pedidos_ajuda_publicacao from authenticated;
grant select, insert on public.pedidos_ajuda_publicacao to authenticated;
grant update (status, property_id, atualizado_em) on public.pedidos_ajuda_publicacao to authenticated;

drop policy if exists ajuda_publicacao_dono_le on public.pedidos_ajuda_publicacao;
create policy ajuda_publicacao_dono_le on public.pedidos_ajuda_publicacao
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

drop policy if exists ajuda_publicacao_dono_cria on public.pedidos_ajuda_publicacao;
create policy ajuda_publicacao_dono_cria on public.pedidos_ajuda_publicacao
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'recebido');

drop policy if exists ajuda_publicacao_admin_atualiza on public.pedidos_ajuda_publicacao;
create policy ajuda_publicacao_admin_atualiza on public.pedidos_ajuda_publicacao
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000155', '0155_ajuda_publicacao',
       array['-- conteúdo em supabase/migrations/0155_ajuda_publicacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000155');
commit;
