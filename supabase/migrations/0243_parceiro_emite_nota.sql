-- FISCAL-PARCEIRO-B (E24) — o parceiro PJ (MEI conta como PJ) declara se emite nota fiscal de serviço para o cliente.
-- A nota (ou o recibo, quando PF) é do PARCEIRO; a Viva emite o documento só da própria taxa. properties.issues_invoice
-- não muda.
--
--   parceiros.emite_nota / parceiro_solicitacoes.emite_nota: boolean null (null = não respondeu). PF fica SEMPRE null
--     (check). Parceiro PJ que já existe fica null e vê a pergunta como pendência no painel, sem bloquear o que já está
--     no ar; quem é PJ e vai concluir o cadastro responde (portão no servidor).
--   nota_selo_removido_em / nota_selo_motivo: denúncia procedente na Central de Ajuda tira o selo (emite_nota = false),
--     registra o motivo e o parceiro é avisado. O parceiro não religa o selo sozinho depois de removido.
--   chamados.contexto_tipo ganha 'parceiro' (o "Problema com isto" da página do parceiro).
--   parceiros_publicos passa a expor tipo_pessoa e emite_nota (o filtro "Emite nota fiscal" da busca e o documento do
--     serviço na tela). Documento, recebimento e contato continuam fora.

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
