-- Viva Nomads — rollback da 0358 (E1113): tira o gatilho de contacto da bio. Nunca roda sozinho.
begin;
set local lock_timeout = '5s';
drop trigger if exists contato_perfil_bio on public.profiles;
delete from supabase_migrations.schema_migrations where version = '20261122000358';
commit;
