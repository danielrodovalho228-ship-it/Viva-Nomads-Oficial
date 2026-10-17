-- Rollback da 0148: apaga a tabela de visitas por vídeo (os pedidos gravados se perdem) e o registro da migração.
begin;
drop table if exists public.visitas_video;
delete from supabase_migrations.schema_migrations where version = '20261017000148';
commit;
