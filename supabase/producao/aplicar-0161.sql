-- Viva Nomads — aplicar 0161 (fotos no pedido "Publicamos para você"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0161_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.pedidos_ajuda_publicacao
  add column if not exists fotos text[] not null default '{}';

alter table public.pedidos_ajuda_publicacao drop constraint if exists ajuda_publicacao_fotos_max;
alter table public.pedidos_ajuda_publicacao
  add constraint ajuda_publicacao_fotos_max check (cardinality(fotos) <= 8);

alter table public.pedidos_ajuda_publicacao drop constraint if exists ajuda_publicacao_tem_conteudo;
alter table public.pedidos_ajuda_publicacao
  add constraint ajuda_publicacao_tem_conteudo check (link_anuncio is not null or texto_anuncio is not null or cardinality(fotos) > 0);

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000161', '0161_ajuda_publicacao_fotos',
       array['-- conteúdo em supabase/migrations/0161_ajuda_publicacao_fotos.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000161');
commit;
