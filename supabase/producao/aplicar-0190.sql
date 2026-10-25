-- Viva Nomads — 0190: parceiros, ciclo completo (Prompt 31a). Idempotente (if not exists / create or replace / on conflict).
-- Rollback: supabase/producao/rollback/0190_rollback.sql. Aplicada pela Action quando o PR é mesclado.
begin;
set local lock_timeout = '5s';

-- 0190 — Parceiros, ciclo completo (Prompt 31a: funil, ativação, página, busca e textos).
--  1. parceiro_solicitacoes: o pedido de parceria (site, conta ou suporte). Uma aberta por conta e por e-mail. A
--     aprovação gera um token de ativação (o banco guarda só o hash; 7 dias; uso único).
--  2. parceiros: o PAPEL de parceiro da conta (profiles.role não muda). Documento e dados de recebimento são
--     restritos: só a própria pessoa e a equipe leem; o público lê só a view parceiros_publicos (publicado).
--  3. parceiro_servicos, parceiro_galeria, parceiro_agenda (janelas semanais + bloqueios): o público lê os do
--     parceiro publicado; quem grava é o servidor (service_role), depois de conferir a sessão.
--  4. parceiro_pedidos (VN-SV-XXXXXXXX), parceiro_pedido_eventos, parceiro_entregas: a base da contratação (31b).
--     Só as duas partes e a equipe leem; só o servidor grava.
--  5. Bucket público "parceiros" (WebP, 5 MB): foto, capa e galeria das páginas. Só o servidor grava.
--  6. interesse_fotografo_cidade ganha "categoria" (o avise-me vale para qualquer categoria).
--  7. chaves_plataforma ganha "valor" (jsonb) e a chave PARCEIRO_GERAL_FALLBACK (desligada).
--  8. Dados: parceiros_interesse vira solicitação pendente (origem site); fotografos, fotografos_contato,
--     fotografo_pedidos e config_parceria ficam marcadas como obsoletas (o site não lê nem grava mais).
-- Aprovação e ativação: só o servidor (service_role) grava, e as ações conferem admin com 2FA (AAL2).
-- Reaplicar é seguro (if not exists / create or replace / on conflict).

-- ── 1. Solicitações ──────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.parceiro_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  tipo_pessoa text check (tipo_pessoa in ('pf', 'pj')),
  documento text check (documento is null or documento ~ '^([0-9]{11}|[0-9]{14})$'),
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  categorias text[] not null default '{}',
  cidades text[] not null default '{}',
  portfolio_url text check (portfolio_url is null or portfolio_url ~ '^https?://'),
  descricao text check (descricao is null or char_length(descricao) <= 600),
  dados_categoria jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('aguardando_email', 'pendente', 'aprovada', 'recusada', 'ativada')),
  motivo_recusa text,
  checklist jsonb not null default '{}'::jsonb,
  decidido_por uuid references auth.users (id) on delete set null,
  decidido_em timestamptz,
  token_ativacao_hash text check (token_ativacao_hash is null or token_ativacao_hash ~ '^[0-9a-f]{64}$'),
  token_expira_em timestamptz,
  novo_link_pedido_em timestamptz,
  origem text not null default 'site' check (origem in ('site', 'conta', 'suporte')),
  interesse_id uuid unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint parceiro_solicitacoes_categorias check (
    categorias <@ array['fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro']::text[]
  ),
  constraint parceiro_solicitacoes_cidades_max check (cardinality(cidades) <= 10),
  constraint parceiro_solicitacoes_recusa_motivo check (status <> 'recusada' or motivo_recusa is not null),
  constraint parceiro_solicitacoes_aprovada_token check (status <> 'aprovada' or token_ativacao_hash is not null)
);
create unique index if not exists parceiro_solicitacoes_uma_aberta_conta on public.parceiro_solicitacoes (user_id)
  where user_id is not null and status in ('aguardando_email', 'pendente', 'aprovada');
create unique index if not exists parceiro_solicitacoes_uma_aberta_email on public.parceiro_solicitacoes (lower(email))
  where email is not null and status in ('aguardando_email', 'pendente', 'aprovada');
create unique index if not exists parceiro_solicitacoes_token on public.parceiro_solicitacoes (token_ativacao_hash)
  where token_ativacao_hash is not null;
create index if not exists parceiro_solicitacoes_status on public.parceiro_solicitacoes (status, criado_em desc);

