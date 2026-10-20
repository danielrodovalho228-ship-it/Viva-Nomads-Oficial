-- Rollback da 0192: tira o cartão do parceiro e volta os cartões, os pedidos e os eventos ao que a 0186/0190 deixaram.
-- Os cartões 'partnercard' e os eventos ref_partner_views/ref_partner_requests (e as demais métricas do tipo
-- partnercard) são apagados: as listas antigas não os aceitam.
begin;
set local lock_timeout = '5s';
drop trigger if exists trg_cartao_ref_pedido_parceiro on public.parceiro_pedidos;
drop function if exists public.cartao_ref_pedido_parceiro();
delete from public.cartoes_compartilhaveis where tipo = 'partnercard';
alter table public.cartoes_compartilhaveis drop constraint if exists cartoes_alvo_check;
drop index if exists public.cartoes_parceiro_idx;
drop index if exists public.cartoes_um_por_alvo;
alter table public.cartoes_compartilhaveis drop column if exists parceiro_id;
alter table public.cartoes_compartilhaveis alter column property_id set not null;
alter table public.cartoes_compartilhaveis drop constraint if exists cartoes_compartilhaveis_tipo_check;
alter table public.cartoes_compartilhaveis add constraint cartoes_compartilhaveis_tipo_check check (tipo in ('poststay', 'ownercard'));
create unique index if not exists cartoes_um_por_alvo on public.cartoes_compartilhaveis
  (tipo, usuario_id, property_id, coalesce(contrato_id, '00000000-0000-0000-0000-000000000000'::uuid));
drop index if exists public.parceiro_pedidos_ref_idx;
alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_ref_check;
alter table public.parceiro_pedidos drop column if exists ref_codigo, drop column if exists ref_tipo;
delete from public.eventos where tipo in ('ref_partner_views', 'ref_partner_requests') or cartao_tipo = 'partnercard';
drop index if exists public.eventos_parceiro_idx;
alter table public.eventos drop column if exists parceiro_id;
alter table public.eventos drop constraint if exists eventos_cartao_tipo_check;
alter table public.eventos add constraint eventos_cartao_tipo_check check (cartao_tipo is null or cartao_tipo in ('poststay', 'ownercard'));
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio',
  'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings'
));
delete from supabase_migrations.schema_migrations where version = '20261019000192';
commit;
