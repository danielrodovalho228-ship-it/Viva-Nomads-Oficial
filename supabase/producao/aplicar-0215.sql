-- Viva Nomads — aplicar 0215 (avaliadores credenciados, tabela de preço, pedidos e rodízio da avaliação do imóvel — Prompt 62-B1). Idempotente. Rollback: supabase/producao/rollback/0215_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0215 — Prompt 62-B1: avaliação do imóvel por avaliador credenciado (categoria interna "vistoria").
-- Tudo atrás da chave VISTORIA_ATIVA (no código). Nada financeiro passa pela Viva: o dono paga direto ao avaliador e a
-- plataforma só registra ("recebido" do avaliador, confirmação do dono). Só o servidor grava (cliente de serviço depois
-- do portão de cada ação); a RLS abre a leitura a quem é parte.
--
--   1. parceiros.categorias aceita 'vistoria' (o catálogo "pedir serviço" não mostra; parceiro_pedidos não aceita).
--   2. avaliadores_credenciamento: número sequencial por cidade (UDI-001), status, experiência (arquivo no bucket privado
--      "avaliadores" ou link), aceite do código de conduta (versão), relações declaradas (donos e imóveis).
--   3. vistoria_precos: tabela por cidade e porte, com histórico (cada mudança é uma linha nova; vale a mais recente).
--   4. vistoria_pedidos + vistoria_designacoes (rodízio, 24 h para responder, ausências).
--   5. vistoria_conduta (avaliação mútua só de conduta), vistoria_auditoria (sorteio interno) e vistoria_fila_admin.
--   6. avaliadores_publicos(): a página pública do avaliador (nome curto, número, cidade, avaliações feitas, nota de conduta).

-- ── 1. Categoria ────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.parceiros drop constraint if exists parceiros_categorias;
alter table public.parceiros add constraint parceiros_categorias check (
  categorias <@ array['fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro', 'vistoria']::text[]
);

-- ── 2. Credenciamento ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.avaliadores_contador (
  sigla text primary key check (sigla ~ '^[A-Z]{3}$'),
  ultimo integer not null default 0
);
alter table public.avaliadores_contador enable row level security;
revoke all on public.avaliadores_contador from public, anon, authenticated;
grant all on public.avaliadores_contador to service_role;

