-- Rollback da 0263: saem os dois rascunhos da prova (pelos ids fixos) e o que veio com eles (fotos, qualificações e
-- demais filhos saem em cascata com o imóvel). Os arquivos (fotos e documento) NÃO são apagados: são do anúncio da
-- prova de publicação (0259) e do outro anúncio de teste.
begin;
set local lock_timeout = '5s';
delete from public.qualification_checklists where property_id in ('a0263000-0000-4000-8000-000000000001', 'a0263000-0000-4000-8000-000000000002');
delete from public.properties where id in ('a0263000-0000-4000-8000-000000000001', 'a0263000-0000-4000-8000-000000000002');
delete from supabase_migrations.schema_migrations where version = '20261030000263';
commit;
