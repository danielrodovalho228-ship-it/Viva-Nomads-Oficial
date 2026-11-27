-- Rollback da 0305 (E629): devolve o título antigo do anúncio de teste (só se ainda for o novo).
begin;
update public.properties
   set title = '[TESTE QA NÍVEL] Premium'
 where id = '330ebf37-fca4-4f8a-88d9-47614bc56674' and title = '[TESTE QA NÍVEL] Essencial (falta medir a internet para chegar a Premium)';
delete from supabase_migrations.schema_migrations where version = '20261105000305';
commit;