-- Próximo número da cidade (UDI-001…), atômico.
create or replace function public.proximo_numero_avaliador(p_sigla text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.avaliadores_contador as c (sigla, ultimo) values (p_sigla, 1)
    on conflict (sigla) do update set ultimo = c.ultimo + 1
  returning ultimo into n;
  return p_sigla || '-' || lpad(n::text, 3, '0');
end;
$$;
revoke all on function public.proximo_numero_avaliador(text) from public;
grant execute on function public.proximo_numero_avaliador(text) to service_role;

create table if not exists public.avaliadores_credenciamento (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null unique references public.parceiros (id) on delete cascade,
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  numero_credenciado text not null unique check (numero_credenciado ~ '^[A-Z]{3}-[0-9]{3,}$'),
  status text not null default 'solicitado' check (status in ('solicitado', 'em_teste', 'ativo', 'suspenso', 'descredenciado')),
  motivo text check (motivo is null or char_length(motivo) <= 500),
  decidido_por uuid references auth.users (id) on delete set null,
  decidido_em timestamptz,
  experiencia_path text,
  experiencia_link text check (experiencia_link is null or experiencia_link ~ '^https://'),
  conduta_versao text not null,
  conduta_aceita_em timestamptz not null default now(),
  relacoes_donos uuid[] not null default '{}',
  relacoes_imoveis uuid[] not null default '{}',
  relacoes_descricao text check (relacoes_descricao is null or char_length(relacoes_descricao) <= 1000),
  ultima_designacao_em timestamptz,
  ativado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint avaliadores_experiencia check (experiencia_path is not null or experiencia_link is not null)
);
create index if not exists avaliadores_credenciamento_cidade on public.avaliadores_credenciamento (cidade, status);
alter table public.avaliadores_credenciamento enable row level security;
revoke all on public.avaliadores_credenciamento from public, anon, authenticated;
grant select on public.avaliadores_credenciamento to authenticated;
grant all on public.avaliadores_credenciamento to service_role;
drop policy if exists avaliadores_credenciamento_le on public.avaliadores_credenciamento;
create policy avaliadores_credenciamento_le on public.avaliadores_credenciamento for select to authenticated
  using (public.parceiro_meu(parceiro_id) or public.is_admin());

-- Bucket privado do portfólio/referência (só o servidor lê e grava; o admin vê por URL assinada).
insert into storage.buckets (id, name, public, file_size_limit)
values ('avaliadores', 'avaliadores', false, 10485760)
on conflict (id) do nothing;

-- ── 3. Tabela de preço (D2): sem valor no código; histórico por linha ──────────────────────────────────────────
create table if not exists public.vistoria_precos (
  id uuid primary key default gen_random_uuid(),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  porte text not null check (porte in ('estudio', 'q1_2', 'q3_mais')),
  valor numeric(10, 2) not null check (valor > 0),
  inclui_texto text check (inclui_texto is null or char_length(inclui_texto) <= 300),
  vigente_desde timestamptz not null default now(),
  alterado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists vistoria_precos_cidade on public.vistoria_precos (cidade, porte, vigente_desde desc);
alter table public.vistoria_precos enable row level security;
revoke all on public.vistoria_precos from public, anon, authenticated;
grant select on public.vistoria_precos to authenticated;
grant all on public.vistoria_precos to service_role;
drop policy if exists vistoria_precos_le on public.vistoria_precos;
create policy vistoria_precos_le on public.vistoria_precos for select to authenticated using (true);

-- ── 4. Pedidos e designações ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.vistoria_pedidos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  cidade text not null,
  tipo text not null default 'inicial' check (tipo in ('inicial', 'reverificacao', 'contestacao', 'verificacao', 'nova_90d')),
  porte text not null check (porte in ('estudio', 'q1_2', 'q3_mais')),
  valor_tabela numeric(10, 2) not null check (valor_tabela >= 0),
  status text not null default 'pedido'
    check (status in ('pedido', 'designado', 'agendado', 'realizada', 'laudo_emitido', 'cancelada', 'ausencia')),
  aguardando_avaliador boolean not null default false,
  avaliador_id uuid references public.avaliadores_credenciamento (id) on delete set null,
  designado_em timestamptz,
  agendado_para timestamptz,
  reagendou_dono boolean not null default false,
  reagendou_avaliador boolean not null default false,
  ocupado boolean not null default false,
  morador_id uuid references auth.users (id) on delete set null,
  concordancia_pedida_em timestamptz,
  concordancia_em timestamptz,
  recebido_marcado_em timestamptz,
  recebido_confirmado_em timestamptz,
  lembrete_d1_em timestamptz,
  origem_pedido_id uuid references public.vistoria_pedidos (id) on delete set null,
  teste boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists vistoria_pedidos_property on public.vistoria_pedidos (property_id, criado_em desc);
create index if not exists vistoria_pedidos_avaliador on public.vistoria_pedidos (avaliador_id, status);
create index if not exists vistoria_pedidos_status on public.vistoria_pedidos (status, designado_em);
-- Um pedido aberto por imóvel.
create unique index if not exists vistoria_pedidos_um_aberto on public.vistoria_pedidos (property_id)
  where status in ('pedido', 'designado', 'agendado');
alter table public.vistoria_pedidos enable row level security;
revoke all on public.vistoria_pedidos from public, anon, authenticated;
grant select on public.vistoria_pedidos to authenticated;
grant all on public.vistoria_pedidos to service_role;

-- O pedido é designado a mim (avaliador)?
create or replace function public.vistoria_sou_avaliador(p_avaliador uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.avaliadores_credenciamento c join public.parceiros p on p.id = c.parceiro_id
     where c.id = p_avaliador and p.user_id = (select auth.uid())
  )
$$;
revoke all on function public.vistoria_sou_avaliador(uuid) from public;
grant execute on function public.vistoria_sou_avaliador(uuid) to authenticated, service_role;

drop policy if exists vistoria_pedidos_le on public.vistoria_pedidos;
create policy vistoria_pedidos_le on public.vistoria_pedidos for select to authenticated
  using (owner_id = (select auth.uid()) or morador_id = (select auth.uid()) or public.vistoria_sou_avaliador(avaliador_id) or public.is_admin());

create table if not exists public.vistoria_designacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  avaliador_id uuid not null references public.avaliadores_credenciamento (id) on delete cascade,
  designado_em timestamptz not null default now(),
  resposta text check (resposta is null or resposta in ('aceita', 'recusada', 'expirada', 'ausencia')),
  respondido_em timestamptz,
  prioridade boolean not null default false,
  unique (pedido_id, avaliador_id)
);
create index if not exists vistoria_designacoes_avaliador on public.vistoria_designacoes (avaliador_id, designado_em desc);
alter table public.vistoria_designacoes enable row level security;
revoke all on public.vistoria_designacoes from public, anon, authenticated;
grant select on public.vistoria_designacoes to authenticated;
grant all on public.vistoria_designacoes to service_role;
drop policy if exists vistoria_designacoes_le on public.vistoria_designacoes;
create policy vistoria_designacoes_le on public.vistoria_designacoes for select to authenticated
  using (public.vistoria_sou_avaliador(avaliador_id) or public.is_admin());

-- ── 5. Conduta, auditoria e fila do admin ───────────────────────────────────────────────────────────────────────
create table if not exists public.vistoria_conduta (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.vistoria_pedidos (id) on delete cascade,
  autor text not null check (autor in ('dono', 'avaliador')),
  avaliador_id uuid not null references public.avaliadores_credenciamento (id) on delete cascade,
  pontualidade smallint check (pontualidade between 1 and 5),
  cordialidade smallint check (cordialidade between 1 and 5),
  cuidado smallint check (cuidado between 1 and 5),
  imovel_pronto smallint check (imovel_pronto between 1 and 5),
  horario_respeitado smallint check (horario_respeitado between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 300),
  criado_em timestamptz not null default now(),
  unique (pedido_id, autor),
  constraint vistoria_conduta_campos check (
    (autor = 'dono' and pontualidade is not null and cordialidade is not null and cuidado is not null and imovel_pronto is null and horario_respeitado is null)
    or (autor = 'avaliador' and imovel_pronto is not null and horario_respeitado is not null and pontualidade is null and cordialidade is null and cuidado is null)
  )
);
alter table public.vistoria_conduta enable row level security;
revoke all on public.vistoria_conduta from public, anon, authenticated;
grant select on public.vistoria_conduta to authenticated;
grant all on public.vistoria_conduta to service_role;
drop policy if exists vistoria_conduta_le on public.vistoria_conduta;
create policy vistoria_conduta_le on public.vistoria_conduta for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.vistoria_pedidos p where p.id = vistoria_conduta.pedido_id
               and (p.owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(p.avaliador_id)))
  );

