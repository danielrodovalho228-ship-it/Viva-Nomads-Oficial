-- Viva Nomads — aplicar 0243 (FISCAL-PARCEIRO-B: o parceiro PJ declara se emite nota fiscal de serviço). Idempotente. Rollback: supabase/producao/rollback/0243_rollback.sql.
-- Nenhum parceiro existente é alterado: todos ficam com emite_nota null (PJ vê a pergunta como pendência no painel).
begin;
set local lock_timeout = '5s';

alter table public.parceiros
  add column if not exists emite_nota boolean,
  add column if not exists nota_selo_removido_em timestamptz,
  add column if not exists nota_selo_motivo text check (nota_selo_motivo is null or length(nota_selo_motivo) between 3 and 300);
alter table public.parceiros drop constraint if exists parceiros_emite_nota_so_pj;
alter table public.parceiros add constraint parceiros_emite_nota_so_pj check (tipo_pessoa = 'pj' or emite_nota is null);
alter table public.parceiros drop constraint if exists parceiros_selo_removido_sem_nota;
alter table public.parceiros add constraint parceiros_selo_removido_sem_nota check (nota_selo_removido_em is null or emite_nota is false);

alter table public.parceiro_solicitacoes add column if not exists emite_nota boolean;
alter table public.parceiro_solicitacoes drop constraint if exists parceiro_solicitacoes_emite_nota_so_pj;
alter table public.parceiro_solicitacoes add constraint parceiro_solicitacoes_emite_nota_so_pj check (tipo_pessoa is distinct from 'pf' or emite_nota is null);

alter table public.chamados drop constraint if exists chamados_contexto_tipo_check;
alter table public.chamados add constraint chamados_contexto_tipo_check check (contexto_tipo in ('pedido', 'contrato', 'anuncio', 'manutencao', 'parceiro'));

-- A view depende da função: as duas são recriadas com as colunas novas no fim (mesmo filtro: só publicado).
drop view if exists public.parceiros_publicos;
drop function if exists public.parceiros_publicos_lista();
create function public.parceiros_publicos_lista()
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
  teste boolean,
  tipo_pessoa text,
  emite_nota boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.slug, p.nome_publico, p.categorias, p.descricao, p.descricao_curta, p.avatar_path, p.banner_path,
         p.instagram, p.linkedin, p.facebook, p.tiktok, p.site, p.cidades, p.raio_km,
         round(p.lat::numeric, 2)::double precision, round(p.lng::numeric, 2)::double precision,
         p.nota_media, p.avaliacoes_qtd, p.publicado_em, coalesce(pf.is_teste, false),
         p.tipo_pessoa, p.emite_nota
    from public.parceiros p
    left join public.profiles pf on pf.id = p.user_id
   where p.status = 'publicado'
$$;
revoke all on function public.parceiros_publicos_lista() from public;
grant execute on function public.parceiros_publicos_lista() to anon, authenticated, service_role;

create view public.parceiros_publicos
  with (security_invoker = on)
as
  select l.* from public.parceiros_publicos_lista() l;
revoke insert, update, delete, truncate, references, trigger on public.parceiros_publicos from anon, authenticated;
grant select on public.parceiros_publicos to anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000243', '0243_parceiro_emite_nota', array['-- conteúdo em supabase/migrations/0243_parceiro_emite_nota.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000243');
commit;
