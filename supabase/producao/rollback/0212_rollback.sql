-- Viva Nomads — rollback da 0212 (Vídeo no anúncio, parte 2). Idempotente.
begin;
set local lock_timeout = '5s';
revoke select (video_arquivo) on public.properties from anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261023000212';
commit;
