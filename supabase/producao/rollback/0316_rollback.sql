-- Rollback da 0316 (E660). Colunas aditivas; desfazer = remover e desregistrar (a ficha congelada se perde).
begin;
alter table public.contratos drop column if exists ficha_dentro_congelada;
alter table public.properties drop column if exists ficha_dentro;
delete from supabase_migrations.schema_migrations where version = '20261107000316';
commit;
