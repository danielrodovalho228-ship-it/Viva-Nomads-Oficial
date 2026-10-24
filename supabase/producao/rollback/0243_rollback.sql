-- Viva Nomads — rollback da 0243: tira a declaração de nota fiscal do parceiro, o selo removido por denúncia e o contexto
-- 'parceiro' dos chamados; a view pública volta às colunas da 0190. Idempotente. Os chamados abertos pela página do
-- parceiro ficam, só sem o vínculo (contexto vira null).
begin;
set local lock_timeout = '5s';
drop view if exists public.parceiros_publicos;
drop function if exists public.parceiros_publicos_lista();
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
update public.chamados set contexto_tipo = null, contexto_id = null where contexto_tipo = 'parceiro';
alter table public.chamados drop constraint if exists chamados_contexto_tipo_check;
alter table public.chamados add constraint chamados_contexto_tipo_check check (contexto_tipo in ('pedido', 'contrato', 'anuncio', 'manutencao'));
alter table public.parceiro_solicitacoes drop constraint if exists parceiro_solicitacoes_emite_nota_so_pj;
alter table public.parceiro_solicitacoes drop column if exists emite_nota;
alter table public.parceiros drop constraint if exists parceiros_emite_nota_so_pj;
alter table public.parceiros drop constraint if exists parceiros_selo_removido_sem_nota;
alter table public.parceiros
  drop column if exists emite_nota,
  drop column if exists nota_selo_removido_em,
  drop column if exists nota_selo_motivo;
delete from supabase_migrations.schema_migrations where version = '20261024000243';
commit;
