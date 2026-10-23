-- Viva Nomads — aplicar 0213 (níveis Essencial/Conforto/Premium, ruído, extras, medição por ponto e lista v2 do padrão mínimo — Adendo 59.1). Idempotente. Rollback: supabase/producao/rollback/0213_rollback.sql.
begin;
set local lock_timeout = '5s';
-- 0213 — Adendo 59.1 (parte funcional): níveis Essencial / Conforto / Premium, ruído, extras, medição por ponto e a
-- correção do padrão mínimo (lista versão 2). Reaplicar é seguro.
--
--   1. conforto_chaves(): a lista passa a 12 itens (entram lavanderia_acesso e apoio_cama); conforto_versoes(): versão
--      em que o critério de cada item começou (roupa_cama_banho muda na 2: 2 toalhas de banho por pessoa).
--      conforto_completo() só conta a confirmação feita na versão do critério atual ou depois (o dono reconfirma só o
--      que entrou ou mudou). Espelho de src/config/conforto-minimo.ts (teste de guarda compara).
--   2. conforto_adequacao.versao_lista: anúncio publicado que ficou incompleto com a versão 2 ganha 30 dias (uma vez).
--   3. nivel_itens: o dono declara cada item de Conforto/Premium com UMA foto (caminho no bucket de fotos do anúncio,
--      sem EXIF). O atendimento pode recusar a foto com motivo. Só o servidor grava; dono e equipe leem.
--   4. imovel_ruido: as 4 perguntas de exposição (via intensa, bares/obra a 100 m, avião/ferrovia, isolamento).
--      imovel_extras: lista fechada de extras (fato da ficha; nunca entra no nível). Leitura pública do anúncio ativo.
--   5. internet_medicoes.ponto: quarto principal | ponto de trabalho | sala | outro (declarado no ato da medição);
--      internet_medida_ponto_publica: a última medição válida de cada ponto do anúncio ativo.
--   6. imovel_nivel: o nível calculado pelo servidor (elo mais fraco) + por área + diferenciais + nivel_vistoriado_em
--      (fase 2; sem vistoria, nada muda). Leitura pública do anúncio ativo; só o servidor grava.
--  Nível NÃO é selo, NÃO muda a taxa de serviço e NÃO compra posição: nenhuma coluna aqui toca taxa ou ordem.
--  Nada financeiro (D7).

-- ── 1. Lista do padrão mínimo, versão 2 ──────────────────────────────────────────────────────────────────────────
create or replace function public.conforto_chaves()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['cama_colchao', 'roupa_cama_banho', 'agua_quente', 'cozinha_basica', 'ventilacao_quartos',
               'iluminacao', 'fechadura_entrada', 'entrega_limpa', 'internet_informada', 'mobilia_das_fotos',
               'lavanderia_acesso', 'apoio_cama']::text[];
$$;
grant execute on function public.conforto_chaves() to anon, authenticated, service_role;

-- Versão em que o critério atual de cada item começou (item ausente = 1).
create or replace function public.conforto_versoes()
returns jsonb
language sql
immutable
set search_path = public
as $$
  select '{"roupa_cama_banho": 2, "lavanderia_acesso": 2, "apoio_cama": 2}'::jsonb;
$$;
grant execute on function public.conforto_versoes() to anon, authenticated, service_role;

create or replace function public.conforto_completo(p_property uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct d.chave) = cardinality(public.conforto_chaves())
    from public.conforto_declaracoes d
   where d.property_id = p_property
     and d.confirmado
     and d.chave = any (public.conforto_chaves())
     and d.versao_lista >= coalesce((public.conforto_versoes() ->> d.chave)::int, 1);
$$;
revoke all on function public.conforto_completo(uuid) from public, anon;
grant execute on function public.conforto_completo(uuid) to authenticated, service_role;

-- ── 2. 30 dias de adequação para quem ficou incompleto com a versão 2 (uma vez) ─────────────────────────────────
alter table public.conforto_adequacao add column if not exists versao_lista integer not null default 1;
insert into public.conforto_adequacao (property_id, prazo_ate, versao_lista)
select p.id, now() + interval '30 days', 2
  from public.properties p
 where p.status::text = 'active' and not public.conforto_completo(p.id)
