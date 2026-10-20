/*
  Ordem 65e999b2 (complemento, Moacir 18/10) — o dono envia FOTOS no pedido "Publicamos para você".
  Guarda só os caminhos (<uid do dono>/<uuid>.jpg|png|webp) já gravados por /api/upload/foto, até 8.
  O pedido passa a valer só com fotos (link e texto deixam de ser obrigatórios quando há foto).
  Sem dado pessoal novo.
*/
alter table public.pedidos_ajuda_publicacao
  add column if not exists fotos text[] not null default '{}';

alter table public.pedidos_ajuda_publicacao drop constraint if exists ajuda_publicacao_fotos_max;
alter table public.pedidos_ajuda_publicacao
  add constraint ajuda_publicacao_fotos_max check (cardinality(fotos) <= 8);

alter table public.pedidos_ajuda_publicacao drop constraint if exists ajuda_publicacao_tem_conteudo;
alter table public.pedidos_ajuda_publicacao
  add constraint ajuda_publicacao_tem_conteudo check (link_anuncio is not null or texto_anuncio is not null or cardinality(fotos) > 0);
