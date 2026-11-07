-- Rollback da 0315 (E657). A coluna é aditiva e inofensiva; desfazer = remover e desregistrar.
begin;
alter table public.leads drop column if exists reenviada_em;
delete from supabase_migrations.schema_migrations where version = '20261107000315';
commit;
