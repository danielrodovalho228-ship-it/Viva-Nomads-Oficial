-- Rollback da 0312 (E513): é massa de teste (galeria das 8 sementes da conta de teste). Desfazer = só desregistrar a migração;
-- as fotos distintas são inofensivas e a 0302 ficou como estava.
begin;
delete from supabase_migrations.schema_migrations where version = '20261105000312';
commit;
