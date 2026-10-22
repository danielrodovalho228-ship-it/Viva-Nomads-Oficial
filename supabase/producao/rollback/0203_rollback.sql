-- Viva Nomads — rollback da 0203 (aceite do texto de IA exigido ao publicar). Idempotente.
begin;
set local lock_timeout = '5s';
drop trigger if exists trg_properties_exige_aceite_ia on public.properties;
drop function if exists public.properties_exige_aceite_ia();
delete from supabase_migrations.schema_migrations where version = '20261022000203';
commit;
