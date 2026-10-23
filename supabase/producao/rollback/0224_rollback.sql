-- Viva Nomads — rollback da 0224 (selo LinkedIn conectado — 63-B). Idempotente. Apaga os selos e as redes privadas
-- (nada disso é usado fora daqui) e devolve a lista de tipos de evento da 0192 (apaga antes os eventos do LinkedIn).
begin;
set local lock_timeout = '5s';
drop table if exists public.confianca_linkedin;
drop table if exists public.perfil_redes;
delete from public.eventos where tipo in ('linkedin_conectado', 'linkedin_desconectado');
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in (
  'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',
  'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio',
  'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings',
  'ref_partner_views', 'ref_partner_requests'
));
delete from supabase_migrations.schema_migrations where version = '20261023000224';
commit;
