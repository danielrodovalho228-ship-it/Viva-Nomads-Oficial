-- Rollback da 0269: sai o rascunho da reprova do E274 (pelo id fixo) e o que veio com ele (fotos, qualificação e demais
-- filhos saem em cascata com o imóvel). Os arquivos (fotos e documento) NÃO são apagados: são do anúncio da prova de
-- publicação (0259) e do outro anúncio de teste.
begin;
set local lock_timeout = '5s';
delete from public.qualification_checklists where property_id = 'a0269000-0000-4000-8000-000000000001';
delete from public.properties where id = 'a0269000-0000-4000-8000-000000000001';
delete from supabase_migrations.schema_migrations where version = '20261031000269';
commit;
