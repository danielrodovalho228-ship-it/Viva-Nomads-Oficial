-- Viva Nomads — rollback da 0211 (Vídeo curto no anúncio, parte 1). Idempotente.
-- Antes: apagar os objetos do bucket pelo painel/API do Storage (o SQL não apaga arquivos com segurança).
begin;
set local lock_timeout = '5s';
drop policy if exists "anuncio-videos: dono envia" on storage.objects;
drop policy if exists "anuncio-videos: dono apaga" on storage.objects;
drop policy if exists "anuncio-videos: le dono ou publicado" on storage.objects;
delete from storage.buckets where id = 'anuncio-videos' and not exists (select 1 from storage.objects where bucket_id = 'anuncio-videos');
alter table public.properties drop constraint if exists properties_video_arquivo_pasta;
alter table public.properties drop column if exists video_arquivo;
delete from supabase_migrations.schema_migrations where version = '20261023000211';
commit;
