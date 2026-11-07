-- Rollback da 0315 (E657). A coluna é aditiva e inofensiva; desfazer = remover e desregistrar.
begin;
update public.leads set reenviada_em = null where id = 'a65945b6-1c11-4e89-95c7-e4a0fde6f616';
alter table public.leads drop column if exists reenviada_em;
delete from supabase_migrations.schema_migrations where version = '20261107000315';
commit;
