-- Rollback da 0097: remove o bucket central-anexos (só vazio; o Supabase recusa se houver arquivos).
-- Rodar no SQL Editor (tem DELETE).
begin;
set local lock_timeout = '5s';
delete from storage.buckets where id = 'central-anexos';
delete from supabase_migrations.schema_migrations where version = '20261010000097';
commit;
