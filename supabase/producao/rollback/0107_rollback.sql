-- Rollback da 0107: remove a Caixa dos Sócios (perde os envios; os arquivos do bucket ficam e podem ser apagados no painel).
begin;
drop function if exists public.responder_caixa_socios(uuid, text, text, uuid);
drop function if exists public.caixa_socios_pendentes();
drop policy if exists "caixa-socios: admin le" on storage.objects;
drop policy if exists "caixa-socios: admin envia" on storage.objects;
drop table if exists public.caixa_socios;
delete from supabase_migrations.schema_migrations where version = '20261012000107';
commit;
