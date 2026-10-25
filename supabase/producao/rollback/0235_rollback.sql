-- Viva Nomads — rollback da 0235: tira a coluna detalhes_anuncio (o anúncio volta sem os detalhes opcionais). Idempotente.
begin;
set local lock_timeout = '5s';
alter table public.properties drop constraint if exists properties_detalhes_anuncio_objeto;
alter table public.properties drop column if exists detalhes_anuncio;
delete from supabase_migrations.schema_migrations where version = '20261024000235';
commit;
