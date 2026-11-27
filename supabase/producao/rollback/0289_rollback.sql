-- Rollback da 0289: o documento do rascunho de teste 4a693a63 volta a "Em análise" (pendente, sem revisor). Só a linha
-- aprovada pela fixture; o arquivo e o resto do rascunho ficam como estão.
begin;
set local lock_timeout = '5s';
update public.qualification_checklists
   set document_status = 'pending', document_review_reason = null, document_reviewed_at = null, document_reviewed_by = null
 where id = '4f52b6aa-b9f8-4406-979b-6ee397bf10cf'
   and property_id = '4a693a63-8f4e-453c-a888-cd0ea9ccc4ff'
   and document_status = 'approved';
delete from supabase_migrations.schema_migrations where version = '20261104000289';
commit;
