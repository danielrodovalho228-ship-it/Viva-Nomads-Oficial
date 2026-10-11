-- Rollback da 0103: remove a tabela de aceites (perde os aceites gravados).
begin;
drop table if exists public.anuncio_aceites_ia;
delete from supabase_migrations.schema_migrations where version = '20261011000103';
commit;
