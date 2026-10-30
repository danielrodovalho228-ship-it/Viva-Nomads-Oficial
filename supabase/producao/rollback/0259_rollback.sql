-- Rollback da 0259: sai o rascunho da prova (pelos ids fixos) e o que o QA gravou nele (fotos, qualificações e demais
-- filhos saem em cascata com o imóvel). O arquivo do documento NÃO é apagado: pertence ao outro anúncio de teste.
begin;
set local lock_timeout = '5s';
delete from public.qualification_checklists where property_id = 'a0259000-0000-4000-8000-000000000001';
delete from public.properties where id = 'a0259000-0000-4000-8000-000000000001';
delete from supabase_migrations.schema_migrations where version = '20261030000259';
commit;