on conflict (property_id) do update
   set prazo_ate = excluded.prazo_ate, lembretes = '{}', versao_lista = 2
 where public.conforto_adequacao.versao_lista < 2;

-- ── 3. Itens de nível (declaração + foto) ────────────────────────────────────────────────────────────────────────
create table if not exists public.nivel_itens (
  property_id uuid not null references public.properties (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{3,40}$'),
  declarado boolean not null default false,
  foto_path text check (foto_path is null or foto_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  foto_status text not null default 'pendente' check (foto_status in ('pendente', 'aceita', 'recusada')),
  motivo_recusa text check (motivo_recusa is null or char_length(motivo_recusa) between 5 and 300),
  declarado_por uuid references auth.users (id) on delete set null,
  declarado_em timestamptz,
  analisado_por uuid references auth.users (id) on delete set null,
  analisado_em timestamptz,
  primary key (property_id, chave),
  constraint nivel_itens_recusa_com_motivo check ((foto_status = 'recusada') = (motivo_recusa is not null))
);
create index if not exists nivel_itens_analise_idx on public.nivel_itens (foto_status) where declarado and foto_path is not null;
create index if not exists nivel_itens_declarado_por_idx on public.nivel_itens (declarado_por);
create index if not exists nivel_itens_analisado_por_idx on public.nivel_itens (analisado_por);
alter table public.nivel_itens enable row level security;
revoke all on public.nivel_itens from anon, authenticated;
grant select on public.nivel_itens to authenticated;
grant all on public.nivel_itens to service_role;
drop policy if exists "nivel itens: dono e equipe leem" on public.nivel_itens;
create policy "nivel itens: dono e equipe leem" on public.nivel_itens for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = nivel_itens.property_id and p.owner_id = auth.uid())
);

-- ── 4. Ruído e extras ────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.imovel_ruido (
  property_id uuid primary key references public.properties (id) on delete cascade,
  via_intensa boolean not null,
  noturno_obra_100m boolean not null,
  aviao_ferrovia boolean not null,
  isolamento_acustico boolean not null,
  classe text not null check (classe in ('baixo', 'medio', 'alto')),
  origem text not null default 'proprietario' check (origem in ('proprietario', 'vistoria')),
  respondido_em timestamptz not null default now()
);
alter table public.imovel_ruido enable row level security;
revoke all on public.imovel_ruido from anon, authenticated;
grant select on public.imovel_ruido to anon, authenticated;
grant all on public.imovel_ruido to service_role;
drop policy if exists "ruido: anuncio ativo, dono e equipe" on public.imovel_ruido;
drop policy if exists "ruido: anuncio ativo" on public.imovel_ruido;
create policy "ruido: anuncio ativo" on public.imovel_ruido for select to anon using (
  exists (select 1 from public.properties p where p.id = imovel_ruido.property_id and p.status::text = 'active')
);
drop policy if exists "ruido: anuncio ativo, dono e equipe (logado)" on public.imovel_ruido;
create policy "ruido: anuncio ativo, dono e equipe (logado)" on public.imovel_ruido for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = imovel_ruido.property_id and (p.status::text = 'active' or p.owner_id = auth.uid()))
);

create table if not exists public.imovel_extras (
  property_id uuid not null references public.properties (id) on delete cascade,
  chave text not null check (chave ~ '^[a-z_]{2,40}$'),
  criado_em timestamptz not null default now(),
  primary key (property_id, chave)
);
alter table public.imovel_extras enable row level security;
revoke all on public.imovel_extras from anon, authenticated;
grant select on public.imovel_extras to anon, authenticated;
grant all on public.imovel_extras to service_role;
drop policy if exists "extras: anuncio ativo, dono e equipe" on public.imovel_extras;
drop policy if exists "extras: anuncio ativo" on public.imovel_extras;
create policy "extras: anuncio ativo" on public.imovel_extras for select to anon using (
  exists (select 1 from public.properties p where p.id = imovel_extras.property_id and p.status::text = 'active')
);
drop policy if exists "extras: anuncio ativo, dono e equipe (logado)" on public.imovel_extras;
create policy "extras: anuncio ativo, dono e equipe (logado)" on public.imovel_extras for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = imovel_extras.property_id and (p.status::text = 'active' or p.owner_id = auth.uid()))
);

