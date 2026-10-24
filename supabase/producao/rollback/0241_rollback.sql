-- Viva Nomads — rollback da 0241: tira o registro de reenvios e o aceite do termo de IA por dono. Idempotente.
-- Os documentos emitidos e o aceite por anúncio (anuncio_aceites_ia) não são tocados; a caixa do termo volta a aparecer
-- a cada publicação.
begin;
set local lock_timeout = '5s';
drop table if exists public.documentos_reenvios;
drop table if exists public.termo_ia_aceites;
delete from supabase_migrations.schema_migrations where version = '20261024000241';
commit;
