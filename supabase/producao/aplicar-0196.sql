-- Viva Nomads — 0196: sinais da ordem dos imóveis (cômodo da foto, calendário confirmado, quem cancelou),
-- interruptor do admin, modo sombra e ranking_sinais (Prompt 33, itens 4 e 5). Idempotente.
-- Nada muda para o público: a ordem nova só vale com a chave ORDEM_NOVA_ATIVA ligada (desligada no merge).
-- Rollback: supabase/producao/rollback/0196_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';


-- ── 1) Cômodo de cada foto (valores fixos; fotos antigas ficam nulas) ─────────────────────────────
alter table public.property_photos add column if not exists comodo text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'property_photos_comodo_check') then
    alter table public.property_photos add constraint property_photos_comodo_check check (
      comodo is null or comodo in ('sala', 'quarto', 'cozinha', 'banheiro', 'home_office', 'fachada',
                                   'area_externa', 'detalhe', 'lavanderia', 'garagem'));
  end if;
end $$;

-- ── 2) Calendário confirmado ──────────────────────────────────────────────────────────────────────
-- O dono nunca escolhe a data: qualquer escrita dele vira now() (não dá para "confirmar no futuro").
alter table public.properties add column if not exists disponibilidade_confirmada_em timestamptz;

create or replace function public.properties_disponibilidade_agora() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.disponibilidade_confirmada_em is not null
     and (tg_op = 'INSERT' or new.disponibilidade_confirmada_em is distinct from old.disponibilidade_confirmada_em)
     and current_user not in ('service_role', 'supabase_admin', 'postgres')
  then
    new.disponibilidade_confirmada_em := now();
  end if;
  return new;
end $$;

drop trigger if exists properties_disponibilidade_agora on public.properties;
create trigger properties_disponibilidade_agora
  before insert or update of disponibilidade_confirmada_em on public.properties
  for each row execute function public.properties_disponibilidade_agora();

-- Qualquer edição de property_blocks pelo DONO também confirma o calendário.
create or replace function public.property_blocks_confirma_calendario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  imovel uuid := coalesce(new.property_id, old.property_id);
begin
  update public.properties
     set disponibilidade_confirmada_em = now()
   where id = imovel
     and owner_id = auth.uid();
  return null;
end $$;
revoke all on function public.property_blocks_confirma_calendario() from public, anon, authenticated;

drop trigger if exists property_blocks_confirma_calendario on public.property_blocks;
create trigger property_blocks_confirma_calendario
  after insert or update or delete on public.property_blocks
  for each row execute function public.property_blocks_confirma_calendario();

-- ── 3) Quem cancelou o contrato (os antigos ficam nulos e não contam) ────────────────────────────
alter table public.contratos add column if not exists cancelado_por text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_cancelado_por_check') then
    alter table public.contratos add constraint contratos_cancelado_por_check
      check (cancelado_por is null or cancelado_por in ('proprietario', 'morador', 'admin', 'acordo'));
  end if;
end $$;

-- ── 4) Interruptor do admin (prevalece sobre a variável de ambiente) ─────────────────────────────
create table if not exists public.plataforma_chaves (
  chave text primary key check (char_length(chave) <= 60),
  ligada boolean not null,
  atualizada_em timestamptz not null default now(),
  atualizada_por uuid references auth.users (id) on delete set null
);
alter table public.plataforma_chaves enable row level security;
revoke all on table public.plataforma_chaves from anon, authenticated;
create index if not exists plataforma_chaves_atualizada_por_idx on public.plataforma_chaves (atualizada_por);

-- ── 5) Modo sombra: top 10 antigo × novo, sem dados pessoais, 30 dias ────────────────────────────
create table if not exists public.ranking_sombra (
  id bigint generated always as identity primary key,
  criada_em timestamptz not null default now(),
  busca jsonb not null default '{}'::jsonb,       -- filtros resumidos (cidade, faixa, ordenação), nunca pessoa
  top_antigo uuid[] not null default '{}',
  top_novo uuid[] not null default '{}',
  donos_antigo smallint not null default 0,       -- donos distintos no top 10 antigo
  donos_novo smallint not null default 0
);
alter table public.ranking_sombra enable row level security;
revoke all on table public.ranking_sombra from anon, authenticated;
create index if not exists ranking_sombra_criada_em_idx on public.ranking_sombra (criada_em);