create table if not exists public.vistoria_auditoria (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.vistoria_pedidos (id) on delete cascade,
  avaliador_id uuid not null references public.avaliadores_credenciamento (id) on delete cascade,
  sorteado_em timestamptz not null default now(),
  resultado text check (resultado is null or resultado in ('confere', 'nao_confere')),
  motivo text check (motivo is null or char_length(motivo) <= 500),
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_em timestamptz,
  constraint vistoria_auditoria_motivo check (resultado is distinct from 'nao_confere' or motivo is not null)
);
alter table public.vistoria_auditoria enable row level security;
revoke all on public.vistoria_auditoria from public, anon, authenticated;
grant select on public.vistoria_auditoria to authenticated;
grant all on public.vistoria_auditoria to service_role;
drop policy if exists vistoria_auditoria_le on public.vistoria_auditoria;
create policy vistoria_auditoria_le on public.vistoria_auditoria for select to authenticated using (public.is_admin());

create table if not exists public.vistoria_fila_admin (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento')),
  pedido_id uuid references public.vistoria_pedidos (id) on delete cascade,
  avaliador_id uuid references public.avaliadores_credenciamento (id) on delete cascade,
  motivo text check (motivo is null or char_length(motivo) <= 500),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users (id) on delete set null
);
create unique index if not exists vistoria_fila_admin_aberta on public.vistoria_fila_admin (tipo, coalesce(pedido_id, avaliador_id))
  where resolvido_em is null;