alter table public.parceiro_solicitacoes enable row level security;
revoke all on public.parceiro_solicitacoes from public, anon, authenticated;
grant select on public.parceiro_solicitacoes to authenticated;
grant all on public.parceiro_solicitacoes to service_role;
drop policy if exists parceiro_solicitacoes_le on public.parceiro_solicitacoes;
create policy parceiro_solicitacoes_le on public.parceiro_solicitacoes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ── 2. Parceiros (o papel) ───────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  solicitacao_id uuid references public.parceiro_solicitacoes (id) on delete set null,
  tipo_pessoa text not null check (tipo_pessoa in ('pf', 'pj')),
  documento text not null check (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  razao_social text,
  nome_publico text not null check (char_length(btrim(nome_publico)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  categorias text[] not null default '{}',
  descricao text check (descricao is null or char_length(descricao) <= 2000),
  descricao_curta text check (descricao_curta is null or char_length(descricao_curta) <= 160),
  avatar_path text,
  banner_path text,
  instagram text check (instagram is null or instagram ~ '^https://'),
  linkedin text check (linkedin is null or linkedin ~ '^https://'),
  facebook text check (facebook is null or facebook ~ '^https://'),
  tiktok text check (tiktok is null or tiktok ~ '^https://'),
  site text check (site is null or site ~ '^https?://'),
  cidades text[] not null default '{}',
  cep_base text check (cep_base is null or cep_base ~ '^[0-9]{8}$'),
  raio_km integer check (raio_km is null or raio_km between 1 and 200),
  lat double precision,
  lng double precision,
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'pausado', 'suspenso')),
  publicado_em timestamptz,
  suspenso_motivo text,
  nota_media numeric(3, 2) check (nota_media is null or nota_media between 1 and 5),
  avaliacoes_qtd integer not null default 0 check (avaliacoes_qtd >= 0),
  dados_recebimento jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint parceiros_categorias check (
    categorias <@ array['fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro']::text[]
  ),
  constraint parceiros_cidades_max check (cardinality(cidades) <= 10)
);
create index if not exists parceiros_status on public.parceiros (status, publicado_em desc);

alter table public.parceiros enable row level security;
revoke all on public.parceiros from public, anon, authenticated;
grant select on public.parceiros to authenticated;
grant all on public.parceiros to service_role;
drop policy if exists parceiros_le on public.parceiros;
create policy parceiros_le on public.parceiros for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- O parceiro está publicado? (para a RLS das tabelas da página; não abre a tabela parceiros ao público)
create or replace function public.parceiro_publicado(p_parceiro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.parceiros p where p.id = p_parceiro and p.status = 'publicado')
$$;
revoke all on function public.parceiro_publicado(uuid) from public;
grant execute on function public.parceiro_publicado(uuid) to anon, authenticated, service_role;

-- O parceiro é da pessoa logada?
create or replace function public.parceiro_meu(p_parceiro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.parceiros p where p.id = p_parceiro and p.user_id = (select auth.uid()))
$$;
revoke all on function public.parceiro_meu(uuid) from public;
grant execute on function public.parceiro_meu(uuid) to authenticated, service_role;