-- ── 5. Medição por ponto (Prompt 57) ─────────────────────────────────────────────────────────────────────────────
alter table public.internet_medicoes add column if not exists ponto text;
do $$ begin
  alter table public.internet_medicoes add constraint internet_medicoes_ponto_check
    check (ponto is null or ponto in ('quarto_principal', 'trabalho', 'sala', 'outro'));
exception when duplicate_object then null;
end $$;

create or replace function public.internet_medida_ponto_publica_lista()
returns table (property_id uuid, ponto text, download_mbps numeric, upload_mbps numeric, latencia_ms integer, medido_em timestamptz, valido_ate timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.property_id, m.ponto) m.property_id, m.ponto, m.download_mbps, m.upload_mbps, m.latencia_ms, m.medido_em, m.valido_ate
    from public.internet_medicoes m
    join public.properties p on p.id = m.property_id
   where m.papel = 'dono' and m.validada and m.valido_ate > now() and m.ponto is not null and p.status::text = 'active'
   order by m.property_id, m.ponto, m.medido_em desc
$$;
revoke all on function public.internet_medida_ponto_publica_lista() from public;
grant execute on function public.internet_medida_ponto_publica_lista() to anon, authenticated, service_role;

create or replace view public.internet_medida_ponto_publica
  with (security_invoker = on)
as
  select l.property_id, l.ponto, l.download_mbps, l.upload_mbps, l.latencia_ms, l.medido_em, l.valido_ate
    from public.internet_medida_ponto_publica_lista() l;
revoke insert, update, delete, truncate, references, trigger on public.internet_medida_ponto_publica from anon, authenticated;
grant select on public.internet_medida_ponto_publica to anon, authenticated;

-- ── 6. Nível calculado (servidor) ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.imovel_nivel (
  property_id uuid primary key references public.properties (id) on delete cascade,
  nivel text not null check (nivel in ('em_adequacao', 'essencial', 'conforto', 'premium')),
  por_area jsonb not null default '{}'::jsonb,
  diferenciais jsonb not null default '[]'::jsonb,
  ruido_classe text check (ruido_classe is null or ruido_classe in ('baixo', 'medio', 'alto')),
  calculado_em timestamptz not null default now(),
  -- Fase 2 (prompt da vistoria): a ficha mostra "Premium · vistoriado". Sem vistoria, fica nulo e nada muda.
  nivel_vistoriado_em timestamptz
);
create index if not exists imovel_nivel_nivel_idx on public.imovel_nivel (nivel);
alter table public.imovel_nivel enable row level security;
revoke all on public.imovel_nivel from anon, authenticated;
grant select on public.imovel_nivel to anon, authenticated;
grant all on public.imovel_nivel to service_role;
drop policy if exists "nivel: anuncio ativo, dono e equipe" on public.imovel_nivel;
drop policy if exists "nivel: anuncio ativo" on public.imovel_nivel;
create policy "nivel: anuncio ativo" on public.imovel_nivel for select to anon using (
  exists (select 1 from public.properties p where p.id = imovel_nivel.property_id and p.status::text = 'active')
);
drop policy if exists "nivel: anuncio ativo, dono e equipe (logado)" on public.imovel_nivel;
create policy "nivel: anuncio ativo, dono e equipe (logado)" on public.imovel_nivel for select to authenticated using (
  public.is_admin() or exists (select 1 from public.properties p where p.id = imovel_nivel.property_id and (p.status::text = 'active' or p.owner_id = auth.uid()))
);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261023000213', '0213_niveis_conforto',
       array['-- conteúdo em supabase/migrations/0213_niveis_conforto.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261023000213');
commit;
