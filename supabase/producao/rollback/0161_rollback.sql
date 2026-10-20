-- Rollback da 0161: remove as fotos do pedido (os caminhos guardados são apagados; os arquivos no bucket ficam).
begin;
alter table public.pedidos_ajuda_publicacao drop constraint if exists ajuda_publicacao_tem_conteudo;
alter table public.pedidos_ajuda_publicacao drop constraint if exists ajuda_publicacao_fotos_max;
delete from public.pedidos_ajuda_publicacao where link_anuncio is null and texto_anuncio is null;
alter table public.pedidos_ajuda_publicacao
  add constraint ajuda_publicacao_tem_conteudo check (link_anuncio is not null or texto_anuncio is not null);
alter table public.pedidos_ajuda_publicacao drop column if exists fotos;
delete from supabase_migrations.schema_migrations where version = '20261018000161';
commit;