-- Leitura pública: SÓ colunas públicas e só publicado (sem documento, recebimento, telefone, CEP ou e-mail).
-- O ponto do CEP base sai arredondado (~1 km), só para a busca por raio.
create or replace function public.parceiros_publicos_lista()
returns table (
  id uuid,
  slug text,
  nome_publico text,
  categorias text[],
  descricao text,
  descricao_curta text,
  avatar_path text,
  banner_path text,
  instagram text,
  linkedin text,
  facebook text,
  tiktok text,
  site text,
  cidades text[],
  raio_km integer,
  lat double precision,
  lng double precision,
  nota_media numeric,
  avaliacoes_qtd integer,
  publicado_em timestamptz,
  teste boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.slug, p.nome_publico, p.categorias, p.descricao, p.descricao_curta, p.avatar_path, p.banner_path,
         p.instagram, p.linkedin, p.facebook, p.tiktok, p.site, p.cidades, p.raio_km,
         round(p.lat::numeric, 2)::double precision, round(p.lng::numeric, 2)::double precision,
         p.nota_media, p.avaliacoes_qtd, p.publicado_em, coalesce(pf.is_teste, false)
    from public.parceiros p
    left join public.profiles pf on pf.id = p.user_id
   where p.status = 'publicado'
$$;
revoke all on function public.parceiros_publicos_lista() from public;
grant execute on function public.parceiros_publicos_lista() to anon, authenticated, service_role;

create or replace view public.parceiros_publicos
  with (security_invoker = on)
as
  select l.* from public.parceiros_publicos_lista() l;
revoke insert, update, delete, truncate, references, trigger on public.parceiros_publicos from anon, authenticated;
grant select on public.parceiros_publicos to anon, authenticated;

-- ── 3. Página: serviços, galeria, agenda ─────────────────────────────────────────────────────────────────────────
create table if not exists public.parceiro_servicos (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros (id) on delete cascade,
  categoria text not null check (categoria in ('fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro')),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 80),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  preco_base numeric(10, 2) check (preco_base is null or preco_base > 0),
  unidade text check (unidade is null or char_length(unidade) <= 30),
  prazo_dias integer check (prazo_dias is null or prazo_dias between 0 and 90),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists parceiro_servicos_parceiro on public.parceiro_servicos (parceiro_id);

create table if not exists public.parceiro_galeria (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros (id) on delete cascade,
  path text not null,
  legenda text check (legenda is null or char_length(legenda) <= 120),
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists parceiro_galeria_parceiro on public.parceiro_galeria (parceiro_id, ordem);

create table if not exists public.parceiro_agenda (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros (id) on delete cascade,
  tipo text not null default 'janela' check (tipo in ('janela', 'bloqueio')),
  dia_semana smallint check (dia_semana between 0 and 6),
  inicio time,
  fim time,
  data_inicio date,
  data_fim date,
  criado_em timestamptz not null default now(),
  constraint parceiro_agenda_janela check (
    (tipo = 'janela' and dia_semana is not null and inicio is not null and fim is not null and fim > inicio)
    or (tipo = 'bloqueio' and data_inicio is not null and data_fim is not null and data_fim >= data_inicio)
  )
);
create index if not exists parceiro_agenda_parceiro on public.parceiro_agenda (parceiro_id);

do $$
declare t text;
begin
  foreach t in array array['parceiro_servicos', 'parceiro_galeria', 'parceiro_agenda'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_le_publico', t);
    execute format('create policy %I on public.%I for select to anon using (public.parceiro_publicado(parceiro_id))', t || '_le_publico', t);
    execute format('drop policy if exists %I on public.%I', t || '_le', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.parceiro_publicado(parceiro_id) or public.parceiro_meu(parceiro_id) or public.is_admin())',
      t || '_le', t
    );
  end loop;
end;
$$;

-- ── 4. Pedidos de serviço (base para a contratação, 31b) ─────────────────────────────────────────────────────────
create table if not exists public.parceiro_pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^VN-SV-[0-9A-Z]{8}$'),
  parceiro_id uuid not null references public.parceiros (id) on delete restrict,
  cliente_id uuid not null references auth.users (id) on delete restrict,
  servico_id uuid references public.parceiro_servicos (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  categoria text not null check (categoria in ('fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro')),
  descricao text check (descricao is null or char_length(descricao) <= 1000),
  status text not null default 'solicitado'
    check (status in ('solicitado', 'orcado', 'aceito', 'agendado', 'entregue', 'concluido', 'recusado', 'cancelado')),
  valor numeric(10, 2) check (valor is null or valor > 0),
  data_sugerida date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists parceiro_pedidos_parceiro on public.parceiro_pedidos (parceiro_id, criado_em desc);
create index if not exists parceiro_pedidos_cliente on public.parceiro_pedidos (cliente_id, criado_em desc);

create table if not exists public.parceiro_pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.parceiro_pedidos (id) on delete cascade,
  autor_id uuid references auth.users (id) on delete set null,
  tipo text not null check (char_length(tipo) between 2 and 40),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists parceiro_pedido_eventos_pedido on public.parceiro_pedido_eventos (pedido_id, criado_em);

create table if not exists public.parceiro_entregas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.parceiro_pedidos (id) on delete cascade,
  path text not null,
  legenda text check (legenda is null or char_length(legenda) <= 120),
  criado_em timestamptz not null default now()
);
create index if not exists parceiro_entregas_pedido on public.parceiro_entregas (pedido_id);

-- Uma das partes do pedido (cliente ou o parceiro) — a RLS das três tabelas usa esta função.
create or replace function public.parceiro_pedido_parte(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parceiro_pedidos x
      join public.parceiros p on p.id = x.parceiro_id
     where x.id = p_pedido and ((select auth.uid()) in (x.cliente_id, p.user_id))
  )
$$;
revoke all on function public.parceiro_pedido_parte(uuid) from public;
grant execute on function public.parceiro_pedido_parte(uuid) to authenticated, service_role;

alter table public.parceiro_pedidos enable row level security;
alter table public.parceiro_pedido_eventos enable row level security;
alter table public.parceiro_entregas enable row level security;
revoke all on public.parceiro_pedidos, public.parceiro_pedido_eventos, public.parceiro_entregas from public, anon, authenticated;
grant select on public.parceiro_pedidos, public.parceiro_pedido_eventos, public.parceiro_entregas to authenticated;
grant all on public.parceiro_pedidos, public.parceiro_pedido_eventos, public.parceiro_entregas to service_role;
drop policy if exists parceiro_pedidos_le on public.parceiro_pedidos;
create policy parceiro_pedidos_le on public.parceiro_pedidos for select to authenticated
  using (public.parceiro_pedido_parte(id) or public.is_admin());
drop policy if exists parceiro_pedido_eventos_le on public.parceiro_pedido_eventos;
create policy parceiro_pedido_eventos_le on public.parceiro_pedido_eventos for select to authenticated
  using (public.parceiro_pedido_parte(pedido_id) or public.is_admin());
drop policy if exists parceiro_entregas_le on public.parceiro_entregas;
create policy parceiro_entregas_le on public.parceiro_entregas for select to authenticated
  using (public.parceiro_pedido_parte(pedido_id) or public.is_admin());

-- ── 5. Bucket das páginas (público; só o servidor grava) ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parceiros', 'parceiros', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- ── 6. Avise-me por categoria ────────────────────────────────────────────────────────────────────────────────────
alter table public.interesse_fotografo_cidade add column if not exists categoria text not null default 'fotografia';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'interesse_fotografo_cidade_categoria_check') then
    alter table public.interesse_fotografo_cidade add constraint interesse_fotografo_cidade_categoria_check
      check (categoria in ('fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro'));
  end if;
  if exists (select 1 from pg_constraint where conname = 'interesse_fotografo_cidade_user_id_uf_chave_key') then
    alter table public.interesse_fotografo_cidade drop constraint interesse_fotografo_cidade_user_id_uf_chave_key;
  end if;
end;
$$;
create unique index if not exists interesse_cidade_categoria_unica on public.interesse_fotografo_cidade (user_id, uf, chave, categoria);

-- ── 7. Chaves ────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.chaves_plataforma add column if not exists valor jsonb not null default '{}'::jsonb;
insert into public.chaves_plataforma (chave, ligada, valor)
values ('PARCEIRO_GERAL_FALLBACK', false, '{"nome": "", "cidade": "", "descricao": ""}'::jsonb)
on conflict (chave) do nothing;

-- ── 8. Dados ─────────────────────────────────────────────────────────────────────────────────────────────────────
insert into public.parceiro_solicitacoes (interesse_id, nome, email, telefone, categorias, cidades, portfolio_url, dados_categoria, status, origem, criado_em)
select i.id,
       left(btrim(i.nome), 120),
       nullif(lower(btrim(i.email)), ''),
       nullif(regexp_replace(coalesce(i.whatsapp, ''), '[^0-9]', '', 'g'), ''),
       case i.tipo
         when 'fotografo' then array['fotografia']
         when 'servicos' then array['limpeza', 'manutencao']
         when 'mobilia' then array['montagem', 'mudanca']
         else array['outro']
       end,
       array[btrim(i.cidade) || coalesce('/' || i.uf, '')],
       case when i.site ~ '^https?://' then i.site end,
       jsonb_build_object('legado_tipo', i.tipo),
       'pendente', 'site', i.criado_em
  from public.parceiros_interesse i
 where char_length(btrim(coalesce(i.nome, ''))) >= 2
   and not exists (select 1 from public.parceiro_solicitacoes s where s.interesse_id = i.id)
   and not exists (
     select 1 from public.parceiro_solicitacoes s
      where i.email is not null and lower(s.email) = lower(btrim(i.email)) and s.status in ('aguardando_email', 'pendente', 'aprovada')
   );

comment on table public.fotografos is 'OBSOLETA (0190): substituída por parceiros (categoria fotografia). O site não lê nem grava.';
comment on table public.fotografos_contato is 'OBSOLETA (0190): substituída por parceiros.';
comment on table public.fotografo_pedidos is 'OBSOLETA (0190): substituída por parceiro_pedidos.';
comment on table public.config_parceria is 'OBSOLETA (0190): a taxa de serviço é 10% para todas as categorias.';
comment on table public.parceiros_interesse is 'Copiada para parceiro_solicitacoes (0190). O formulário novo grava só em parceiro_solicitacoes.';

-- Conferência (somente leitura):
--   select status, origem, count(*) from public.parceiro_solicitacoes group by 1, 2;   -- os interesses viram 'pendente'/'site'
--   select count(*) from public.parceiros_publicos;                                    -- 0 logo depois de aplicar
--   select chave, ligada from public.chaves_plataforma;                                -- PARCEIRO_GERAL_FALLBACK desligada

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000190', '0190_parceiros_ciclo',
       array['-- conteúdo em supabase/migrations/0190_parceiros_ciclo.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000190');
commit;
