-- Rollback da 0116: remove as colunas de privacidade/acesso (reverta também o commit; a declaração some).
begin;
alter table public.properties drop constraint if exists properties_tipo_acesso_check;
alter table public.properties drop constraint if exists properties_cameras_externas_len;
alter table public.properties
  drop column if exists sem_cameras_interior,
  drop column if exists cameras_externas,
  drop column if exists tipo_acesso,
  drop column if exists senha_trocada_estadia;
delete from supabase_migrations.schema_migrations where version = '20261014000116';
commit;
