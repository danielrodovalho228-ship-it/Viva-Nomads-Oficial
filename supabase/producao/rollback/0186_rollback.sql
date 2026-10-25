-- Rollback da 0186: tira os cartões, os códigos, as colunas de atribuição e volta a lista de eventos da 0067.
-- Os eventos das métricas dos cartões são apagados (a lista antiga não os aceita).
begin;
drop trigger if exists trg_cartao_ref_booking on public.contratos;
drop function if exists public.cartao_ref_booking();
drop table if exists public.cartoes_compartilhaveis;
drop table if exists public.codigos_compartilhamento;
alter table public.leads drop constraint if exists leads_ref_check;
alter table public.leads drop column if exists ref_codigo, drop column if exists ref_tipo;
delete from public.eventos where tipo in ('cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings');
alter table public.eventos drop constraint if exists eventos_cartao_tipo_check;
alter table public.eventos drop column if exists cartao_tipo;
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio'
));
delete from supabase_migrations.schema_migrations where version = '20261019000186';
commit;
