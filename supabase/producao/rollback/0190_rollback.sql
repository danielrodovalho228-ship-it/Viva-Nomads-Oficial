-- Rollback da 0190: tira as tabelas de parceiros (solicitações, páginas, pedidos), a view pública,
-- a categoria do avise-me (volta a uma linha por cidade) e a coluna "valor" das chaves. Os interesses antigos
-- (parceiros_interesse) e as tabelas de fotógrafos continuam como estavam. O bucket "parceiros" fica (o Storage
-- não deixa apagar por SQL): esvazie e apague pelo painel do Supabase se precisar.
begin;
drop view if exists public.parceiros_publicos;
drop function if exists public.parceiros_publicos_lista();
drop table if exists public.parceiro_entregas;
drop table if exists public.parceiro_pedido_eventos;
drop table if exists public.parceiro_pedidos;
drop function if exists public.parceiro_pedido_parte(uuid);
drop table if exists public.parceiro_agenda;
drop table if exists public.parceiro_galeria;
drop table if exists public.parceiro_servicos;
drop function if exists public.parceiro_publicado(uuid);
drop function if exists public.parceiro_meu(uuid);
drop table if exists public.parceiros;
drop table if exists public.parceiro_solicitacoes;
drop index if exists public.interesse_cidade_categoria_unica;
delete from public.interesse_fotografo_cidade a using public.interesse_fotografo_cidade b
 where a.user_id = b.user_id and a.uf = b.uf and a.chave = b.chave and a.id > b.id;
alter table public.interesse_fotografo_cidade drop constraint if exists interesse_fotografo_cidade_categoria_check;
alter table public.interesse_fotografo_cidade drop column if exists categoria;
alter table public.interesse_fotografo_cidade add constraint interesse_fotografo_cidade_user_id_uf_chave_key unique (user_id, uf, chave);
delete from public.chaves_plataforma where chave = 'PARCEIRO_GERAL_FALLBACK';
alter table public.chaves_plataforma drop column if exists valor;
comment on table public.fotografos is null;
comment on table public.fotografos_contato is null;
comment on table public.fotografo_pedidos is null;
comment on table public.config_parceria is null;
comment on table public.parceiros_interesse is null;
delete from supabase_migrations.schema_migrations where version = '20261019000190';
commit;