create or replace function public.limpar_ranking_sombra() returns integer
language sql security definer set search_path = public as $$
  with apagados as (
    delete from public.ranking_sombra where criada_em < now() - interval '30 days' returning 1
  )
  select count(*)::integer from apagados;
$$;
revoke all on function public.limpar_ranking_sombra() from public, anon, authenticated;
grant execute on function public.limpar_ranking_sombra() to service_role;

-- ── 6) Sinais dos anúncios numa consulta só (sem N+1). Só o servidor (service_role) chama. ──────
-- Identidade do dono e "Preço justo" vêm de fontes que o servidor já tem (estadosIdentidade e
-- properties.preco_justo); aqui ficam os sinais que pedem junção.
create or replace function public.ranking_sinais(p_ids uuid[])
returns table (
  id uuid,
  dono_id uuid,
  titulo text,
  dono_is_teste boolean,
  fotos_total integer,
  comodos_distintos integer,
  descricao_palavras integer,
  regras_completas boolean,
  endereco_exato boolean,
  disponibilidade_confirmada_em timestamptz,
  matricula_conferida boolean,
  caf_real_ok boolean,
  conversas integer,
  conversas_respondidas integer,
  resposta_media_min integer,
  avaliacoes_qtd integer,
  avaliacoes_media numeric,
  cancelamentos_dono_12m integer,
  preco_justo boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.owner_id,
    p.title,
    coalesce(pr.is_teste, false),
    coalesce(f.total, 0),
    coalesce(f.comodos, 0),
    coalesce(array_length(regexp_split_to_array(nullif(btrim(p.description), ''), '\s+'), 1), 0),
    (p.max_guests is not null and nullif(btrim(p.checkin_after), '') is not null
      and nullif(btrim(p.checkout_before), '') is not null),
    nullif(btrim(p.exact_address), '') is not null,
    p.disponibilidade_confirmada_em,
    coalesce(oc.resultado = 'conferido', false),
    coalesce(oc.caf_ok and not oc.caf_simulado, false),
    coalesce(pp.conversas, 0),
    coalesce(pp.conversas_respondidas, 0),
    pp.resposta_media_min,
    coalesce(av.qtd, 0),
    av.media,
    coalesce(ct.cancelamentos, 0),
    coalesce(p.preco_justo, false)
  from public.properties p
  left join public.profiles pr on pr.id = p.owner_id
  left join lateral (
    select count(*)::integer as total, count(distinct ph.comodo)::integer as comodos
      from public.property_photos ph where ph.property_id = p.id
  ) f on true
  left join lateral (
    select c.resultado, c.caf_ok, c.caf_simulado
      from public.property_ownership_checks c
     where c.property_id = p.id
     order by c.criada_em desc
     limit 1
  ) oc on true
  left join lateral (
    select x.conversas, x.conversas_respondidas, x.resposta_media_min
      from public.perfil_publico_proprietario(p.owner_id) x
  ) pp on true
  left join lateral (
    select count(*)::integer as qtd, avg(a.nota_geral)::numeric as media
      from public.avaliacoes a
     where a.imovel_id = p.id and a.papel_autor = 'inquilino' and a.status = 'publicada'
  ) av on true
  left join lateral (
    select count(*)::integer as cancelamentos
      from public.contratos k
      join public.properties kp on kp.id = k.property_id
     where kp.owner_id = p.owner_id
       and k.status = 'cancelado'
       and k.cancelado_por = 'proprietario'
       and coalesce(k.encerrado_em, k.created_at) >= now() - interval '12 months'
  ) ct on true
  where p.id = any (p_ids);
$$;
revoke all on function public.ranking_sinais(uuid[]) from public, anon, authenticated;
grant execute on function public.ranking_sinais(uuid[]) to service_role;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261021000196', '0196_ranking_sinais',
       array['-- conteúdo em supabase/migrations/0196_ranking_sinais.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261021000196');
commit;