alter table public.vistoria_fila_admin enable row level security;
revoke all on public.vistoria_fila_admin from public, anon, authenticated;
grant select on public.vistoria_fila_admin to authenticated;
grant all on public.vistoria_fila_admin to service_role;
drop policy if exists vistoria_fila_admin_le on public.vistoria_fila_admin;
create policy vistoria_fila_admin_le on public.vistoria_fila_admin for select to authenticated using (public.is_admin());

-- ── 6. Página pública do avaliador (só ativos; sem documento, contato, cidade de casa ou relações) ──────────────
create or replace function public.avaliadores_publicos()
returns table (numero_credenciado text, nome_curto text, cidade text, avaliacoes_feitas integer, nota_conduta numeric, teste boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.numero_credenciado,
         split_part(btrim(p.nome_publico), ' ', 1),
         c.cidade,
         (select count(*)::integer from public.vistoria_pedidos v where v.avaliador_id = c.id and v.status = 'laudo_emitido' and not v.teste),
         (select round(avg((k.pontualidade + k.cordialidade + k.cuidado) / 3.0), 1) from public.vistoria_conduta k
           where k.avaliador_id = c.id and k.autor = 'dono'),
         coalesce(pf.is_teste, false)
    from public.avaliadores_credenciamento c
    join public.parceiros p on p.id = c.parceiro_id
    left join public.profiles pf on pf.id = p.user_id
   where c.status = 'ativo'
$$;
revoke all on function public.avaliadores_publicos() from public;
grant execute on function public.avaliadores_publicos() to anon, authenticated, service_role;

-- ── 7. Cron de hora em hora (pg_cron + pg_net, padrão da 0073/0210): designação sem resposta em 24 h passa ao próximo,
--      lembrete D-1 e sorteio da auditoria. A Vercel cobre 1×/dia.
create or replace function public.vistoria_tique()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
  site text;
begin
  begin
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'cron_secret';
    select decrypted_secret into site from vault.decrypted_secrets where name = 'site_url';
    if segredo is not null and site is not null and to_regproc('net.http_get') is not null then
      perform net.http_get(
        url := site || '/api/cron/vistoria',
        headers := jsonb_build_object('Authorization', 'Bearer ' || segredo)
      );
    end if;
  exception when others then
    raise notice 'vistoria_tique: rota não chamada (%).', sqlerrm;
  end;
end;
$$;
revoke all on function public.vistoria_tique() from public, anon, authenticated;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('vistoria')
    where exists (select 1 from cron.job where jobname = 'vistoria');
  perform cron.schedule('vistoria', '7 * * * *', 'select public.vistoria_tique();');
exception when others then
  raise notice 'pg_cron indisponível (%). O cron diário da Vercel cobre a avaliação.', sqlerrm;
end $cron$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000215', '0215_avaliadores_credenciados',
       array['-- conteúdo em supabase/migrations/0215_avaliadores_credenciados.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000215');
commit;
