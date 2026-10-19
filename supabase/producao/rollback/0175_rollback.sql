-- Rollback da 0175: remove a fila de documentos com falha (os documentos já emitidos ficam).
begin;
drop table if exists public.documentos_falhas;
delete from supabase_migrations.schema_migrations where version = '20261019000175';
commit;
